import { useState, createContext, useContext } from "react";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import CreatePolicyPage from "./pages/CreatePolicyPage";
import PremiumPage from "./pages/PremiumPage";
import MonitoringPage from "./pages/MonitoringPage";
import ClaimPage from "./pages/ClaimPage";
import PayoutPage from "./pages/PayoutPage";
import AdminPage from "./pages/AdminPage";
import WorkersPage from "./pages/WorkersPage";
import Navbar from "./components/Navbar.js";

export const AuthCtx = createContext(null);
export function useAuth() { return useContext(AuthCtx); }
export const API = "http://localhost:5000/api";

export const ThemeCtx = createContext({ dark: true, toggleTheme: () => {} });
export function useTheme() { return useContext(ThemeCtx); }

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("rs_token");
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...options,
  });
  return res.json();
}

const darkCss = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#0a0a0a;color:#fff;font-family:'Syne',sans-serif;}
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes livePulse{0%{box-shadow:0 0 0 0 rgba(0,255,100,0.5)}70%{box-shadow:0 0 0 10px rgba(0,255,100,0)}100%{box-shadow:0 0 0 0 rgba(0,255,100,0)}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes rainDrop{0%{transform:translateY(-20px) rotate(15deg);opacity:0}15%{opacity:0.7}100%{transform:translateY(110vh) rotate(15deg);opacity:0}}
@keyframes heatWave{0%,100%{transform:scaleX(1) translateY(0);opacity:0.12}50%{transform:scaleX(1.04) translateY(-6px);opacity:0.25}}
@keyframes aqiDrift{0%{transform:translateX(0) translateY(0);opacity:0.08}50%{transform:translateX(20px) translateY(-10px);opacity:0.2}100%{transform:translateX(0) translateY(0);opacity:0.08}}
@keyframes snowFlake{0%{transform:translateY(-20px) rotate(0deg);opacity:0}15%{opacity:0.8}100%{transform:translateY(110vh) rotate(360deg);opacity:0}}
.fadeUp{animation:fadeUp 0.6s ease both}
.fadeUp2{animation:fadeUp 0.6s 0.1s ease both}
.fadeUp3{animation:fadeUp 0.6s 0.2s ease both}
.fadeUp4{animation:fadeUp 0.6s 0.3s ease both}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#333;border-radius:3px}
input:focus,select:focus{outline:2px solid #3B5BDB !important;}
.theme-toggle-btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:20px;padding:6px 14px;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;transition:all 0.2s;}
.theme-toggle-btn:hover{background:rgba(255,255,255,0.15);}
`;

const lightCss = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#f0f2f8;color:#0f1117;font-family:'Syne',sans-serif;}
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes livePulse{0%{box-shadow:0 0 0 0 rgba(59,91,219,0.5)}70%{box-shadow:0 0 0 10px rgba(59,91,219,0)}100%{box-shadow:0 0 0 0 rgba(59,91,219,0)}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes rainDrop{0%{transform:translateY(-20px) rotate(15deg);opacity:0}15%{opacity:0.5}100%{transform:translateY(110vh) rotate(15deg);opacity:0}}
@keyframes heatWave{0%,100%{transform:scaleX(1) translateY(0);opacity:0.06}50%{transform:scaleX(1.04) translateY(-6px);opacity:0.14}}
@keyframes aqiDrift{0%{transform:translateX(0) translateY(0);opacity:0.05}50%{transform:translateX(20px) translateY(-10px);opacity:0.12}100%{transform:translateX(0) translateY(0);opacity:0.05}}
@keyframes snowFlake{0%{transform:translateY(-20px) rotate(0deg);opacity:0}15%{opacity:0.6}100%{transform:translateY(110vh) rotate(360deg);opacity:0}}
.fadeUp{animation:fadeUp 0.6s ease both}
.fadeUp2{animation:fadeUp 0.6s 0.1s ease both}
.fadeUp3{animation:fadeUp 0.6s 0.2s ease both}
.fadeUp4{animation:fadeUp 0.6s 0.3s ease both}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#e0e3ef}::-webkit-scrollbar-thumb{background:#bbc;border-radius:3px}
input:focus,select:focus{outline:2px solid #3B5BDB !important;}
.theme-toggle-btn{background:rgba(0,0,0,0.07);border:1px solid rgba(0,0,0,0.12);color:#0f1117;border-radius:20px;padding:6px 14px;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;transition:all 0.2s;}
.theme-toggle-btn:hover{background:rgba(0,0,0,0.13);}
`;

export default function App() {
  const [page, setPage] = useState("landing");
  const [dark, setDark] = useState(() => localStorage.getItem("rs_theme") !== "light");
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rs_user")); } catch { return null; }
  });

  function toggleTheme() {
    setDark(d => {
      const next = !d;
      localStorage.setItem("rs_theme", next ? "dark" : "light");
      return next;
    });
  }

  function onLogin(u) {
    setUser(u);
    localStorage.setItem("rs_user", JSON.stringify(u));
  }
  function logout() {
    localStorage.removeItem("rs_token");
    localStorage.removeItem("rs_user");
    setUser(null);
    setPage("landing");
  }

  const theme = { dark, toggleTheme };

  if (page === "admin") {
    return (
      <ThemeCtx.Provider value={theme}>
        <AuthCtx.Provider value={{ user, onLogin, logout }}>
          <style>{dark ? darkCss : lightCss}</style>
          <AdminPage setPage={setPage} />
        </AuthCtx.Provider>
      </ThemeCtx.Provider>
    );
  }

  const pages = {
    landing: <LandingPage setPage={setPage} />,
    login: <LoginPage setPage={setPage} onLogin={onLogin} />,
    register: <RegisterPage setPage={setPage} onLogin={onLogin} />,
    dashboard: <DashboardPage setPage={setPage} />,
    createpolicy: <CreatePolicyPage setPage={setPage} />,
    premium: <PremiumPage setPage={setPage} />,
    monitoring: <MonitoringPage setPage={setPage} />,
    claim: <ClaimPage setPage={setPage} />,
    payout: <PayoutPage setPage={setPage} />,
    workers: <WorkersPage setPage={setPage} />,
  };

  return (
    <ThemeCtx.Provider value={theme}>
      <AuthCtx.Provider value={{ user, onLogin, logout }}>
        <style>{dark ? darkCss : lightCss}</style>
        <Navbar page={page} setPage={setPage} user={user} logout={logout} />
        <div style={{ paddingTop: 64 }}>
          {pages[page] || <LandingPage setPage={setPage} />}
        </div>
      </AuthCtx.Provider>
    </ThemeCtx.Provider>
  );
}
