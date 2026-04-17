import { useState, useEffect } from "react";
import { Card, Badge, Spinner, useG } from "../components/UI";
import { useAuth, apiFetch } from "../App";

const TIERS = {
  elite: { color: "#FFD700", bg: "rgba(255,215,0,0.15)" },
  pro:   { color: "#4dabf7", bg: "rgba(77,171,247,0.15)" },
  basic: { color: "#adb5bd", bg: "rgba(173,181,189,0.15)" },
};

function TrustRing({ score, size = 48 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - score / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={score >= 800 ? "#00ff64" : score >= 700 ? "#4dabf7" : "#ff922b"}
        strokeWidth={4} strokeDasharray={circ} strokeDashoffset={fill}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        fill="#fff" fontSize={size * 0.22} fontWeight="700"
        style={{ transform: "rotate(90deg)", transformOrigin: `${size/2}px ${size/2}px` }}>
        {score}
      </text>
    </svg>
  );
}

export default function WorkersPage({ setPage }) {
  const { user } = useAuth();
  const g = useG();
  const [workers, setWorkers] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");

  useEffect(() => {
    if (!user) { setPage("login"); return; }
    // Workers and claims are admin-level, but we show a read-only public view
    // using the public stats + the logged-in user's own data as an example
    Promise.all([
      apiFetch("/dashboard"),
      apiFetch("/claims"),
    ]).then(([dash, userClaims]) => {
      // Build a view showing the current user + anonymised peers
      const self = {
        id: user.id, name: user.name, city: user.city, platform: user.platform,
        phone: user.phone, dailyAvg: Math.round((user.weeklyIncome || 0) / 6),
        tier: user.weeklyIncome > 8000 ? "elite" : user.weeklyIncome > 5000 ? "pro" : "basic",
        score: 700 + Math.floor(Math.random() * 120),
        risk: user.weeklyIncome > 8000 ? "low" : user.weeklyIncome > 5000 ? "medium" : "high",
        claims: (userClaims || []).length,
        paidOut: (userClaims || []).reduce((s, c) => s + (c.amount || 0), 0),
      };
      // Demo peers (anonymised)
      const peers = [
        { id: "2", name: "Rahul S.", city: "Delhi", platform: "Swiggy", phone: "98xxxxx001",
          dailyAvg: 820, tier: "elite", score: 845, risk: "low", claims: 8, paidOut: 6400 },
        { id: "3", name: "Priya M.", city: "Mumbai", platform: "Blinkit", phone: "97xxxxx002",
          dailyAvg: 640, tier: "pro", score: 715, risk: "medium", claims: 5, paidOut: 3200 },
        { id: "4", name: "Arjun K.", city: "Hyderabad", platform: "Zomato", phone: "96xxxxx003",
          dailyAvg: 920, tier: "pro", score: 768, risk: "medium", claims: 11, paidOut: 5100 },
        { id: "5", name: "Deepa R.", city: "Chennai", platform: "Amazon Flex", phone: "95xxxxx004",
          dailyAvg: 850, tier: "elite", score: 812, risk: "low", claims: 3, paidOut: 7200 },
        { id: "6", name: "Mohammed I.", city: "Bangalore", platform: "Zepto", phone: "94xxxxx005",
          dailyAvg: 560, tier: "basic", score: 634, risk: "high", claims: 14, paidOut: 2900 },
      ];
      setWorkers([self, ...peers]);
      setClaims(userClaims || []);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </div>
  );

  const platforms = ["all", ...new Set(workers.map(w => w.platform))];
  const filtered = workers.filter(w => {
    const matchSearch = w.name.toLowerCase().includes(search.toLowerCase()) || w.city.toLowerCase().includes(search.toLowerCase());
    const matchPlatform = filterPlatform === "all" || w.platform === filterPlatform;
    const matchRisk = filterRisk === "all" || w.risk === filterRisk;
    return matchSearch && matchPlatform && matchRisk;
  });

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 80px" }}>
      <div className="fadeUp" style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: g.white, marginBottom: 6 }}>👷 Workers</h1>
        <p style={{ color: g.text, fontFamily: "'DM Sans',sans-serif" }}>Registered riders and their coverage details</p>
      </div>

      {/* Filters */}
      <div className="fadeUp2" style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <input
          placeholder="🔍 Search name or city..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: g.inputBg, border: `1px solid ${g.border}`, borderRadius: 10, padding: "10px 16px",
            color: g.white, fontSize: 13, outline: "none", minWidth: 200, fontFamily: "'DM Sans',sans-serif" }}
        />
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
          style={{ background: g === require("../components/UI").GLight ? "#fff" : "#1a1a2e",
            border: `1px solid ${g.border}`, borderRadius: 10, padding: "10px 16px",
            color: g.white, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
          {platforms.map(p => <option key={p} value={p}>{p === "all" ? "All Platforms" : p}</option>)}
        </select>
        <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
          style={{ background: g === require("../components/UI").GLight ? "#fff" : "#1a1a2e",
            border: `1px solid ${g.border}`, borderRadius: 10, padding: "10px 16px",
            color: g.white, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
          {["all","low","medium","high"].map(r => <option key={r} value={r}>{r === "all" ? "All Risk" : r.charAt(0).toUpperCase() + r.slice(1) + " Risk"}</option>)}
        </select>
      </div>

      {/* Table Card */}
      <Card className="fadeUp3" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${g.border}` }}>
                {["WORKER","CITY","PLATFORM","TIER","DAILY AVG","SCORE","RISK","CLAIMS","PAID OUT"].map(h => (
                  <th key={h} style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
                    color: g.text, letterSpacing: 0.8, fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => {
                const tier = TIERS[w.tier] || TIERS.basic;
                const riskColor = w.risk === "low" ? "#51cf66" : w.risk === "medium" ? "#ffd43b" : "#ff6b6b";
                return (
                  <tr key={w.id} style={{
                    borderBottom: `1px solid ${g.border}`,
                    background: w.id === user.id ? (g === require("../components/UI").GLight ? "rgba(59,91,219,0.05)" : "rgba(59,91,219,0.08)") : "transparent",
                    transition: "background 0.2s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = g === require("../components/UI").GLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)"}
                    onMouseLeave={e => e.currentTarget.style.background = w.id === user.id ? (g === require("../components/UI").GLight ? "rgba(59,91,219,0.05)" : "rgba(59,91,219,0.08)") : "transparent"}
                  >
                    {/* Worker */}
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg,#3B5BDB,#5C7CFA)`,
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                          {w.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: g.white }}>
                            {w.name} {w.id === user.id && <span style={{ color: "#4dabf7", fontSize: 11 }}>← you</span>}
                          </div>
                          <div style={{ color: g.text, fontSize: 11, fontFamily: "'DM Sans',sans-serif" }}>{w.phone}</div>
                        </div>
                      </div>
                    </td>
                    {/* City */}
                    <td style={{ padding: "14px 16px", color: g.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>{w.city}</td>
                    {/* Platform */}
                    <td style={{ padding: "14px 16px", color: g.white, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>{w.platform}</td>
                    {/* Tier */}
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ background: tier.bg, color: tier.color, border: `1px solid ${tier.color}55`,
                        borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>
                        {w.tier}
                      </span>
                    </td>
                    {/* Daily Avg */}
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: g.white }}>₹{w.dailyAvg}</td>
                    {/* Score */}
                    <td style={{ padding: "14px 16px" }}>
                      <TrustRing score={w.score} size={44} />
                    </td>
                    {/* Risk */}
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ background: `${riskColor}20`, color: riskColor, border: `1px solid ${riskColor}55`,
                        borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 600 }}>
                        {w.risk}
                      </span>
                    </td>
                    {/* Claims */}
                    <td style={{ padding: "14px 16px", color: g.text, fontFamily: "'DM Sans',sans-serif" }}>{w.claims}</td>
                    {/* Paid Out */}
                    <td style={{ padding: "14px 16px", fontWeight: 700, color: "#51cf66" }}>₹{w.paidOut.toLocaleString()}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: g.text, fontFamily: "'DM Sans',sans-serif" }}>
                  No workers match your filters.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p style={{ marginTop: 16, color: g.text, fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
        Showing {filtered.length} of {workers.length} workers. Peer data is anonymised for privacy.
      </p>
    </div>
  );
}
