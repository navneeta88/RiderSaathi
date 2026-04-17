import { useState, useEffect } from "react";
import { Card, Badge, Spinner, G } from "../components/UI";
import { apiFetch } from "../App";
import { useAuth } from "../App";

export default function PayoutPage({ setPage }) {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setPage("login"); return; }
    apiFetch("/payments").then(d => { setPayments(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  if (loading) return <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner /></div>;

  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 32px 80px" }}>
      <div className="fadeUp" style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 6 }}>💳 Payouts</h1>
        <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif" }}>Track all your insurance payouts</p>
      </div>

      {/* Summary */}
      <div className="fadeUp2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 32 }}>
        {[["💰", "Total Received", `₹${total.toLocaleString()}`, "#00ff64"],
          ["📋", "Total Payouts", payments.length, "#fff"],
          ["⚡", "Avg Payout Time", "87s", G.blue],
          ["✅", "Success Rate", "100%", "#00ff64"]
        ].map(([icon, label, val, c]) => (
          <Card key={label} className="fadeUp2">
            <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
            <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: c }}>{val}</div>
          </Card>
        ))}
      </div>

      {/* How Payout Works */}
      <Card className="fadeUp3" style={{ marginBottom: 28 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 16 }}>⚡ How Payouts Work</h3>
        <div style={{ display: "flex", gap: 0, position: "relative" }}>
          {[["🔍", "Claim Filed", "You submit a claim with activity drop %"],
            ["🤖", "AI Verifies", "GPS + activity validated in seconds"],
            ["✅", "Approved", "Claim auto-approved if checks pass"],
            ["💳", "Paid in 87s", "₹ credited directly to your UPI"]
          ].map(([icon, title, desc], i, arr) => (
            <div key={title} style={{ flex: 1, textAlign: "center", position: "relative" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: G.blue, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, margin: "0 auto 10px" }}>{icon}</div>
              {i < arr.length - 1 && <div style={{ position: "absolute", top: 22, left: "75%", width: "50%", height: 2, background: `${G.blue}44` }} />}
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{title}</div>
              <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 11, lineHeight: 1.5, padding: "0 4px" }}>{desc}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Payment History */}
      <div className="fadeUp4">
        <h2 style={{ fontWeight: 700, marginBottom: 16 }}>📜 Payment History</h2>
        {payments.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 48 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💳</div>
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>No payouts yet</h3>
            <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif" }}>File a claim during a disruption event to receive your first payout.</p>
          </Card>
        ) : (
          payments.map(p => (
            <Card key={p.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(0,255,100,0.15)", border: "1px solid rgba(0,255,100,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>💳</div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 3 }}>Insurance Payout · {p.method}</div>
                    <div style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>
                      {new Date(p.processedAt).toLocaleString("en-IN")} · Processed in 87s
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: 22, color: "#00ff64" }}>+₹{p.amount}</span>
                  <Badge color="#00ff64">✅ Credited</Badge>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Payout Formula */}
      {user && (
        <Card className="fadeUp4" style={{ marginTop: 24 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>💸 Your Payout Formula</h3>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: G.text, lineHeight: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${G.border}`, padding: "4px 0" }}>
              <span>Your Weekly Income</span><span style={{ color: "#fff" }}>₹{user.weeklyIncome?.toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${G.border}`, padding: "4px 0" }}>
              <span>Payout Rate</span><span style={{ color: "#fff" }}>40%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span style={{ fontWeight: 700, color: "#fff" }}>Your Max Payout Per Claim</span>
              <span style={{ fontWeight: 800, color: "#00ff64", fontSize: 16 }}>₹{Math.round(user.weeklyIncome * 0.40).toLocaleString()}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
