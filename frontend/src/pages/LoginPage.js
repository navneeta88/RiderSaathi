import { useState, useEffect } from "react";
import { Btn, Card, Alert, Input, Spinner, G } from "../components/UI";
import { apiFetch } from "../App";

const WEATHER_API_KEY = "61abf2c195ce65bef14c1b23ba96b376";

const themes = {
  normal: { accent: "#3B5BDB", bg: "radial-gradient(ellipse at top, #1a2680 0%, #0a0a0a 70%)", icon: "☀️", label: "Clear skies today" },
  rain: { accent: "#4dabf7", bg: "radial-gradient(ellipse at top, #0a1a3a 0%, #0a0a0a 70%)", icon: "🌧️", label: "Rain alert — Stay safe!" },
  heat: { accent: "#ff6b6b", bg: "radial-gradient(ellipse at top, #3a0a00 0%, #0a0a0a 70%)", icon: "🔥", label: "Extreme heat today" },
  aqi: { accent: "#adb5bd", bg: "radial-gradient(ellipse at top, #1a1a1a 0%, #0a0a0a 70%)", icon: "🌫️", label: "High AQI — Take care!" },
  storm: { accent: "#845ef7", bg: "radial-gradient(ellipse at top, #1a0a3a 0%, #0a0a0a 70%)", icon: "⛈️", label: "Thunderstorm alert!" },
};

export default function LoginPage({ setPage, onLogin }) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [weather, setWeather] = useState(null);
  const [theme, setTheme] = useState("normal");

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
          const description = data.weather[0].description.toLowerCase();
          const city = data.name;

          setWeather({ temp: Math.round(temp), condition, city, description });

          if (condition === "Thunderstorm") setTheme("storm");
          else if (condition === "Rain" || condition === "Drizzle" || description.includes("rain") || description.includes("shower") || description.includes("drizzle")) setTheme("rain");
          else if (temp > 40) setTheme("heat");
          else if (condition === "Haze" || condition === "Fog" || condition === "Smoke" || condition === "Mist") setTheme("aqi");
          else setTheme("normal");
        } catch (e) {
          setTheme("normal");
        }
      },
      () => {
        // fallback to Delhi
        fetch(`https://api.openweathermap.org/data/2.5/weather?q=Delhi&appid=${WEATHER_API_KEY}&units=metric`)
          .then(r => r.json())
          .then(data => {
            const temp = data.main.temp;
            const condition = data.weather[0].main;
            const description = data.weather[0].description.toLowerCase();
            setWeather({ temp: Math.round(temp), condition, city: data.name, description });
            if (condition === "Thunderstorm") setTheme("storm");
            else if (condition === "Rain" || condition === "Drizzle" || description.includes("rain") || description.includes("shower") || description.includes("drizzle")) setTheme("rain");
            else if (temp > 40) setTheme("heat");
            else if (condition === "Haze" || condition === "Fog" || condition === "Smoke" || condition === "Mist") setTheme("aqi");
            else setTheme("normal");
          }).catch(() => setTheme("normal"));
      }
    );
  }, []);

  async function submit() {
    setError(""); setLoading(true);
    const data = await apiFetch("/login", { method: "POST", body: JSON.stringify({ phone }) });
    setLoading(false);
    if (data.error) return setError(data.error);
    localStorage.setItem("rs_token", data.token);
    onLogin(data.user);
    setPage("dashboard");
  }

  const t = themes[theme];

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: "40px 20px",
      background: t.bg, transition: "background 1.5s ease",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Weather Badge */}
        {weather && (
          <div className="fadeUp" style={{
            textAlign: "center", marginBottom: 20,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: `${t.accent}22`, border: `1px solid ${t.accent}44`,
              color: t.accent, padding: "6px 14px", borderRadius: 999,
              fontSize: 13, fontWeight: 600,
            }}>
              {t.icon} {weather.city} · {weather.temp}°C · {t.label}
            </span>
          </div>
        )}

        {/* Header */}
        <div className="fadeUp" style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>
            {theme === "rain" ? "🌧️" : theme === "heat" ? "🔥" : theme === "aqi" ? "🌫️" : theme === "storm" ? "⛈️" : "👤"}
          </div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800 }}>Welcome Back</h1>
          <p style={{ color: G.text, fontFamily: "'DM Sans',sans-serif", marginTop: 8 }}>
            Enter your registered phone number
          </p>
        </div>

        {/* Card */}
        <div className="fadeUp2" style={{
          background: "rgba(255,255,255,0.05)",
          border: `1px solid ${t.accent}44`,
          borderRadius: 16, padding: 28,
          backdropFilter: "blur(10px)",
          transition: "border-color 1.5s ease",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {error && <Alert type="error">{error}</Alert>}

            <div>
              <label style={{ color: G.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif", display: "block", marginBottom: 6 }}>
                Phone Number
              </label>
              <input
                type="tel" placeholder="9876543210"
                value={phone} onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${t.accent}44`, borderRadius: 10,
                  padding: "12px 16px", color: "#fff", fontSize: 14,
                  fontFamily: "'DM Sans',sans-serif", outline: "none",
                  transition: "border-color 1.5s ease",
                }}
              />
            </div>

            <button
              onClick={submit}
              disabled={loading || phone.length < 10}
              style={{
                width: "100%", padding: "14px",
                background: phone.length >= 10 ? t.accent : "rgba(255,255,255,0.1)",
                color: "#fff", border: "none", borderRadius: 10,
                fontFamily: "'Syne',sans-serif", fontWeight: 600, fontSize: 15,
                cursor: phone.length >= 10 ? "pointer" : "not-allowed",
                transition: "background 0.3s ease",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              {loading ? <Spinner /> : "Login →"}
            </button>

            <p style={{ textAlign: "center", color: G.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>
              New user?{" "}
              <span onClick={() => setPage("register")} style={{ color: t.accent, cursor: "pointer", fontWeight: 600, transition: "color 1.5s ease" }}>
                Register here
              </span>
            </p>
          </div>
        </div>

        {/* Bottom weather tip */}
        {weather && theme !== "normal" && (
          <div className="fadeUp3" style={{
            marginTop: 20, textAlign: "center",
            background: `${t.accent}11`, border: `1px solid ${t.accent}33`,
            borderRadius: 12, padding: "12px 16px",
            color: t.accent, fontFamily: "'DM Sans',sans-serif", fontSize: 13,
          }}>
            ⚡ {theme === "rain" ? "Rain detected! You may be eligible for a claim." :
               theme === "heat" ? "Extreme heat! Check your claim eligibility." :
               theme === "aqi" ? "High AQI! Stay safe and check your coverage." :
               "Thunderstorm alert! File a claim if your work was affected."}
          </div>
        )}

      </div>
    </div>
  );
}
