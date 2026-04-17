import { useState } from "react";
import { Card, Btn, Alert, Input, Select, Spinner, G } from "../components/UI";
import { apiFetch } from "../App";

export default function PremiumPage({ setPage }) {
  const [form, setForm] = useState({ weeklyIncome: 4000, city: "Delhi", platform: "Zomato" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = k => e => setForm({ ...form, [k]: e.target.value });

  async function calculate() {
    setLoading(true);
    const data = await apiFetch("/premium/calculate", { method: "POST", body: JSON.stringify(form) });
    setLoading(false);
    setResult(data);
  }

  const sliderPremium = Math.round(form.weeklyIncome * 0.30 * 0.25 * 1.20);
  const sliderPayout = Math.round(form.weeklyIncome * 0.40);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 32px 80px" }}>
      <div className="fadeUp" style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 6 }}>🤖 AI Premium Calculator</h1>
        <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif" }}>Get your personalized risk assessment and premium instantly</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, flexWrap: "wrap" }}>
        {/* Input */}
        <Card className="fadeUp2">
          <h3 style={{ fontWeight: 700, marginBottom: 20 }}>Your Details</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ color: G.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 8 }}>
                Weekly Income: <strong style={{ color: "#fff" }}>₹{Number(form.weeklyIncome).toLocaleString()}</strong>
              </label>
              <input type="range" min={1000} max={15000} step={100} value={form.weeklyIncome}
                onChange={set("weeklyIncome")}
                style={{ width: "100%", accentColor: G.blue, height: 6 }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ color: G.text, fontSize: 11, fontFamily: "'DM Sans',sans-serif" }}>₹1,000</span>
                <span style={{ color: G.text, fontSize: 11, fontFamily: "'DM Sans',sans-serif" }}>₹15,000</span>
              </div>
            </div>
            <Select label="Platform" value={form.platform} onChange={set("platform")}
              options={["Zomato", "Swiggy", "Blinkit", "Zepto", "Amazon Flex", "Dunzo", "Porter"].map(p => ({ value: p, label: p }))} />
            <Input label="City" placeholder="Delhi" value={form.city} onChange={set("city")} />
            <Btn onClick={calculate} disabled={loading} style={{ width: "100%", padding: "13px" }}>
              {loading ? <Spinner /> : "🤖 Calculate My Premium"}
            </Btn>
          </div>
        </Card>

        {/* Live Preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card className="fadeUp3" style={{ textAlign: "center" }}>
            <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Weekly Premium</div>
            <div style={{ fontSize: "2.8rem", fontWeight: 800, color: G.blue }}>₹{sliderPremium}</div>
            <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 12, marginTop: 4 }}>≈ ₹{(sliderPremium * 52).toLocaleString()}/year</div>
          </Card>
          <Card className="fadeUp3" style={{ textAlign: "center" }}>
            <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Max Payout Per Claim</div>
            <div style={{ fontSize: "2.8rem", fontWeight: 800, color: "#00ff64" }}>₹{sliderPayout}</div>
            <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 12, marginTop: 4 }}>40% of weekly income</div>
          </Card>
        </div>
      </div>

      {/* AI Result */}
      {result && !result.error && (
        <Card className="fadeUp" style={{ marginTop: 28 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 20 }}>🤖 AI Risk Assessment</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 20 }}>
            {[
              ["Risk Level", result.riskLevel?.toUpperCase() || "N/A", result.riskLevel === "high" ? "#ff6b6b" : result.riskLevel === "medium" ? "#ffa500" : "#00ff64"],
              ["Weekly Premium", `₹${result.premium}/week`, G.blue],
              ["Max Payout", `₹${result.payout}`, "#00ff64"],
              ["Annual Cost", `₹${result.annualPremium?.toLocaleString()}`, "#fff"],
              ["Loss Probability", `${result.probability}%`, result.probability > 50 ? "#ff6b6b" : "#00ff64"],
              ["City Risk Index", result.cityRiskIndex?.toFixed(2), "#fff"]
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 16, textAlign: "center" }}>
                <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: c }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: G.text, lineHeight: 2, borderTop: `1px solid ${G.border}`, paddingTop: 16 }}>
            {[
              ["Weekly Income", `₹${result.weeklyIncome?.toLocaleString()}/week`],
              ["Platform", result.platform],
              ["City", result.city],
              ["Income Loss %", `${result.lossPercent}%`],
              ["BTS Tier", result.btsTier || "N/A"],
              ["Raw Risk Premium", `₹${result.rawRiskPremium}`],
              ["Active Triggers", result.triggersFired?.length ? result.triggersFired.join(", ") : "None"],
              ["Model Source", result.source || "legacy"]
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${G.border}`, padding: "4px 0" }}>
                <span>{l}</span><span style={{ color: "#fff" }}>{v}</span>
              </div>
            ))}
          </div>
          {result.modelMetrics && (
            <div style={{ marginTop: 16, padding: 12, background: "rgba(255,255,255,0.02)", borderRadius: 8, fontSize: 12, color: G.text }}>
              <strong>Model Performance:</strong> R² = {result.modelMetrics.r2}, MAE = {result.modelMetrics.mae}
            </div>
          )}
          <Btn onClick={() => setPage("register")} style={{ marginTop: 20, width: "100%", padding: "13px" }}>
            🛡️ Get This Coverage Now
          </Btn>
        </Card>
      )}
    </div>
  );
}
