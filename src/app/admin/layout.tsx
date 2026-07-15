"use client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href:"/admin/overview",  icon:"▦",  label:"Overview"  },
  { href:"/admin/orders",    icon:"📦", label:"Orders"    },
  { href:"/admin/payments",  icon:"💰", label:"Payments"  },
  { href:"/admin/customers", icon:"👥", label:"Customers" },
  { href:"/admin/messages",  icon:"💬", label:"Messages"  },
  { href:"/admin/products",  icon:"🏪", label:"Products"  },
  { href:"/admin/qr",        icon:"⬛", label:"QR Access" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const base: React.CSSProperties = {
    display:"flex", alignItems:"center", gap:9, padding:"9px 12px", borderRadius:6,
    fontSize:12, fontWeight:600, cursor:"pointer", transition:"background-color 0.12s, color 0.12s",
    borderWidth:1, borderStyle:"solid", borderColor:"transparent", background:"none",
    width:"100%", textAlign:"left", fontFamily:"'Barlow',sans-serif", letterSpacing:"0.02em", textDecoration:"none", color:"#5A5A70"
  };
  const activeStyle: React.CSSProperties = { ...base, background:"rgba(200,150,42,0.08)", color:"#E8B84B", borderColor:"rgba(200,150,42,0.2)" };

  const SidebarContent = () => (
    <>
      <div style={{ fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.14em", color:"#2E2E3A", padding:"10px 10px 6px", fontFamily:"'Barlow Condensed',sans-serif" }}>Operations</div>
      {NAV.map(item => (
        <Link key={item.href} href={item.href} onClick={()=>setOpen(false)}
          style={pathname===item.href ? activeStyle : base}
          onMouseEnter={e=>{ if(pathname!==item.href){(e.currentTarget as HTMLElement).style.backgroundColor="#131318";(e.currentTarget as HTMLElement).style.color="#A8A8B8";}}}
          onMouseLeave={e=>{ if(pathname!==item.href){(e.currentTarget as HTMLElement).style.backgroundColor="transparent";(e.currentTarget as HTMLElement).style.color="#5A5A70";}}}>
          <span style={{ width:16, textAlign:"center", fontSize:14 }}>{item.icon}</span>
          {item.label}
        </Link>
      ))}
      <div style={{ marginTop:"auto", paddingTop:8, borderTop:"1px solid #1E1E26" }}>
        <button onClick={logout} style={{ ...base, color:"#E53E3E" }}
          onMouseEnter={e=>(e.currentTarget.style.backgroundColor="#1A0808")}
          onMouseLeave={e=>(e.currentTarget.style.backgroundColor="transparent")}>
          <span style={{ width:16 }}>⏻</span>Log Out
        </button>
      </div>
    </>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#050506", fontFamily:"'Barlow',sans-serif" }}>
      {/* Topbar */}
      <div style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, height:52, background:"rgba(5,5,6,0.97)", borderBottom:"1px solid #1E1E26", display:"flex", alignItems:"center", padding:"0 16px", gap:10, backdropFilter:"blur(20px)" }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:17, fontWeight:900, letterSpacing:"0.1em", color:"#EEEEF5", textTransform:"uppercase", display:"flex", alignItems:"center", gap:9, flex:1 }}>
          <div style={{ width:28, height:28, background:"#C8962A", clipPath:"polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, color:"#000" }}>B</div>
          Blackstone Ops
        </div>
        {/* Mobile hamburger */}
        <button onClick={()=>setOpen(o=>!o)} style={{ background:"#131318", border:"1px solid #1E1E26", borderRadius:6, width:36, height:36, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"#A8A8B8" }}
          className="admin-hamburger">☰</button>
      </div>

      <div style={{ display:"flex", minHeight:"100vh", paddingTop:52 }}>
        {/* Desktop sidebar */}
        <div style={{ width:210, flexShrink:0, background:"#0C0C0F", borderRight:"1px solid #1E1E26", padding:"14px 8px 20px", display:"flex", flexDirection:"column", gap:2, position:"sticky", top:52, height:"calc(100vh - 52px)", overflowY:"auto" }} className="admin-sidebar">
          <SidebarContent />
        </div>

        {/* Mobile drawer */}
        {open && (
          <div style={{ position:"fixed", inset:0, zIndex:99, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(4px)" }} onClick={()=>setOpen(false)}>
            <div style={{ position:"absolute", top:52, left:0, bottom:0, width:240, background:"#0C0C0F", borderRight:"1px solid #1E1E26", padding:"14px 8px 20px", display:"flex", flexDirection:"column", gap:2, overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
              <SidebarContent />
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ flex:1, minWidth:0, padding:"24px 20px 40px", overflowY:"auto" }}>
          {children}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="admin-bottom-nav" style={{ display:"none", position:"fixed", bottom:0, left:0, right:0, height:58, background:"rgba(8,8,10,0.97)", borderTop:"1px solid #1E1E26", zIndex:50, backdropFilter:"blur(20px)" }}>
        {NAV.slice(0,5).map(item=>(
          <Link key={item.href} href={item.href} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, textDecoration:"none", color:pathname===item.href?"#E8B84B":"#5A5A70" }}>
            <span style={{ fontSize:18 }}>{item.icon}</span>
            <span style={{ fontSize:8, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.04em", fontFamily:"'Barlow Condensed',sans-serif" }}>{item.label}</span>
          </Link>
        ))}
      </div>

      <style>{`
        @media(max-width:768px){
          .admin-sidebar{display:none!important;}
          .admin-hamburger{display:flex!important;}
          .admin-bottom-nav{display:flex!important;}
        }
        *{-webkit-tap-highlight-color:transparent;}
      `}</style>
    </div>
  );
}
