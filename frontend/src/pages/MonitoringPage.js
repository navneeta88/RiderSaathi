import { useState, useEffect } from "react";
import { Card, Badge, Spinner, G } from "../components/UI";
import { apiFetch } from "../App";

const colors = { Rainfall: "#4dabf7", Temperature: "#ff6b6b", AQI: "#adb5bd", Curfew: "#845ef7" };
const icons = { Rainfall: "🌧️", Temperature: "🔥", AQI: "🌫️", Curfew: "🚫" };
const units = { Rainfall: "mm", Temperature: "°C", AQI: "AQI", Curfew: "" };

export default function MonitoringPage({ setPage }) {
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    apiFetch("/triggers").then(t => { setTriggers(t); setLoading(false); });
    const interval = setInterval(() => {
      apiFetch("/triggers").then(t => { setTriggers(t); setLastUpdated(new Date()); });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>;

  const active = triggers.filter(t => t.active);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 32px 80px" }}>
      <div className="fadeUp" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 6 }}>⚡ Live Disruption Monitoring</h1>
          <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif" }}>Real-time parametric triggers · Updated every 30s</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <Badge color={active.length > 0 ? "#ff6b6b" : "#00ff64"}>
            {active.length > 0 ? `🔴 ${active.length} ACTIVE` : "🟢 All Clear"}
          </Badge>
          <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 11, marginTop: 6 }}>
            Updated: {lastUpdated.toLocaleTimeString("en-IN")}
          </p>
        </div>
      </div>

      {/* Trigger Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20, marginBottom: 36 }}>
        {triggers.map(t => (
          <Card key={t.id} className="fadeUp2" style={{ borderColor: t.active ? `${colors[t.type]}55` : G.border, transition: "border-color 0.3s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ fontSize: 36 }}>{icons[t.type]}</div>
              <Badge color={t.active ? "#ff6b6b" : "#666"}>{t.active ? "🔴 LIVE" : "Inactive"}</Badge>
            </div>
            <h3 style={{ fontWeight: 700, marginBottom: 4 }}>{t.type}</h3>
            <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 13, marginBottom: 4 }}>
              Triggers at: <strong style={{ color: "#fff" }}>{t.condition}</strong>
            </div>
            <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 13, marginBottom: 16 }}>Impact: {t.impact}</div>
            {t.value > 0 && (
              <div style={{ background: t.active ? `${colors[t.type]}15` : "rgba(255,255,255,0.03)", border: `1px solid ${t.active ? `${colors[t.type]}44` : G.border}`, borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ color: G.text, fontSize: 10, fontFamily: "'DM Sans',sans-serif", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Current Reading</div>
                <div style={{ fontWeight: 800, fontSize: "1.5rem", color: t.active ? colors[t.type] : "#fff" }}>
                  {t.value} {units[t.type]}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Fraud Detection */}
      <Card className="fadeUp3" style={{ marginBottom: 24 }}>
        <h2 style={{ fontWeight: 700, marginBottom: 20 }}>🤖 AI Fraud Detection System</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, fontFamily: "'DM Sans',sans-serif" }}>
          {[["📍 GPS Verification", "Every claim cross-checks your real-time GPS against active disruption zones (5km radius)."],
            ["📉 Activity Validation", "AI verifies actual delivery activity dropped during the event (min 30% drop required)."],
            ["🔁 Duplicate Prevention", "Rule-based detection flags repeated claims from the same user or location cluster."]
          ].map(([title, desc]) => (
            <div key={title} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: "#fff" }}>{title}</div>
              <div style={{ color: G.text, fontSize: 13, lineHeight: 1.7 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* System Status */}
      <Card className="fadeUp4">
        <h2 style={{ fontWeight: 700, marginBottom: 16 }}>🖥️ System Status</h2>
        <div style={{ fontFamily: "'DM Sans',sans-serif" }}>
          {[["API Server", "Operational", "#00ff64"], ["Trigger Engine", "Running", "#00ff64"], ["Fraud Detection", "Active", "#00ff64"], ["Payout System", "Ready", "#00ff64"]].map(([s, status, c]) => (
            <div key={s} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${G.border}` }}>
              <span style={{ color: G.text }}>{s}</span>
              <Badge color={c}>{status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
