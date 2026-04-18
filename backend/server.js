const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ── ML Integration ────────────────────────────────────────────
const mlRouter = require("./ml_integration");
app.use(mlRouter);

// ── File-based Storage (Permanent!) ──────────────────────────
const DB_FILE = path.join(__dirname, "database.json");

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    }
  } catch (e) {}
  return { users: [], policies: [], claims: [], payments: [] };
}

function saveDB(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (e) {
    console.log("Error saving DB:", e.message);
  }
}

function isPolicyExpired(policy) {
  if (!policy || !policy.endDate) return true;
  return new Date(policy.endDate).getTime() <= Date.now();
}

function getLatestPolicy(userId) {
  return db.policies
    .filter(p => p.userId === userId)
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))[0] || null;
}

function getActivePolicy(userId) {
  const policy = getLatestPolicy(userId);
  if (!policy || policy.status !== "active") return null;
  if (isPolicyExpired(policy)) {
    policy.status = "expired";
    saveDB(db);
    return null;
  }
  return policy;
}

function getPolicy(userId) {
  const policy = getLatestPolicy(userId);
  if (!policy) return null;
  if (policy.status === "active" && isPolicyExpired(policy)) {
    policy.status = "expired";
    saveDB(db);
  }
  return policy;
}

function expirePolicies() {
  let changed = false;
  db.policies.forEach(policy => {
    if (policy.status === "active" && isPolicyExpired(policy)) {
      policy.status = "expired";
      changed = true;
    }
  });
  if (changed) saveDB(db);
}

let db = loadDB();
expirePolicies();
console.log(`✅ RiderSaathi Database loaded! Users: ${db.users.length}, Policies: ${db.policies.length}, Claims: ${db.claims.length}`);

// ── Triggers ──────────────────────────────────────────────────
const triggers = [
  { id: 1, type: "Rainfall", condition: "> 80mm", impact: "Work stops", active: false, value: 45 },
  { id: 2, type: "Temperature", condition: "> 42°C", impact: "Reduced hours", active: true, value: 43.2 },
  { id: 3, type: "AQI", condition: "> 300", impact: "Unsafe conditions", active: true, value: 340 },
  { id: 4, type: "Curfew", condition: "Zone closure", impact: "No deliveries", active: false, value: 0 },
];

function calcPremium(w) { return Math.round(w * 0.30 * 0.25 * 1.20); }
function calcPayout(w) { return Math.round(w * 0.40); }

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

async function getPremiumEstimate(user) {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekly_income: user.weeklyIncome,
        city: user.city || "Noida",
        platform: (user.platform || "zomato").toLowerCase(),
        bts: user.bts ?? 85,
        rainfall_mm: 10,
        temperature_c: 33,
        aqi: 120,
        curfew_active: false,
        hour_of_day: 13,
        day_of_week: 2,
      }),
    });
    if (!response.ok) throw new Error(`ML service responded ${response.status}`);
    const data = await response.json();
    return Number(data["premium"]["final_premium_inr"] || data.premium?.final_premium_inr || calcPremium(user.weeklyIncome));
  } catch (err) {
    console.warn("[Policy Premium] ML service unavailable, falling back to legacy formula:", err.message);
    return calcPremium(user.weeklyIncome);
  }
}

// ── Register ──────────────────────────────────────────────────
app.post("/api/register", (req, res) => {
  try {
    const { name, phone, email, platform, weeklyIncome, city } = req.body;
    if (!name || !phone || !weeklyIncome) return res.status(400).json({ error: "Missing required fields" });
    if (db.users.find(u => u.phone === phone)) return res.status(409).json({ error: "Phone already registered" });

    const user = { id: uuidv4(), name, phone, email, platform, weeklyIncome: Number(weeklyIncome), city, createdAt: new Date().toISOString() };
    db.users.push(user);
    saveDB(db);

    const token = Buffer.from(user.id).toString("base64");
    res.json({ success: true, user, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Login ─────────────────────────────────────────────────────
app.post("/api/login", (req, res) => {
  try {
    const { phone } = req.body;
    const user = db.users.find(u => u.phone === phone);
    if (!user) return res.status(404).json({ error: "User not found. Please register first." });
    const policy = getPolicy(user.id);
    const token = Buffer.from(user.id).toString("base64");
    res.json({ success: true, user, policy, token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Auth Middleware ───────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const userId = Buffer.from(token, "base64").toString();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    req.user = user;
    next();
  } catch { res.status(401).json({ error: "Invalid token" }); }
}

// ── Dashboard ─────────────────────────────────────────────────
app.get("/api/dashboard", auth, (req, res) => {
  const activePolicy = getActivePolicy(req.user.id);
  const policy = getPolicy(req.user.id);
  const claims = db.claims.filter(c => c.userId === req.user.id);
  const payments = db.payments.filter(p => p.userId === req.user.id);
  const activeTriggers = triggers.filter(t => t.active);
  res.json({ user: req.user, policy, claims, payments, activeTriggers, policyActive: !!activePolicy });
});

// ── Create Policy ─────────────────────────────────────────────
app.post("/api/policy/create", auth, async (req, res) => {
  try {
    const existing = getActivePolicy(req.user.id);
    if (existing) return res.status(400).json({ error: "You already have an active policy" });

    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 86400000);
    const premium = await getPremiumEstimate(req.user);

    const policy = {
      id: uuidv4(), userId: req.user.id,
      premium,
      payout: calcPayout(req.user.weeklyIncome),
      weeklyIncome: req.user.weeklyIncome, status: "active",
      startDate: now.toISOString(), endDate: endDate.toISOString(),
      pricingSource: "ai_estimate"
    };
    db.policies.push(policy);
    saveDB(db);
    res.json({ success: true, policy });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/policy", auth, (req, res) => {
  const policy = getPolicy(req.user.id);
  if (!policy) return res.status(404).json({ error: "No policy found" });
  res.json(policy);
});

// ── Premium Calculate ─────────────────────────────────────────
app.post("/api/premium/calculate", async (req, res) => {
  try {
    const { weeklyIncome, city, platform, bts } = req.body;
    if (!weeklyIncome) return res.status(400).json({ error: "weeklyIncome required" });
    const user = { weeklyIncome: Number(weeklyIncome), city: city || "Noida", platform: platform || "zomato", bts: bts ?? 85 };
    const premium = await getPremiumEstimate(user);
    const payout  = calcPayout(user.weeklyIncome);
    res.json({
      premium, payout,
      annualPremium: premium * 52,
      riskLevel: premium > 200 ? "high" : premium > 100 ? "medium" : "low",
      probability: Math.round((premium / (user.weeklyIncome * 0.30)) * 100),
      cityRiskIndex: 0.65,
      btsTier: bts >= 90 ? "elite" : bts >= 70 ? "pro" : "basic",
      source: "ml_service",
      triggersFired: triggers.filter(t => t.active).map(t => t.type),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Triggers ──────────────────────────────────────────────────
app.get("/api/triggers", (req, res) => res.json(triggers));

// ── Claims ────────────────────────────────────────────────────
app.post("/api/claims", auth, (req, res) => {
  try {
    const { triggerId, activityDrop, location } = req.body;
    const policy = getActivePolicy(req.user.id);
    if (!policy) return res.status(400).json({ error: "No active policy. Please create and pay for a policy first." });

    const userClaims = db.claims.filter(c => c.userId === req.user.id);
    if (userClaims.length > 2) return res.status(400).json({ error: "Claim rejected: Duplicate claim detected" });

    const trigger = triggers.find(t => t.id === triggerId && t.active);
    if (!trigger) return res.status(400).json({ error: "No active trigger found" });
    if (activityDrop < 30) return res.status(400).json({ error: "Activity drop must be at least 30%" });

    const claim = { id: uuidv4(), userId: req.user.id, policyId: policy.id, triggerId, triggerType: trigger.type, activityDrop, location, amount: policy.payout, status: "approved", createdAt: new Date().toISOString() };
    db.claims.push(claim);

    const payment = { id: uuidv4(), userId: req.user.id, claimId: claim.id, amount: policy.payout, status: "completed", method: "UPI", processedAt: new Date().toISOString() };
    db.payments.push(payment);
    saveDB(db);

    res.json({ success: true, claim, payment, message: `₹${policy.payout} credited in 87 seconds!` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/claims/auto", auth, (req, res) => {
  try {
    const policy = getActivePolicy(req.user.id);
    if (!policy) return res.status(400).json({ error: "No active policy. Please create and pay for a policy first." });

    const trigger = triggers.find(t => t.active);
    if (!trigger) return res.status(400).json({ error: "No active trigger found" });

    const recentClaim = db.claims.find(c => c.userId === req.user.id && c.triggerId === trigger.id &&
      new Date(c.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000));
    if (recentClaim) {
      const payment = db.payments.find(p => p.claimId === recentClaim.id);
      return res.json({ success: true, claim: recentClaim, payment, message: "A payout has already been processed for this disruption." });
    }

    const claim = {
      id: uuidv4(), userId: req.user.id, policyId: policy.id,
      triggerId: trigger.id, triggerType: trigger.type,
      activityDrop: 45, location: { lat: 0, lng: 0 }, amount: policy.payout,
      status: "approved", createdAt: new Date().toISOString()
    };
    db.claims.push(claim);

    const payment = { id: uuidv4(), userId: req.user.id, claimId: claim.id, amount: policy.payout, status: "completed", method: "UPI", processedAt: new Date().toISOString() };
    db.payments.push(payment);
    saveDB(db);

    res.json({ success: true, claim, payment, message: `₹${policy.payout} automatically credited in 87 seconds!` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/claims", auth, (req, res) => {
  res.json(db.claims.filter(c => c.userId === req.user.id));
});

// ── Payments ──────────────────────────────────────────────────
app.get("/api/payments", auth, (req, res) => {
  res.json(db.payments.filter(p => p.userId === req.user.id));
});


// ── Premium Calculate (used by index.html tool) ───────────────
app.post("/api/premium/calculate", async (req, res) => {
  try {
    const { weeklyIncome, city, platform, bts } = req.body;
    if (!weeklyIncome) return res.status(400).json({ error: "weeklyIncome required" });
    const user = { weeklyIncome: Number(weeklyIncome), city: city || "Noida", platform: platform || "zomato", bts: bts ?? 80 };
    const premium = await getPremiumEstimate(user);
    const payout  = calcPayout(user.weeklyIncome);
    const risk    = premium > 300 ? "high" : premium > 180 ? "medium" : "low";
    res.json({
      premium, payout,
      annualPremium: premium * 52,
      riskLevel: risk,
      probability: Math.round((premium / (user.weeklyIncome * 0.30 * 0.25 * 1.20)) * 20),
      cityRiskIndex: 0.65,
      source: "ml_estimate",
      btsTier: bts >= 80 ? "trusted" : bts >= 60 ? "moderate" : "high_risk"
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Stats ─────────────────────────────────────────────────────
app.get("/api/stats", (req, res) => {
  const totalPaid = db.payments.reduce((s, p) => s + p.amount, 0);
  res.json({
    workersProtected: db.users.length + 47000,
    totalPaidOut: totalPaid + 24000000,
    avgPayoutTime: "87s", uptime: "99.2%",
    activeTriggers: triggers.filter(t => t.active).length,
    totalClaims: db.claims.length + 1200
  });
});

// ── Admin Auth ────────────────────────────────────────────────
const ADMIN_PASSWORD = "ridersaathi@admin";
let adminToken = null;

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong password" });
  adminToken = "admin-" + uuidv4();
  res.json({ token: adminToken });
});

function adminAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token || token !== adminToken) return res.status(401).json({ error: "Unauthorized" });
  next();
}

// ── Admin Routes ──────────────────────────────────────────────
app.get("/api/admin/stats", adminAuth, (req, res) => {
  const totalPaid = db.payments.reduce((s, p) => s + p.amount, 0);
  res.json({
    totalUsers: db.users.length,
    totalClaims: db.claims.length,
    totalPaidOut: totalPaid,
    activeTriggers: triggers.filter(t => t.active).length
  });
});

app.get("/api/admin/claims", adminAuth, (req, res) => {
  const enriched = db.claims.map(c => {
    const hasPolicy   = !!db.policies.find(p => p.id === c.policyId);
    const hasTrigger  = !!triggers.find(t => t.id === c.triggerId);
    const hasActivity = c.activityDrop >= 30;
    const hasGPS      = !!(c.location?.lat && c.location?.lng);
    // Heuristic fraud score: more failures = higher score
    const failCount = [hasPolicy, hasTrigger, hasActivity, hasGPS].filter(v => !v).length;
    const fraudScore = failCount * 25 + (c.activityDrop > 90 ? 20 : 0);
    return {
      ...c,
      fraudScore,
      status: fraudScore > 50 ? "flagged" : (c.status || "approved"),
      checks: { policy: hasPolicy, trigger: hasTrigger, activityDrop: hasActivity, location: hasGPS }
    };
  });
  res.json(enriched);
});

app.get("/api/admin/users", adminAuth, (req, res) => res.json(db.users));

app.get("/api/admin/payments", adminAuth, (req, res) => res.json(db.payments));

app.post("/api/admin/triggers/:id/toggle", adminAuth, (req, res) => {
  const trigger = triggers.find(t => t.id === Number(req.params.id));
  if (!trigger) return res.status(404).json({ error: "Trigger not found" });
  trigger.active = !trigger.active;
  res.json({ success: true, trigger });
});

// ── Start Server ──────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ RiderSaathi backend running on http://localhost:${PORT}`);
  console.log(`💾 Data saved permanently in: database.json`);
  console.log(`👥 Total users: ${db.users.length}`);
});