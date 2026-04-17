import { useState, useEffect } from "react";
import { Card, Badge, Btn, Alert, Spinner, G } from "../components/UI";
import { apiFetch } from "../App";
import { useAuth } from "../App";

export default function ClaimPage({ setPage }) {
  const { user } = useAuth();
  const [claims, setClaims] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [recentClaim, setRecentClaim] = useState(null);

  useEffect(() => {
    if (!user) { setPage("login"); return; }
    Promise.all([apiFetch("/claims"), apiFetch("/triggers")]).then(([c, t]) => {
      setClaims(Array.isArray(c) ? c : []);
      setTriggers(Array.isArray(t) ? t.filter(tr => tr.active) : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!loading && triggers.length > 0) {
      processAutoClaim();
    }
  }, [loading, triggers]);

  async function processAutoClaim() {
    if (autoProcessing) return;
    setAutoProcessing(true);
    setMsg(null);
    setRecentClaim(null);

    const data = await apiFetch("/claims/auto", { method: "POST" });
    setAutoProcessing(false);

    if (data.error) return setMsg({ type: "error", text: data.error });

    setMsg({ type: "success", text: data.message || `✅ Claim approved! ₹${data.claim.amount} credited to your UPI by RiderSaathi.` });
    setClaims(prev => [data.claim, ...prev]);
    setRecentClaim(data.claim);
  }

  if (loading) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 32px 80px" }}>

      <div className="fadeUp" style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 6 }}>📋 Claims</h1>
        <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif" }}>File a claim and receive payout in 87 seconds</p>
      </div>

      {/* Auto Claim Processing */}
      <Card className="fadeUp2" style={{ marginBottom: 32 }}>
        <h2 style={{ fontWeight: 700, marginBottom: 20 }}>⚡ Automatic Claim Processing</h2>
        {msg && <div style={{ marginBottom: 16 }}><Alert type={msg.type}>{msg.text}</Alert></div>}

        {triggers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>😌</div>
            <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif" }}>No active disruptions right now. You're good to work!</p>
            <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 13, marginTop: 8 }}>RiderSaathi will process payouts automatically when a covered disruption is detected.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Alert type="success">⚡ Active disruptions detected! RiderSaathi is automatically checking your eligibility.</Alert>
            <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
              No action is required from you. If your policy is active and you qualify, the system will create the claim and credit your UPI automatically.
            </p>
            {autoProcessing && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: G.text, fontFamily: "'DM Sans',sans-serif" }}>
                <Spinner /> <span>Checking disruption eligibility...</span>
              </div>
            )}
          </div>
        )}
      </Card>

      {recentClaim && (
        <Card className="fadeUp2 payment-approved-card" style={{ marginBottom: 32 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 16 }}>✅ Latest Auto-Claim Created</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>₹{recentClaim.amount}</div>
              <div style={{ color: G.text, fontSize: 14, marginBottom: 6 }}>{recentClaim.triggerType} disruption auto-validated</div>
              <div style={{ color: G.text, fontSize: 13, marginBottom: 4 }}>Claim ID: {recentClaim.id}</div>
              <div style={{ color: G.text, fontSize: 13, marginBottom: 4 }}>Date: {new Date(recentClaim.createdAt).toLocaleString("en-IN")}</div>
              <div style={{ color: G.text, fontSize: 13 }}>Location: {recentClaim.location?.lat?.toFixed(4)}, {recentClaim.location?.lng?.toFixed(4)}</div>
            </div>
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
              <div className="gpay-checkmark">
                <svg viewBox="0 0 64 64" width="64" height="64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#00ff64" strokeWidth="4" />
                  <path d="M18 34 L28 44 L46 22" fill="none" stroke="#00ff64" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <Badge color="#00ff64">PAID OUT</Badge>
              <div style={{ marginTop: 4, color: G.text, fontSize: 13 }}>Paid directly to your UPI.</div>
            </div>
          </div>
        </Card>
      )}

      {/* Claim History */}
      <div className="fadeUp3">
        <h2 style={{ fontWeight: 700, marginBottom: 16 }}>📜 Claim History</h2>
        {claims.length === 0
          ? <Card style={{ textAlign: "center", padding: 40 }}>
              <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif" }}>No claims filed yet.</p>
            </Card>
          : claims.map(c => (
            <Card key={c.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {c.triggerType === "Rainfall" ? "🌧️" : c.triggerType === "Temperature" ? "🔥" : c.triggerType === "AQI" ? "🌫️" : "🚫"} {c.triggerType} Disruption
                  </div>
                  <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>
                    Activity drop: {c.activityDrop}% · {new Date(c.createdAt).toLocaleString("en-IN")}
                  </div>
                  <div style={{ color: "#00ff64", fontFamily: "'DM Sans',sans-serif", fontSize: 12, marginTop: 2 }}>
                    💸 Paid by RiderSaathi directly to your UPI
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: 20 }}>₹{c.amount}</span>
                  <Badge color="#00ff64">✅ Paid</Badge>
                </div>
              </div>
            </Card>
          ))
        }
      </div>
    </div>
  );
}