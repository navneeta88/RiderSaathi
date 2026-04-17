import { useG } from "./UI";
import { useTheme } from "../App";

export default function Navbar({ page, setPage, user, logout }) {
  const g = useG();
  const { dark, toggleTheme } = useTheme();

  const navItems = user
    ? [
        ["dashboard","📊 Dashboard"],
        ["monitoring","⚡ Triggers"],
        ["claim","📋 Claims"],
        ["payout","💳 Payouts"],
        ["workers","👷 Workers"],
      ]
    : [
        ["login","Login"],
        ["register","Register"],
      ];

  return (
    <nav style={{
      position:"fixed",top:0,left:0,right:0,zIndex:1000,
      background:g.navBg,borderBottom:`1px solid ${g.border}`,
      backdropFilter:"blur(20px)",height:64,
      display:"flex",alignItems:"center",padding:"0 24px",gap:8,
    }}>
      <span
        onClick={()=>setPage("landing")}
        style={{fontWeight:800,fontSize:18,cursor:"pointer",marginRight:16,
          background:"linear-gradient(135deg,#3B5BDB,#5C7CFA)",
          WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}
      >
        🛡️ RiderSaathi
      </span>

      <div style={{display:"flex",gap:4,flex:1,overflowX:"auto",scrollbarWidth:"none"}}>
        {navItems.map(([id,label])=>(
          <button key={id} onClick={()=>setPage(id)} style={{
            padding:"6px 14px",borderRadius:8,border:"none",
            background:page===id?"rgba(59,91,219,0.2)":"transparent",
            color:page===id?"#5C7CFA":g.text,
            fontWeight:page===id?700:400,fontSize:13,cursor:"pointer",
            whiteSpace:"nowrap",transition:"all 0.15s",
            fontFamily:"'Syne',sans-serif",
          }}>{label}</button>
        ))}
      </div>

      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
        {/* Theme Toggle */}
        <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle light/dark mode">
          {dark ? "☀️ Light" : "🌙 Dark"}
        </button>

        {user ? (
          <>
            <span style={{color:g.text,fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>
              {user.name?.split(" ")[0]}
            </span>
            <button onClick={logout} style={{
              padding:"6px 14px",borderRadius:8,border:`1px solid ${g.border}`,
              background:"transparent",color:g.text,fontSize:13,cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif",
            }}>Logout</button>
            <button onClick={()=>setPage("admin")} style={{
              padding:"6px 14px",borderRadius:8,border:"none",
              background:"rgba(255,100,100,0.15)",color:"#ff6b6b",
              fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600,
            }}>🛡️ Admin</button>
          </>
        ) : (
          <button onClick={()=>setPage("admin")} style={{
            padding:"6px 14px",borderRadius:8,border:"none",
            background:"rgba(255,100,100,0.12)",color:"#ff6b6b",
            fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
          }}>Admin</button>
        )}
      </div>
    </nav>
  );
}
