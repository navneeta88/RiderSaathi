import { useState, useEffect } from "react";
import { Btn, Card, Badge, G } from "../components/UI";

const WEATHER_API_KEY = "61abf2c195ce65bef14c1b23ba96b376";

const partners = ["🍕 Zomato", "🛵 Swiggy", "⚡ Blinkit", "🏃 Zepto", "📦 Dunzo", "🛒 BigBasket", "📬 Amazon Flex", "🚚 Porter", "🌙 Shadowfax"];
const tickers = ["🌫️ AQI 340 — Delhi NCR", "🔥 Heat Wave — Hyderabad", "📱 App Outage — Swiggy 52min", "✅ ₹450 paid to Ravi Kumar in 87s"];
const stats = [{ v: "47K+", l: "Workers Protected" }, { v: "₹2.4Cr", l: "Paid Out" }, { v: "87s", l: "Avg Payout" }, { v: "99.2%", l: "Uptime" }];

const themes = {
  normal: {
    bg: "linear-gradient(135deg,rgba(0,0,0,0.88) 45%,rgba(0,0,0,0.5))",
    accent: "#3B5BDB",
    badge: "🟢 Normal conditions today",
    alertColor: "#00ff64",
    overlayColor: "rgba(0,0,0,0.88)",
    eligible: false,
  },
  rain: {
    bg: "linear-gradient(135deg,rgba(0,15,50,0.93) 45%,rgba(0,30,70,0.7))",
    accent: "#4dabf7",
    badge: "🌧️ Heavy Rain Alert — Claim Eligible!",
    alertColor: "#4dabf7",
    overlayColor: "rgba(0,15,50,0.93)",
    eligible: true,
  },
  heat: {
    bg: "linear-gradient(135deg,rgba(60,10,0,0.93) 45%,rgba(90,20,0,0.7))",
    accent: "#ff6b6b",
    badge: "🔥 Extreme Heat Alert — Claim Eligible!",
    alertColor: "#ff6b6b",
    overlayColor: "rgba(60,10,0,0.93)",
    eligible: true,
  },
  aqi: {
    bg: "linear-gradient(135deg,rgba(25,25,25,0.96) 45%,rgba(45,45,45,0.8))",
    accent: "#adb5bd",
    badge: "🌫️ High AQI Alert — Claim Eligible!",
    alertColor: "#adb5bd",
    overlayColor: "rgba(25,25,25,0.96)",
    eligible: true,
  },
  storm: {
    bg: "linear-gradient(135deg,rgba(10,0,40,0.95) 45%,rgba(20,0,60,0.8))",
    accent: "#845ef7",
    badge: "⛈️ Thunderstorm Alert — Claim Eligible!",
    alertColor: "#845ef7",
    overlayColor: "rgba(10,0,40,0.95)",
    eligible: true,
  },
};

const weatherCSS = `
@keyframes rainDrop {
  0% { transform: translateY(-20px); opacity: 0; }
  10% { opacity: 0.7; }
  90% { opacity: 0.5; }
  100% { transform: translateY(100vh); opacity: 0; }
}
@keyframes heatWave {
  0%, 100% { transform: scaleX(1); opacity: 0.3; }
  50% { transform: scaleX(1.05); opacity: 0.6; }
}
@keyframes fogFloat {
  0%, 100% { transform: translateX(0); opacity: 0.15; }
  50% { transform: translateX(30px); opacity: 0.3; }
}
@keyframes lightning {
  0%, 95%, 100% { opacity: 0; }
  96%, 98% { opacity: 0.8; }
}
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes livePulse{0%{box-shadow:0 0 0 0 rgba(0,255,100,0.5)}70%{box-shadow:0 0 0 10px rgba(0,255,100,0)}100%{box-shadow:0 0 0 0 rgba(0,255,100,0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
.fadeUp{animation:fadeUp 0.6s ease both}
.fadeUp2{animation:fadeUp 0.6s 0.1s ease both}
.fadeUp3{animation:fadeUp 0.6s 0.2s ease both}
.fadeUp4{animation:fadeUp 0.6s 0.3s ease both}
`;

function RainEffect() {
  const drops = Array.from({ length: 40 }, (_, i) => i);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {drops.map(i => (
        <div key={i} style={{
          position: "absolute",
          left: `${Math.random() * 100}%`,
          top: `-20px`,
          width: "1px",
          height: `${Math.random() * 20 + 10}px`,
          background: "rgba(100,180,255,0.6)",
          animation: `rainDrop ${Math.random() * 1 + 0.5}s linear ${Math.random() * 2}s infinite`,
        }} />
      ))}
    </div>
  );
}

function HeatEffect() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          position: "absolute",
          bottom: `${i * 20}%`,
          left: 0, right: 0,
          height: "60px",
          background: "linear-gradient(transparent, rgba(255,100,0,0.08), transparent)",
          animation: `heatWave ${1.5 + i * 0.5}s ease-in-out ${i * 0.3}s infinite`,
        }} />
      ))}
    </div>
  );
}

function FogEffect() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          position: "absolute",
          top: `${i * 22}%`,
          left: "-20%", right: "-20%",
          height: "80px",
          background: "rgba(180,180,180,0.12)",
          borderRadius: "50%",
          filter: "blur(20px)",
          animation: `fogFloat ${3 + i}s ease-in-out ${i * 0.7}s infinite`,
        }} />
      ))}
    </div>
  );
}

function StormEffect() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
      <RainEffect />
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(150,100,255,0.15)",
        animation: "lightning 4s ease infinite",
      }} />
    </div>
  );
}

export default function LandingPage({ setPage }) {
  const [tick, setTick] = useState(0);
  const [weather, setWeather] = useState(null);
  const [theme, setTheme] = useState("normal");
  const [loadingWeather, setLoadingWeather] = useState(true);

  useEffect(() => {
    const i = setInterval(() => setTick(t => (t + 1) % tickers.length), 2800);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=metric`
          );
          const data = await res.json();
          const temp = data.main.temp;
          const condition = data.weather[0].main;
          const city = data.name;
          const aqi = data.visibility < 2000 ? 320 : 85;

          setWeather({ temp: Math.round(temp), condition, city, aqi });

          if (condition === "Thunderstorm") setTheme("storm");
          else if (condition === "Rain" || condition === "Drizzle") setTheme("rain");
          else if (temp > 40) setTheme("heat");
          else if (condition === "Haze" || condition === "Fog" || condition === "Smoke" || condition === "Mist") setTheme("aqi");
          else setTheme("normal");
        } catch (e) {
          setTheme("normal");
        }
        setLoadingWeather(false);
      },
      () => { setTheme("normal"); setLoadingWeather(false); }
    );
  }, []);

  const t = themes[theme];

  const WeatherEffect = () => {
    if (theme === "rain") return <RainEffect />;
    if (theme === "heat") return <HeatEffect />;
    if (theme === "aqi") return <FogEffect />;
    if (theme === "storm") return <StormEffect />;
    return null;
  };

  return (
    <div>
      <style>{weatherCSS}</style>

      {/* ── HERO ── */}
      <section style={{ minHeight: "calc(100vh - 64px)", display: "flex", alignItems: "center", position: "relative", overflow: "hidden", transition: "all 1s ease" }}>
        {/* Background */}
        <div style={{
          position: "absolute", inset: 0,
          background: t.bg,
          backgroundImage: "url('https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1400&q=80')",
          backgroundSize: "cover", backgroundPosition: "center",
          backgroundBlendMode: "multiply",
          transition: "background 1.5s ease",
        }} />

        {/* Weather Effect Animation */}
        <WeatherEffect />

        {/* Live Weather Badge top right */}
        {weather && (
          <div style={{
            position: "absolute", top: 20, right: 20, zIndex: 10,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)",
            border: `1px solid ${t.accent}44`,
            borderRadius: 12, padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 10,
            transition: "all 1s ease",
          }}>
            <div style={{ fontSize: 24 }}>
              {theme === "rain" ? "🌧️" : theme === "heat" ? "🔥" : theme === "aqi" ? "🌫️" : theme === "storm" ? "⛈️" : "☀️"}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: t.accent }}>{weather.city}</div>
              <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>
                {weather.temp}°C · {weather.condition}
              </div>
            </div>
          </div>
        )}

        <div style={{ position: "relative", zIndex: 2, maxWidth: 1200, margin: "0 auto", padding: "60px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 40, width: "100%", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 300, maxWidth: 560, display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Weather Alert Badge */}
            <div className="fadeUp">
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: `${t.accent}22`, border: `1px solid ${t.accent}55`,
                color: t.accent, padding: "6px 14px", borderRadius: 999,
                fontSize: 13, fontWeight: 600, transition: "all 1s ease",
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.accent, animation: "pulse 1.5s ease infinite", display: "inline-block" }} />
                {loadingWeather ? "📍 Detecting your location..." : t.badge}
              </span>
            </div>

            <h1 className="fadeUp2" style={{ fontSize: "clamp(2.4rem,5vw,4rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>
              Your income,<br />protected from<br />
              <span style={{ color: t.accent, transition: "color 1s ease" }}>every storm.</span>
            </h1>

            <p className="fadeUp3" style={{ fontFamily: "'DM Sans',sans-serif", color: "rgba(255,255,255,0.65)", fontSize: 15, lineHeight: 1.8, maxWidth: 420 }}>
              India's first AI-powered parametric income insurance for gig delivery workers. Auto-triggered payouts in 87 seconds — no paperwork, no waiting.
            </p>

            {/* Eligible banner */}
            {t.eligible && (
              <div className="fadeUp3" style={{
                background: `${t.accent}18`, border: `1px solid ${t.accent}44`,
                borderRadius: 12, padding: "12px 16px",
                fontFamily: "'DM Sans',sans-serif", fontSize: 14,
                color: t.accent, display: "flex", alignItems: "center", gap: 10,
              }}>
                ⚡ <strong>You may be eligible for a claim right now!</strong>
                <span onClick={() => setPage("claim")} style={{ marginLeft: "auto", textDecoration: "underline", cursor: "pointer", color: "#fff" }}>File Claim →</span>
              </div>
            )}

            <div className="fadeUp4" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => setPage("register")} style={{
                background: t.accent, color: "#fff", border: "none",
                padding: "14px 28px", borderRadius: 10, fontFamily: "'Syne',sans-serif",
                fontWeight: 600, fontSize: 15, cursor: "pointer", transition: "background 1s ease",
              }}>
                🛡️ Get Protected — ₹15/week
              </button>
              <button onClick={() => setPage("premium")} style={{
                background: "rgba(255,255,255,0.08)", color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "14px 28px", borderRadius: 10, fontFamily: "'Syne',sans-serif",
                fontWeight: 600, fontSize: 15, cursor: "pointer",
              }}>
                🧮 Calculate Coverage
              </button>
            </div>

            <div className="fadeUp4" style={{ display: "flex", gap: 36, flexWrap: "wrap" }}>
              {stats.map(s => (
                <div key={s.l}>
                  <div style={{ fontSize: "1.7rem", fontWeight: 800, letterSpacing: -0.5, color: s.l === "Uptime" ? t.accent : "#fff", transition: "color 1s ease" }}>{s.v}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 1 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right side cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-end" }}>
            <div style={{ background: `linear-gradient(135deg, ${t.accent}, #7048e8)`, borderRadius: 12, padding: "12px 16px", textAlign: "center", transition: "background 1s ease" }}>
              <div style={{ fontSize: 9, opacity: 0.7, letterSpacing: 2 }}>IRDAI</div>
              <div style={{ fontSize: 22 }}>🛡️</div>
              <div style={{ fontSize: 9, opacity: 0.7 }}>Registered</div>
            </div>
            <div style={{ width: 280, height: 200, borderRadius: 16, overflow: "hidden", border: `1px solid ${t.accent}44`, transition: "border-color 1s ease" }}>
              <img src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80" alt="Delivery worker" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ width: 280, background: "rgba(20,20,20,0.85)", backdropFilter: "blur(16px)", border: `1px solid ${t.accent}33`, borderRadius: 16, padding: 16, transition: "border-color 1s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#00B140", display: "flex", alignItems: "center", justifyContent: "center" }}>🛵</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>₹450 credited in 87s</div>
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "'DM Sans',sans-serif" }}>Manoj Rathi · Mumbai</div>
                  </div>
                </div>
                <span style={{ background: "#00ff64", color: "#000", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, animation: "livePulse 2s ease infinite" }}>LIVE</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TICKER ── */}
      <div style={{ background: t.accent, padding: "10px 0", textAlign: "center", fontSize: 13, fontFamily: "'DM Sans',sans-serif", transition: "background 1s ease" }}>
        {tickers[tick]}
      </div>

      {/* ── PARTNERS ── */}
      <div style={{ background: "#111", padding: "18px 0", overflow: "hidden", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex" }}>
          <div style={{ display: "flex", gap: 16, animation: "marquee 22s linear infinite", width: "max-content" }}>
            {[...partners, ...partners].map((p, i) => (
              <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "9px 18px", borderRadius: 999, fontSize: 13, fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap" }}>{p}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 40px" }}>
        <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 8 }}>Your Protection Journey</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans',sans-serif", marginBottom: 48 }}>8 steps from signup to payout</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
          {[
            ["1️⃣", "Landing", "Learn about RiderSaathi", "landing"],
            ["2️⃣", "Sign Up", "Register in 2 minutes", "register"],
            ["3️⃣", "Dashboard", "View your protection status", "dashboard"],
            ["4️⃣", "Create Policy", "Activate weekly insurance", "createpolicy"],
            ["5️⃣", "AI Premium", "See your risk calculation", "premium"],
            ["6️⃣", "Monitoring", "Real-time trigger alerts", "monitoring"],
            ["7️⃣", "File Claim", "Auto-verified in seconds", "claim"],
            ["8️⃣", "Get Payout", "₹ in your UPI in 87s", "payout"],
          ].map(([icon, title, desc, p]) => (
            <div key={title} onClick={() => setPage(p)} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${t.accent}33`, borderRadius: 16, padding: 20, cursor: "pointer", transition: "border-color 1s ease" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans',sans-serif", fontSize: 13, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ textAlign: "center", padding: "80px 40px", background: `linear-gradient(135deg, ${t.accent}22, ${t.accent}08)`, transition: "background 1s ease" }}>
        <h2 style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: 16 }}>Ready to protect your income?</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans',sans-serif", marginBottom: 32 }}>Join 47,000+ gig workers. Starting at just ₹15/week.</p>
        <button onClick={() => setPage("register")} style={{ background: t.accent, color: "#fff", border: "none", padding: "16px 40px", borderRadius: 10, fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 16, cursor: "pointer", transition: "background 1s ease" }}>
          🛡️ Get Protected Now
        </button>
      </section>
    </div>
  );
}
