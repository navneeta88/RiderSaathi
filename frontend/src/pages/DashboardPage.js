import { useState, useEffect, useRef } from "react";
import { Card, Badge, Btn, Spinner, Alert, useG } from "../components/UI";
import { apiFetch, useAuth } from "../App";

// ── Weather Overlay ────────────────────────────────────────────
function WeatherOverlay({ triggers }) {
  const types = (triggers || []).map(t => (t.type || "").toLowerCase());
  const hasRain = types.some(t => t.includes("rain") || t.includes("rainfall"));
  const hasHeat = types.some(t => t.includes("temp") || t.includes("heat"));
  const hasAQI  = types.some(t => t.includes("aqi") || t.includes("smog") || t.includes("air"));
  const hasCurfew = types.some(t => t.includes("curfew") || t.includes("zone"));

  if (!hasRain && !hasHeat && !hasAQI && !hasCurfew) return null;

  const rainDrops = Array.from({ length: 60 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    animDuration: `${0.5 + Math.random() * 0.6}s`,
    animDelay: `${Math.random() * 2}s`,
    opacity: 0.4 + Math.random() * 0.4,
  }));

  const aqiBlobs = Array.from({ length: 8 }, (_, i) => ({
    left: `${10 + i * 12}%`,
    top: `${Math.random() * 60}%`,
    size: 80 + Math.random() * 120,
    dur: `${6 + Math.random() * 4}s`,
    delay: `${Math.random() * 3}s`,
  }));

  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none", zIndex: 5, overflow: "hidden",
    }}>
      {/* Rain */}
      {hasRain && rainDrops.map((d, i) => (
        <div key={i} style={{
          position: "absolute", left: d.left, top: 0,
          width: 2, height: 18,
          background: "linear-gradient(180deg, rgba(100,160,255,0) 0%, rgba(100,160,255,0.75) 100%)",
          borderRadius: 2,
          animation: `rainDrop ${d.animDuration} ${d.animDelay} linear infinite`,
          opacity: d.opacity,
        }} />
      ))}

      {/* Heat shimmer */}
      {hasHeat && [0,1,2,3].map(i => (
        <div key={i} style={{
          position: "absolute", left: `${i * 25}%`, bottom: 0,
          width: "30%", height: "45%",
          background: "linear-gradient(0deg, rgba(255,100,30,0.18) 0%, rgba(255,140,0,0.06) 60%, transparent 100%)",
          animation: `heatWave ${3 + i * 0.7}s ${i * 0.5}s ease-in-out infinite`,
          borderRadius: "50% 50% 0 0",
          filter: "blur(12px)",
        }} />
      ))}

      {/* AQI smog */}
      {hasAQI && aqiBlobs.map((b, i) => (
        <div key={i} style={{
          position: "absolute", left: b.left, top: b.top,
          width: b.size, height: b.size * 0.5,
          background: "radial-gradient(ellipse, rgba(150,120,60,0.28) 0%, transparent 70%)",
          animation: `aqiDrift ${b.dur} ${b.delay} ease-in-out infinite`,
          filter: "blur(18px)",
          borderRadius: "50%",
        }} />
      ))}

      {/* Curfew dark overlay */}
      {hasCurfew && (
        <div style={{
          position: "absolute", inset: 0,
          background: "repeating-linear-gradient(45deg, rgba(255,80,80,0.03) 0px, rgba(255,80,80,0.03) 2px, transparent 2px, transparent 12px)",
          animation: "pulse 3s ease-in-out infinite",
        }} />
      )}
    </div>
  );
}

export default function DashboardPage({ setPage }) {
  const { user } = useAuth();
  const g = useG();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [animProgress, setAnimProgress] = useState(0);
  const animRef = useRef(null);

  useEffect(() => {
    apiFetch("/dashboard").then(d => { setData(d); setLoading(false); });
  }, []);

  // Animate the graph lines drawing in
  useEffect(() => {
    if (!loading && data) {
      setAnimProgress(0);
      let start = null;
      function step(ts) {
        if (!start) start = ts;
        const p = Math.min(1, (ts - start) / 1200);
        setAnimProgress(p);
        if (p < 1) animRef.current = requestAnimationFrame(step);
      }
      animRef.current = requestAnimationFrame(step);
      return () => cancelAnimationFrame(animRef.current);
    }
  }, [loading, data]);

  if (!user) { setPage("login"); return null; }
  if (loading) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </div>
  );

  const { policy, claims, payments, activeTriggers } = data;
  const totalPaid = payments?.reduce((s, p) => s + p.amount, 0) || 0;
  const actualEarnings = user.weeklyIncome || 0;
  const protectedEarnings = policy ? policy.payout : 0;
  const premiumLabel = policy?.pricingSource === "ai_estimate" ? "AI-priced Premium/Week" : "Premium/Week";

  // ── Graph data ─────────────────────────────────────────────
  // Actual earnings fluctuate realistically around weekly income
  const weeks = ["W1","W2","W3","W4","W5","W6","W7","W8"];
  const actualTrend = [
    actualEarnings * 0.88,
    actualEarnings * 0.62,  // dip (rain / low week)
    actualEarnings * 0.97,
    actualEarnings * 0.70,  // dip
    actualEarnings * 0.92,
    actualEarnings * 0.38,  // big disruption dip
    actualEarnings * 1.02,
    actualEarnings * 0.85,
  ];

  // Protected line = guaranteed floor ≈ 80% of base income (above the dips)
  // This is the "safety net" — it should be ABOVE the low weeks
  const protectedBase = protectedEarnings > 0
    ? Math.max(protectedEarnings, actualEarnings * 0.78)
    : actualEarnings * 0.78;
  const protectedTrend = Array(8).fill(protectedBase);

  const chartMax = Math.max(...actualTrend, protectedBase) * 1.12;
  const chartHeight = 200;
  const chartWidth = 700;
  const xStep = chartWidth / (weeks.length - 1);

  function pointsUpTo(trend, progress) {
    // Return only the visible portion of the line based on animation
    const maxIdx = (weeks.length - 1) * progress;
    return trend.map((value, index) => {
      if (index > maxIdx) return null;
      const x = xStep * index;
      const y = chartHeight - (value / chartMax) * chartHeight;
      return `${x},${y}`;
    }).filter(Boolean).join(" ");
  }

  const actualPoints = pointsUpTo(actualTrend, animProgress);
  const protectedPoints = pointsUpTo(protectedTrend, animProgress);

  const yAxisTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    val: chartMax * f,
    label: `₹${Math.round(chartMax * f / 1000)}k`,
    y: chartHeight - f * chartHeight,
  }));

  const shadeActual = actualTrend.map((v, i) => `${xStep*i},${chartHeight-(v/chartMax)*chartHeight}`).join(" ");
  const shadeProtected = protectedTrend.map((v, i) => `${xStep*i},${chartHeight-(v/chartMax)*chartHeight}`).join(" ");

  const activeTypes = (activeTriggers || []).map(t => t.type);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 80px", position: "relative" }}>
      <WeatherOverlay triggers={activeTriggers} />

      {/* Header */}
      <div className="fadeUp" style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: g.white }}>👋 Hey, {user.name?.split(" ")[0]}!</h1>
        <p style={{ color: g.text, fontFamily: "'DM Sans',sans-serif", marginTop: 4 }}>{user.platform} · {user.city}</p>
      </div>

      {/* Active Disruption Alert */}
      {activeTriggers?.length > 0 && (
        <div className="fadeUp" style={{ marginBottom: 24 }}>
          <Alert type="warning">
            <strong>{activeTriggers.length} active disruption{activeTriggers.length > 1 ? "s" : ""}</strong> in your area —{" "}
            {activeTriggers.map(t => t.type).join(", ")}.
            <span onClick={() => setPage("claim")} style={{ color: "#fff", textDecoration: "underline", cursor: "pointer", marginLeft: 8 }}>File a claim →</span>
          </Alert>
        </div>
      )}

      {/* Stats */}
      <div className="fadeUp2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 28 }}>
        {[
          ["💰","Weekly Income",`₹${user.weeklyIncome?.toLocaleString()}`],
          ["🛡️",premiumLabel,policy ? `₹${policy.premium}` : "No Policy"],
          ["💳","Max Payout",policy ? `₹${policy.payout}` : "—"],
          ["📋","Total Claims",claims?.length || 0],
          ["💸","Total Received",`₹${totalPaid.toLocaleString()}`],
        ].map(([icon,label,val]) => (
          <Card key={label}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
            <div style={{ color: g.text, fontFamily: "'DM Sans',sans-serif", fontSize: 11, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: g.white }}>{val}</div>
          </Card>
        ))}
      </div>

      {/* ── Earnings Graph ────────────────────────────────────── */}
      <div className="fadeUp3" style={{ marginBottom: 28 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ fontWeight: 700, marginBottom: 4, color: g.white }}>Weekly Earnings — Actual vs Protected</h3>
              <p style={{ color: g.text, fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>
                Green dashed = your protected floor. Blue = actual earnings. Gap shows insurance value.
              </p>
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#4dabf7" strokeWidth="2.5" /></svg>
                <span style={{ color: g.text, fontSize: 12 }}>Actual</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="28" height="10">
                  <line x1="0" y1="5" x2="28" y2="5" stroke="#51cf66" strokeWidth="2" strokeDasharray="5 3" />
                </svg>
                <span style={{ color: g.text, fontSize: 12 }}>Protected</span>
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <svg
              viewBox={`-52 -10 ${chartWidth + 70} ${chartHeight + 50}`}
              width="100%"
              style={{ minWidth: 380, display: "block" }}
            >
              <defs>
                <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4dabf7" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#4dabf7" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="gradProtected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#51cf66" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#51cf66" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {yAxisTicks.map(t => (
                <g key={t.label}>
                  <line x1={0} y1={t.y} x2={chartWidth} y2={t.y}
                    stroke={g === useG() ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"}
                    strokeDasharray="4 6" />
                  <text x={-8} y={t.y + 4} textAnchor="end"
                    fill={g.text} fontSize="10">{t.label}</text>
                </g>
              ))}

              {/* Shaded areas (full — always visible) */}
              <polygon
                points={`${shadeProtected} ${chartWidth},${chartHeight} 0,${chartHeight}`}
                fill="url(#gradProtected)" />
              <polygon
                points={`${shadeActual} ${chartWidth},${chartHeight} 0,${chartHeight}`}
                fill="url(#gradActual)" />

              {/* Protected line — dashed green */}
              {protectedPoints && (
                <polyline points={protectedPoints} fill="none"
                  stroke="#51cf66" strokeWidth="2.5" strokeDasharray="7 4" opacity="0.95"
                  style={{ filter: "drop-shadow(0 0 4px rgba(81,207,102,0.5))" }} />
              )}

              {/* Actual line — solid blue */}
              {actualPoints && (
                <polyline points={actualPoints} fill="none"
                  stroke="#4dabf7" strokeWidth="3" opacity="1"
                  style={{ filter: "drop-shadow(0 0 5px rgba(77,171,247,0.6))" }} />
              )}

              {/* Dots on actual */}
              {actualTrend.map((value, index) => {
                if (index > (weeks.length - 1) * animProgress) return null;
                const x = xStep * index;
                const y = chartHeight - (value / chartMax) * chartHeight;
                return (
                  <g key={index}>
                    <circle cx={x} cy={y} r={5} fill="#4dabf7" stroke="#fff" strokeWidth="2"
                      style={{ filter: "drop-shadow(0 0 3px #4dabf7)" }} />
                  </g>
                );
              })}

              {/* Dots on protected */}
              {protectedTrend.map((value, index) => {
                if (index > (weeks.length - 1) * animProgress) return null;
                const x = xStep * index;
                const y = chartHeight - (value / chartMax) * chartHeight;
                return (
                  <circle key={index} cx={x} cy={y} r={3.5}
                    fill="#51cf66" stroke="#0a0a0a" strokeWidth="1" />
                );
              })}

              {/* X-axis labels */}
              {weeks.map((w, i) => (
                <text key={w} x={xStep * i} y={chartHeight + 20}
                  textAnchor="middle" fill={g.text} fontSize="11">{w}</text>
              ))}
            </svg>
          </div>

          {/* Coverage gap callout */}
          {policy && (
            <div style={{ marginTop: 12, padding: "8px 14px", background: "rgba(81,207,102,0.08)", border: "1px solid rgba(81,207,102,0.2)", borderRadius: 10, fontSize: 12, color: "#51cf66", fontFamily: "'DM Sans',sans-serif" }}>
              🛡️ Your policy covers losses below ₹{protectedBase.toLocaleString()} — the dips are insured.
            </div>
          )}
        </Card>
      </div>

      {/* Policy Status */}
      <Card className="fadeUp3" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ fontWeight: 700, marginBottom: 4, color: g.white }}>Policy Status</h3>
            <p style={{ color: g.text, fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
              {policy ? `Valid until ${new Date(policy.endDate).toLocaleDateString("en-IN")}` : "No active policy yet"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {policy ? (
              <Badge color={policy.status === "expired" ? "#ff6b6b" : "#00ff64"}>
                {policy.status === "expired" ? "⚠️ Expired" : "🟢 Active"}
              </Badge>
            ) : (
              <Badge color="#888">⚫ No Policy</Badge>
            )}
            {(!policy || policy.status === "expired") && (
              <Btn onClick={() => setPage("createpolicy")} style={{ padding: "8px 16px", fontSize: 13 }}>
                {policy?.status === "expired" ? "Renew Policy →" : "Create Policy →"}
              </Btn>
            )}
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="fadeUp3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 28 }}>
        {[
          ["📋","Create Policy","Activate weekly coverage","createpolicy"],
          ["🤖","AI Premium","Calculate your risk","premium"],
          ["⚡","Live Triggers","See disruption alerts","monitoring"],
          ["📝","File Claim","Submit for payout","claim"],
          ["💳","View Payouts","Track your payments","payout"],
        ].map(([icon,title,desc,p]) => (
          <Card key={title} style={{ cursor: "pointer" }} onClick={() => setPage(p)}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: g.white }}>{title}</div>
            <div style={{ color: g.text, fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>{desc}</div>
          </Card>
        ))}
      </div>

      {/* Recent Claims */}
      <div className="fadeUp4">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontWeight: 700, color: g.white }}>Recent Claims</h2>
          <Btn variant="secondary" onClick={() => setPage("claim")} style={{ padding: "8px 16px", fontSize: 13 }}>View All</Btn>
        </div>
        {!claims?.length
          ? <Card style={{ textAlign: "center", padding: 40 }}><p style={{ color: g.text, fontFamily: "'DM Sans',sans-serif" }}>No claims yet. Stay protected! 🛡️</p></Card>
          : claims.slice(0, 3).map(c => (
            <Card key={c.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, color: g.white }}>{c.triggerType} Disruption</div>
                  <div style={{ color: g.text, fontFamily: "'DM Sans',sans-serif", fontSize: 12, marginTop: 2 }}>{new Date(c.createdAt).toLocaleDateString("en-IN")}</div>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: 18, color: g.white }}>₹{c.amount}</span>
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
