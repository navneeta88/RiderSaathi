import { useState } from "react";

const G = {
  blue: "#3B5BDB", green: "#00ff64", dark: "#0a0a0a",
  border: "rgba(255,255,255,0.1)", text: "rgba(255,255,255,0.6)",
};

const rzpCSS = `
@keyframes slideUp {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes success {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
.rzp-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.75);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999; animation: fadeIn 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
.rzp-modal {
  background: #fff; border-radius: 8px; width: 380px; max-width: 95vw;
  overflow: hidden; animation: slideUp 0.3s ease;
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}
.rzp-header {
  background: #2d85f0; padding: 16px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.rzp-body { padding: 20px; }
.rzp-tab { display: flex; border-bottom: 2px solid #e8e8e8; margin-bottom: 20px; }
.rzp-tab-item {
  padding: 10px 16px; font-size: 13px; font-weight: 600;
  cursor: pointer; border-bottom: 2px solid transparent;
  margin-bottom: -2px; color: #666; transition: all 0.2s;
}
.rzp-tab-item.active { color: #2d85f0; border-bottom-color: #2d85f0; }
.rzp-input {
  width: 100%; border: 1.5px solid #e0e0e0; border-radius: 6px;
  padding: 12px 14px; font-size: 14px; margin-bottom: 14px;
  outline: none; transition: border-color 0.2s; box-sizing: border-box;
  color: #333;
}
.rzp-input:focus { border-color: #2d85f0; }
.rzp-btn {
  width: 100%; background: #2d85f0; color: #fff;
  border: none; border-radius: 6px; padding: 14px;
  font-size: 15px; font-weight: 600; cursor: pointer;
  transition: background 0.2s; margin-top: 4px;
}
.rzp-btn:hover { background: #1a6fd4; }
.rzp-btn:disabled { background: #aaa; cursor: not-allowed; }
.upi-app {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px;
  border: 1.5px solid #e0e0e0; border-radius: 8px; margin-bottom: 10px;
  cursor: pointer; transition: all 0.2s;
}
.upi-app:hover { border-color: #2d85f0; background: #f0f7ff; }
.upi-app.selected { border-color: #2d85f0; background: #f0f7ff; }
`;

function RazorpayModal({ amount, onSuccess, onClose }) {
  const [tab, setTab] = useState("upi");
  const [selectedUPI, setSelectedUPI] = useState(null);
  const [upiId, setUpiId] = useState("");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const upiApps = [
    { id: "gpay", name: "Google Pay", icon: "🟢", color: "#4285F4" },
    { id: "phonepe", name: "PhonePe", icon: "🟣", color: "#5f259f" },
    { id: "paytm", name: "Paytm", icon: "🔵", color: "#00BAF2" },
    { id: "bhim", name: "BHIM UPI", icon: "🟠", color: "#FF6B00" },
  ];

  async function handlePay() {
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setLoading(false);
    setSuccess(true);
    setTimeout(() => onSuccess(), 1500);
  }

  if (success) return (
    <div className="rzp-overlay">
      <style>{rzpCSS}</style>
      <div className="rzp-modal" style={{ padding: 48, textAlign: "center" }}>
        <div style={{ fontSize: 72, animation: "success 0.5s ease", display: "inline-block", marginBottom: 16 }}>✅</div>
        <h2 style={{ color: "#2d85f0", marginBottom: 8, fontWeight: 700 }}>Payment Successful!</h2>
        <p style={{ color: "#666", fontSize: 14, marginBottom: 8 }}>₹{amount} has been credited</p>
        <p style={{ color: "#999", fontSize: 13 }}>Transaction ID: rzp_{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
      </div>
    </div>
  );

  return (
    <div className="rzp-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <style>{rzpCSS}</style>
      <div className="rzp-modal">

        {/* Header */}
        <div className="rzp-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛡️</div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>RiderSaathi Insurance</div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>Claim Payout</div>
            </div>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>₹{amount}</div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 18, float: "right" }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="rzp-body">
          {/* Tabs */}
          <div className="rzp-tab">
            {[["upi", "💳 UPI"], ["card", "🏦 Card"], ["netbanking", "🌐 NetBanking"], ["wallet", "👛 Wallet"]].map(([id, label]) => (
              <div key={id} className={`rzp-tab-item ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</div>
            ))}
          </div>

          {/* UPI Tab */}
          {tab === "upi" && (
            <div>
              <p style={{ color: "#666", fontSize: 13, marginBottom: 14 }}>Pay using UPI apps</p>
              {upiApps.map(app => (
                <div key={app.id} className={`upi-app ${selectedUPI === app.id ? "selected" : ""}`} onClick={() => setSelectedUPI(app.id)}>
                  <span style={{ fontSize: 24 }}>{app.icon}</span>
                  <span style={{ fontWeight: 600, color: "#333", fontSize: 14 }}>{app.name}</span>
                  {selectedUPI === app.id && <span style={{ marginLeft: "auto", color: "#2d85f0" }}>✓</span>}
                </div>
              ))}
              <div style={{ margin: "16px 0", textAlign: "center", color: "#999", fontSize: 13 }}>— OR —</div>
              <input className="rzp-input" placeholder="Enter UPI ID (e.g. name@upi)" value={upiId} onChange={e => setUpiId(e.target.value)} />
              <button className="rzp-btn" onClick={handlePay} disabled={loading || (!selectedUPI && !upiId)}>
                {loading ? "Processing..." : `Pay ₹${amount}`}
              </button>
            </div>
          )}

          {/* Card Tab */}
          {tab === "card" && (
            <div>
              <input className="rzp-input" placeholder="Card Number" maxLength={19}
                value={card.number} onChange={e => setCard({ ...card, number: e.target.value.replace(/\D/g, "").replace(/(\d{4})/g, "$1 ").trim() })} />
              <input className="rzp-input" placeholder="Cardholder Name" value={card.name} onChange={e => setCard({ ...card, name: e.target.value })} />
              <div style={{ display: "flex", gap: 10 }}>
                <input className="rzp-input" placeholder="MM/YY" maxLength={5} style={{ flex: 1 }}
                  value={card.expiry} onChange={e => setCard({ ...card, expiry: e.target.value })} />
                <input className="rzp-input" placeholder="CVV" maxLength={3} style={{ flex: 1 }}
                  value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value })} />
              </div>
              <button className="rzp-btn" onClick={handlePay} disabled={loading || !card.number || !card.name}>
                {loading ? "Processing..." : `Pay ₹${amount}`}
              </button>
            </div>
          )}

          {/* NetBanking Tab */}
          {tab === "netbanking" && (
            <div>
              <p style={{ color: "#666", fontSize: 13, marginBottom: 14 }}>Select your bank</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[["🏦", "SBI"], ["🏦", "HDFC"], ["🏦", "ICICI"], ["🏦", "Axis"], ["🏦", "Kotak"], ["🏦", "PNB"]].map(([icon, bank]) => (
                  <div key={bank} onClick={() => setSelectedUPI(bank)}
                    style={{ padding: "12px", border: `1.5px solid ${selectedUPI === bank ? "#2d85f0" : "#e0e0e0"}`, borderRadius: 8, textAlign: "center", cursor: "pointer", background: selectedUPI === bank ? "#f0f7ff" : "#fff", fontSize: 13, fontWeight: 600, color: "#333" }}>
                    {icon} {bank}
                  </div>
                ))}
              </div>
              <button className="rzp-btn" onClick={handlePay} disabled={loading || !selectedUPI}>
                {loading ? "Processing..." : `Pay ₹${amount}`}
              </button>
            </div>
          )}

          {/* Wallet Tab */}
          {tab === "wallet" && (
            <div>
              {[["🔵", "Paytm Wallet"], ["🟢", "Amazon Pay"], ["🟠", "Mobikwik"], ["🔴", "Freecharge"]].map(([icon, wallet]) => (
                <div key={wallet} className={`upi-app ${selectedUPI === wallet ? "selected" : ""}`} onClick={() => setSelectedUPI(wallet)}>
                  <span style={{ fontSize: 24 }}>{icon}</span>
                  <span style={{ fontWeight: 600, color: "#333", fontSize: 14 }}>{wallet}</span>
                  {selectedUPI === wallet && <span style={{ marginLeft: "auto", color: "#2d85f0" }}>✓</span>}
                </div>
              ))}
              <button className="rzp-btn" style={{ marginTop: 16 }} onClick={handlePay} disabled={loading || !selectedUPI}>
                {loading ? "Processing..." : `Pay ₹${amount}`}
              </button>
            </div>
          )}

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: 16, color: "#999", fontSize: 11 }}>
            🔒 Secured by <strong style={{ color: "#2d85f0" }}>Razorpay</strong> · 256-bit SSL Encryption
          </div>
        </div>
      </div>
    </div>
  );
}

export default RazorpayModal;
