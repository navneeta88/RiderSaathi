import { useState, useEffect } from "react";
import { Card, Badge, Btn, Alert, Spinner, G } from "../components/UI";
import { apiFetch } from "../App";
import { useAuth } from "../App";
import RazorpayModal from "../components/RazorpayModal";

function formatDate(dateVal) {
  if (!dateVal) return new Date().toLocaleDateString("en-IN");
  const d = new Date(dateVal);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return new Date().toLocaleDateString("en-IN");
  return d.toLocaleDateString("en-IN");
}

function formatEndDate(dateVal) {
  if (!dateVal) return new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-IN");
  const d = new Date(dateVal);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-IN");
  return d.toLocaleDateString("en-IN");
}

export default function CreatePolicyPage({ setPage }) {
  const { user } = useAuth();
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [estimatedPremium, setEstimatedPremium] = useState(0);

  useEffect(() => {
    async function loadData() {
      const [policyData, premiumData] = await Promise.all([
        apiFetch("/policy"),
        apiFetch("/premium/calculate", {
          method: "POST",
          body: JSON.stringify({
            weeklyIncome: user.weeklyIncome,
            city: user.city,
            platform: user.platform,
            bts: user.bts ?? 85
          })
        })
      ]);
      if (!policyData.error) setPolicy(policyData);
      if (!premiumData.error) setEstimatedPremium(premiumData.premium);
      setLoading(false);
    }
    loadData();
  }, [user]);

  async function handleActivateClick() {
    setShowRazorpay(true);
  }

  async function handlePaymentSuccess() {
    setShowRazorpay(false);
    setCreating(true); setMsg(null);
    const data = await apiFetch("/policy/create", { method: "POST" });
    setCreating(false);
    if (data.error) return setMsg({ type: "error", text: data.error });
    setPolicy(data.policy);
    setMsg({ type: "success", text: "✅ Premium paid! Policy is now Active. You are protected." });
  }

  if (!user) { setPage("login"); return null; }
  if (loading) return <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>;

  const fallbackPremium = Math.round((user.weeklyIncome || 0) * 0.30 * 0.25 * 1.20);
  const premium = policy?.premium || estimatedPremium || fallbackPremium;
  const payout = Math.round((user.weeklyIncome || 0) * 0.40);

  const today = new Date().toLocaleDateString("en-IN");
  const nextWeek = new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-IN");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 32px 80px" }}>

      {/* Razorpay Modal */}
      {showRazorpay && (
        <RazorpayModal
          amount={premium}
          onSuccess={handlePaymentSuccess}
          onClose={() => setShowRazorpay(false)}
        />
      )}

      <div className="fadeUp" style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 6 }}>🛡️ Create Policy</h1>
        <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif" }}>Activate your weekly parametric income protection</p>
      </div>

      {msg && <div className="fadeUp" style={{ marginBottom: 20 }}><Alert type={msg.type}>{msg.text}</Alert></div>}

      {policy ? (
        <>
          <Card className="fadeUp2" style={{ marginBottom: 20, borderColor: policy.status === "expired" ? "#ff6b6b44" : "#00ff6444" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontWeight: 700, marginBottom: 4 }}>{policy.status === "expired" ? "Expired Policy" : "Active Policy"}</h2>
                <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
                  Valid: {formatDate(policy.startDate)} → {formatEndDate(policy.endDate)}
                </p>
              </div>
              <Badge color={policy.status === "expired" ? "#ff6b6b" : "#00ff64"}>
                {policy.status === "expired" ? "⚠️ Expired" : "🟢 Active"}
              </Badge>
            </div>
            {policy.status === "expired" && (
              <div style={{ marginTop: 12, color: G.text, fontSize: 13 }}>
                This policy expired on {new Date(policy.endDate).toLocaleDateString("en-IN")}. Renew to continue coverage.
              </div>
            )}
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 24 }}>
            {[
              ["Weekly Premium", `₹${policy.premium}`, G.blue],
              ["Max Payout", `₹${policy.payout}`, "#00ff64"],
              ["Weekly Income", `₹${policy.weeklyIncome?.toLocaleString()}`, "#fff"],
              ["Valid Until", formatEndDate(policy.endDate), "#fff"]
            ].map(([l, v, c]) => (
              <Card key={l} className="fadeUp3">
                <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
                <div style={{ fontSize: "1.3rem", fontWeight: 800, color: c }}>{v}</div>
              </Card>
            ))}
          </div>
          {policy.status === "expired" && (
            <Btn onClick={handleActivateClick} disabled={creating} style={{ width: "100%", padding: "14px", fontSize: 15 }}>
              {creating ? <Spinner /> : `💳 Renew Policy for ₹${premium}`}
            </Btn>
          )}
        </>
      ) : (
        <>
          <Card className="fadeUp2" style={{ marginBottom: 20 }}>
            <h3 style={{ fontWeight: 700, marginBottom: 16 }}>📊 Your Coverage Preview</h3>

            {/* Date preview */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${G.border}`, borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: G.text }}>
              📅 Coverage Period: <strong style={{ color: "#fff" }}>{today}</strong> → <strong style={{ color: "#fff" }}>{nextWeek}</strong>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div style={{ textAlign: "center", background: "rgba(59,91,219,0.1)", border: "1px solid rgba(59,91,219,0.3)", borderRadius: 12, padding: 20 }}>
                <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 12, marginBottom: 6 }}>AI-ESTIMATED WEEKLY PREMIUM</div>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: G.blue }}>₹{premium}</div>
              </div>
              <div style={{ textAlign: "center", background: "rgba(0,255,100,0.08)", border: "1px solid rgba(0,255,100,0.3)", borderRadius: 12, padding: 20 }}>
                <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 12, marginBottom: 6 }}>MAX PAYOUT</div>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "#00ff64" }}>₹{payout}</div>
              </div>
            </div>

            <Btn onClick={handleActivateClick} disabled={creating} style={{ width: "100%", padding: "14px", fontSize: 15 }}>
              {creating ? <Spinner /> : `💳 Pay ₹${premium} & Activate Policy`}
            </Btn>

            <div style={{ textAlign: "center", marginTop: 12, color: G.text, fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
              🔒 Secured by Razorpay · Pay premium to activate coverage
            </div>
          </Card>
        </>
      )}

      {/* Formula */}
      <Card className="fadeUp4">
        <h3 style={{ fontWeight: 700, marginBottom: 16 }}>📐 Premium Formula</h3>
        <div style={{ fontFamily: "'DM Sans',sans-serif", color: G.text, lineHeight: 2.2, fontSize: 14 }}>
          {[
            ["Formula", "Income × 30% × 25% × 1.20"],
            ["Your Income", `₹${user.weeklyIncome?.toLocaleString()}/week`],
            ["Risk Loss %", "30% of income"],
            ["Probability", "25% (1 in 4 weeks)"],
            ["Margin", "20% (platform cost)"],
            ["Your Premium", `₹${premium}/week`, G.blue],
            ["Your Max Payout (40%)", `₹${payout}`, "#00ff64"]
          ].map(([l, v, c]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${G.border}`, padding: "4px 0" }}>
              <span>{l}</span>
              <span style={{ color: c || "#fff", fontWeight: c ? 700 : 400 }}>{v}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}