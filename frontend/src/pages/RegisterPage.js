import { useState, useEffect } from "react";
import { Btn, Card, Alert, Input, Select, Spinner, G } from "../components/UI";
import { apiFetch } from "../App";

const CITIES = ["Delhi", "Mumbai", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Jaipur", "Lucknow", "Ahmedabad"];

const PLATFORMS = ["Zomato", "Swiggy", "Blinkit", "Zepto", "Amazon Flex", "Dunzo", "BigBasket", "Porter"];

const namePlaceholders = [
  "Full Name",
  "e.g. Rahul Sharma"
];
const phonePlaceholders = [
  "e.g. 9876543210",
  "10-digit mobile number"
];

export default function RegisterPage({ setPage, onLogin }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", platform: "Zomato", weeklyIncome: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [aiPremium, setAiPremium] = useState(0);
  const [aiPayout, setAiPayout] = useState(0);
  const [namePH, setNamePH] = useState(namePlaceholders[0]);
  const [phonePH, setPhonePH] = useState(phonePlaceholders[0]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const fallbackPremium = form.weeklyIncome ? Math.round(form.weeklyIncome * 0.30 * 0.25 * 1.20) : 0;
  const premium = aiPremium || fallbackPremium;
  const payout  = aiPayout || (form.weeklyIncome ? Math.round(form.weeklyIncome * 0.40) : 0);

  useEffect(() => {
    const i = setInterval(() => {
      setNamePH(namePlaceholders[Math.floor(Math.random() * namePlaceholders.length)]);
      setPhonePH(phonePlaceholders[Math.floor(Math.random() * phonePlaceholders.length)]);
    }, 3000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadEstimate() {
      if (!form.weeklyIncome) {
        setAiPremium(0);
        setAiPayout(0);
        return;
      }
      const body = {
        weeklyIncome: Number(form.weeklyIncome),
        city: form.city || "Delhi",
        platform: form.platform || "Zomato",
        bts: 85
      };
      const result = await apiFetch("/premium/calculate", { method: "POST", body: JSON.stringify(body) });
      if (!active) return;
      if (!result.error) {
        setAiPremium(result.premium || 0);
        setAiPayout(result.payout || Math.round(Number(form.weeklyIncome) * 0.40));
      }
    }
    loadEstimate();
    return () => { active = false; };
  }, [form.weeklyIncome, form.city, form.platform]);

  async function submit() {
    setError(""); setLoading(true);
    const data = await apiFetch("/register", { method: "POST", body: JSON.stringify(form) });
    setLoading(false);
    if (data.error) return setError(data.error);
    localStorage.setItem("rs_token", data.token);
    onLogin(data.user);
    setSuccess(true);
    setTimeout(() => setPage("dashboard"), 1800);
  }

  const dropdownStyle = {
    width: "100%", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
    padding: "12px 16px", color: "#fff", fontSize: 14,
    fontFamily: "'DM Sans',sans-serif", outline: "none",
    boxSizing: "border-box", cursor: "pointer",
    appearance: "none", WebkitAppearance: "none",
  };

  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
    padding: "12px 16px", color: "#fff", fontSize: 14,
    fontFamily: "'DM Sans',sans-serif", outline: "none",
    boxSizing: "border-box",
  };

  if (success) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card className="fadeUp" style={{ textAlign: "center", padding: 48, maxWidth: 400 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontWeight: 800, marginBottom: 8 }}>You're Registered!</h2>
        <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif" }}>Redirecting to Dashboard...</p>
      </Card>
    </div>
  );

  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: 500 }}>

        <div className="fadeUp" style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🛡️</div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800 }}>Create Your Account</h1>
          <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", marginTop: 8 }}>Get protected in 2 minutes</p>
        </div>

        <Card className="fadeUp2">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {error && <Alert type="error">{error}</Alert>}

            {/* Name */}
            <div>
              <label style={{ color: G.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 6 }}>Full Name *</label>
              <input
                autoComplete="off"
                placeholder={namePH}
                value={form.name}
                onChange={set("name")}
                style={inputStyle}
              />
            </div>

            {/* Phone */}
            <div>
              <label style={{ color: G.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 6 }}>Phone Number *</label>
              <input
                type="tel"
                autoComplete="off"
                placeholder={phonePH}
                value={form.phone}
                onChange={set("phone")}
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <Input label="Email" type="email" autoComplete="off" placeholder="name@example.com" value={form.email} onChange={set("email")} />

            {/* City Dropdown */}
            <div>
              <label style={{ color: G.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 6 }}>City</label>
              <div style={{ position: "relative" }}>
                <select value={form.city} onChange={set("city")} style={dropdownStyle}>
                  <option value="" disabled style={{ background: "#1a1a2e" }}>📍 Select your city...</option>
                  {CITIES.map(city => (
                    <option key={city} value={city} style={{ background: "#1a1a2e" }}>{city}</option>
                  ))}
                </select>
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: G.text }}>▾</span>
              </div>
            </div>

            {/* Platform Dropdown */}
            <div>
              <label style={{ color: G.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 6 }}>Delivery Platform</label>
              <div style={{ position: "relative" }}>
                <select value={form.platform} onChange={set("platform")} style={dropdownStyle}>
                  {PLATFORMS.map(p => (
                    <option key={p} value={p} style={{ background: "#1a1a2e" }}>{p}</option>
                  ))}
                </select>
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: G.text }}>▾</span>
              </div>
            </div>

            {/* Weekly Income */}
            <div>
              <label style={{ color: G.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 6 }}>Weekly Income (₹) *</label>
              <input
                type="number"
                autoComplete="off"
                placeholder="e.g. 4000"
                value={form.weeklyIncome}
                onChange={set("weeklyIncome")}
                style={inputStyle}
              />
              {form.weeklyIncome > 0 && (
                <div style={{ marginTop: 8, padding: "8px 12px", background: "rgba(59,91,219,0.1)", border: "1px solid rgba(59,91,219,0.3)", borderRadius: 8, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                  <span style={{ color: "#5C7CFA", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>💳 AI-estimated Premium: ₹{premium}/week</span>
                  <span style={{ color: "#00ff64", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>🎯 Max Payout: ₹{payout}</span>
                </div>
              )}
            </div>

            <Btn onClick={submit} disabled={loading || !form.name || !form.phone || !form.weeklyIncome} style={{ width: "100%", padding: "14px", marginTop: 4 }}>
              {loading ? <Spinner /> : "🛡️ Register & Get Protected"}
            </Btn>

            <p style={{ textAlign: "center", color: G.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
              Already registered?{" "}
              <span onClick={() => setPage("login")} style={{ color: "#3B5BDB", cursor: "pointer", fontWeight: 600 }}>Login here</span>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}