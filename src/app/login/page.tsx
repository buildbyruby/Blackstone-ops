"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error("Invalid credentials"); setLoading(false); return; }
    router.push("/admin/overview");
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#050506", padding:20, position:"relative", overflow:"hidden", fontFamily:"'Barlow',sans-serif" }}>
      <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(30,30,38,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(30,30,38,0.4) 1px,transparent 1px)", backgroundSize:"40px 40px", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 60% 50% at 50% 0%, rgba(200,150,42,0.08) 0%, transparent 65%)", pointerEvents:"none" }}/>
      <div style={{ width:"100%", maxWidth:380, position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:60, height:60, background:"#C8962A", clipPath:"polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:900, color:"#000", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:14, boxShadow:"0 0 60px rgba(200,150,42,0.3)" }}>B</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:900, letterSpacing:"0.14em", textTransform:"uppercase", color:"#EEEEF5" }}>Blackstone Ops</div>
          <div style={{ fontSize:10, color:"#5A5A70", marginTop:4, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:700 }}>Private Operations Platform</div>
        </div>
        <div style={{ background:"#0C0C0F", border:"1px solid #1E1E26", borderRadius:16, padding:28, position:"relative", boxShadow:"0 8px 40px rgba(0,0,0,0.9)" }}>
          <div style={{ position:"absolute", top:0, left:30, right:30, height:1, background:"linear-gradient(90deg,transparent,#C8962A,transparent)" }}/>
          <div style={{ fontSize:10, fontWeight:800, color:"#5A5A70", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:22 }}>Administrator Access</div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:10, fontWeight:800, color:"#5A5A70", marginBottom:6, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="admin@blackstone.co"
              style={{ width:"100%", padding:"11px 14px", background:"#050506", border:"1px solid #1E1E26", borderRadius:4, color:"#EEEEF5", fontSize:13, fontFamily:"'Barlow',sans-serif", outline:"none", boxSizing:"border-box" }}
              onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
          </div>
          <div style={{ marginBottom:22 }}>
            <label style={{ display:"block", fontSize:10, fontWeight:800, color:"#5A5A70", marginBottom:6, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Password</label>
            <div style={{ position:"relative" }}>
              <input type={showPw?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} placeholder="••••••••"
                style={{ width:"100%", padding:"11px 40px 11px 14px", background:"#050506", border:"1px solid #1E1E26", borderRadius:4, color:"#EEEEF5", fontSize:13, fontFamily:"'Barlow',sans-serif", outline:"none", boxSizing:"border-box" }}
                onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
              <button onClick={()=>setShowPw(s=>!s)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#5A5A70", cursor:"pointer", fontSize:14 }}>{showPw?"🙈":"👁"}</button>
            </div>
          </div>
          <button onClick={handleLogin} disabled={loading||!email||!password}
            style={{ width:"100%", padding:"12px", background:(!email||!password||loading)?"#3A2A10":"#C8962A", color:(!email||!password||loading)?"#7A5A14":"#000", border:"none", borderRadius:4, fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase", cursor:(!email||!password||loading)?"not-allowed":"pointer" }}>
            {loading?"Verifying…":"Access Dashboard →"}
          </button>
          <div style={{ textAlign:"center", fontSize:10, color:"#2E2E3A", marginTop:16, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Secured · Private · Controlled</div>
        </div>
      </div>
    </div>
  );
}
