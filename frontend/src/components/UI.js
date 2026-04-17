// ── Shared UI Components (theme-aware) ───────────────────────
import { useTheme } from "../App";

// Dark theme tokens
export const GDark = {
  blue: "#3B5BDB", green: "#00ff64", dark: "#0a0a0a",
  card: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)",
  text: "rgba(255,255,255,0.6)", white: "#fff", bg: "#0a0a0a",
  cardBg: "rgba(255,255,255,0.05)", inputBg: "rgba(255,255,255,0.06)",
  navBg: "rgba(10,10,10,0.95)",
};

// Light theme tokens
export const GLight = {
  blue: "#3B5BDB", green: "#00a846", dark: "#f0f2f8",
  card: "rgba(255,255,255,0.9)", border: "rgba(0,0,0,0.1)",
  text: "rgba(15,17,23,0.6)", white: "#0f1117", bg: "#f0f2f8",
  cardBg: "rgba(255,255,255,0.9)", inputBg: "rgba(0,0,0,0.05)",
  navBg: "rgba(240,242,248,0.96)",
};

// Legacy export (dark) — keeps old pages working without changes
export const G = GDark;

export function useG() {
  const { dark } = useTheme();
  return dark ? GDark : GLight;
}

export function Btn({ children, onClick, variant = "primary", style = {}, disabled, type = "button" }) {
  const g = useG();
  const base = {
    border: "none", borderRadius: 10, fontFamily: "'Syne',sans-serif", fontWeight: 600,
    fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", padding: "12px 24px",
    transition: "all 0.2s", opacity: disabled ? 0.5 : 1, display: "inline-flex",
    alignItems: "center", justifyContent: "center", gap: 8,
  };
  const variants = {
    primary: { background: g.blue, color: "#fff" },
    secondary: { background: g.inputBg, color: g.white, border: `1px solid ${g.border}` },
    green: { background: g.green, color: "#000" },
    danger: { background: "#c92a2a", color: "#fff" },
    outline: { background: "transparent", color: g.white, border: `1px solid ${g.border}` },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = "0.85"; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = "1"; }}>
      {children}
    </button>
  );
}

export function Card({ children, style = {}, className = "" }) {
  const g = useG();
  return (
    <div className={className} style={{ background: g.cardBg, border: `1px solid ${g.border}`, borderRadius: 16, padding: 24, ...style }}>
      {children}
    </div>
  );
}

export function Badge({ children, color = "#00ff64" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${color}22`, border: `1px solid ${color}55`, color, padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
      {children}
    </span>
  );
}

export function Spinner() {
  const g = useG();
  const border = g === GLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)";
  const top = g === GLight ? "#3B5BDB" : "#fff";
  return <div style={{ width: 18, height: 18, border: `2px solid ${border}`, borderTopColor: top, borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />;
}

export function Input({ label, type = "text", placeholder, value, onChange, hint }) {
  const g = useG();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ color: g.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>{label}</label>}
      <input type={type} placeholder={placeholder} value={value} onChange={onChange}
        style={{ background: g.inputBg, border: `1px solid ${g.border}`, borderRadius: 10, padding: "12px 16px", color: g.white, fontSize: 14, width: "100%", fontFamily: "'DM Sans',sans-serif" }} />
      {hint && <p style={{ color: g.green, fontSize: 12, fontFamily: "'DM Sans',sans-serif" }}>{hint}</p>}
    </div>
  );
}

export function Select({ label, value, onChange, options }) {
  const g = useG();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ color: g.text, fontSize: 13, fontFamily: "'DM Sans',sans-serif" }}>{label}</label>}
      <select value={value} onChange={onChange}
        style={{ background: g === GLight ? "#fff" : "#1a1a2e", border: `1px solid ${g.border}`, borderRadius: 10, padding: "12px 16px", color: g.white, fontSize: 14, width: "100%", fontFamily: "'DM Sans',sans-serif" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Alert({ type = "error", children }) {
  const colors = { error: ["#c92a2a22", "#c92a2a55", "#ff6b6b"], success: ["#00ff6422", "#00ff6444", "#00ff64"], warning: ["#ff922b22", "#ff922b44", "#ff922b"] };
  const [bg, border, text] = colors[type];
  const icons = { error: "⚠️", success: "✅", warning: "⚡" };
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 16px", color: text, fontFamily: "'DM Sans',sans-serif", fontSize: 14 }}>
      {icons[type]} {children}
    </div>
  );
}

export function PageWrapper({ children, title, subtitle }) {
  const g = useG();
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 32px 80px" }}>
      {title && <div className="fadeUp" style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 6, color: g.white }}>{title}</h1>
        {subtitle && <p style={{ color: g.text, fontFamily: "'DM Sans',sans-serif" }}>{subtitle}</p>}
      </div>}
      {children}
    </div>
  );
}
