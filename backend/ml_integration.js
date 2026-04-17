// ml_integration.js
// Drop this file into your backend/ folder.
// It replaces the hardcoded /api/premium/calculate route in server.js
// with one that calls the Python ML service.
//
// HOW TO USE:
// 1. Start the Python ML service:  cd ml_service && python app.py
// 2. In server.js, replace the existing /api/premium/calculate handler
//    with the mlPremiumRouter exported here.
//
// Or simply copy-paste the single route handler below into server.js.

const express = require("express");
const router  = express.Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

/**
 * Helper: call the Python ML Flask service.
 * Falls back to the legacy formula if the service is unreachable.
 */
async function callMLService(payload) {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(3000),          // 3s timeout
    });
    if (!res.ok) throw new Error(`ML service HTTP ${res.status}`);
    return { ok: true, data: await res.json() };
  } catch (err) {
    console.warn("[ML Service] Unreachable, using fallback:", err.message);
    return { ok: false };
  }
}

/** Legacy formula fallback (original server.js logic) */
function legacyPremium(weeklyIncome) {
  return {
    weeklyIncome,
    premium:     Math.round(weeklyIncome * 0.30 * 0.25 * 1.20),
    payout:      Math.round(weeklyIncome * 0.40),
    riskScore:   Math.round(Math.random() * 30 + 50),
    lossPercent: 30,
    probability: 25,
    margin:      20,
    source:      "legacy_formula",
  };
}

/**
 * POST /api/premium/calculate
 *
 * Body (all optional except weeklyIncome):
 * {
 *   weeklyIncome   : number   (required)
 *   city           : string   e.g. "Delhi"
 *   platform       : string   e.g. "zomato"
 *   bts            : number   0–100 behavioral trust score
 *   rainfall_mm    : number
 *   temperature_c  : number
 *   aqi            : number
 *   curfew_active  : boolean
 *   hour_of_day    : number   0–23
 *   day_of_week    : number   0–6
 * }
 */
router.post("/api/premium/calculate", async (req, res) => {
  const { weeklyIncome, city, platform, bts = 85, ...envInputs } = req.body;

  if (!weeklyIncome || isNaN(Number(weeklyIncome))) {
    return res.status(400).json({ error: "weekly_income is required and must be a number" });
  }

  const income = Number(weeklyIncome);

  // Build ML payload
  const mlPayload = {
    weekly_income:  income,
    city:           city    || "Noida",
    platform:       platform|| "zomato",
    bts:            Number(bts),
    rainfall_mm:    Number(envInputs.rainfall_mm   ?? 10),
    temperature_c:  Number(envInputs.temperature_c ?? 33),
    aqi:            Number(envInputs.aqi            ?? 120),
    curfew_active:  Boolean(envInputs.curfew_active),
    hour_of_day:    Number(envInputs.hour_of_day   ?? 13),
    day_of_week:    Number(envInputs.day_of_week   ?? 2),
  };

  const mlResult = await callMLService(mlPayload);

  if (mlResult.ok) {
    const ml = mlResult.data;
    // Merge ML output into the shape the frontend already expects
    return res.json({
      weeklyIncome:        income,
      premium:             ml.premium.final_premium_inr,
      payout:              ml.premium.expected_payout_inr,
      riskScore:           ml.risk.risk_probability,
      lossPercent:         ml.risk.income_loss_pct,
      probability:         ml.risk.risk_probability,
      margin:              20,
      city,
      platform,
      annualPremium:       ml.premium.final_premium_inr * 52,
      riskLevel:           ml.risk.risk_level,
      triggersFired:       ml.risk.triggers_fired,
      cityRiskIndex:       ml.risk.city_risk_index,
      btsTier:             ml.formula.bts_tier,
      rawRiskPremium:      ml.premium.raw_risk_premium,
      source:              "ml_model",
      modelMetrics: {
        r2:  0.785,
        mae: 0.0545,
      },
    });
  }

  // Fallback if ML service is down
  return res.json(legacyPremium(income));
});

module.exports = router;

/*
──────────────────────────────────────────────────────────────────
 HOW TO WIRE INTO server.js
──────────────────────────────────────────────────────────────────

1. At the top of server.js, add:
      const mlRouter = require('./ml_integration');

2. After `app.use(express.json())`, add:
      app.use(mlRouter);

3. Delete (or comment out) the existing:
      app.post("/api/premium/calculate", (req, res) => { ... });

4. Start Python service first:
      cd ml_service && python app.py

5. Then start Node backend as usual:
      node server.js
──────────────────────────────────────────────────────────────────
*/