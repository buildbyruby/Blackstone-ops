"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function GateContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  const [step, setStep] = useState<"checking"|"invalid"|"disabled"|"suspended"|"form"|"pending"|"approved">("checking");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    // Always save the token so we can use it later for redirects
    if (token) localStorage.setItem("bst_token", token);
    validateToken();
  }, []);

  // Poll for approval status
  useEffect(() => {
    if (step !== "pending" || !customerId) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/customers/${customerId}`);
        const data = await res.json();
        setPollCount(p => p + 1);
        if (data.status === "active") { setStep("approved"); clearInterval(iv); }
        if (data.status === "suspended") { setStep("suspended"); clearInterval(iv); }
        if (data.status === "store_disabled") { setStep("disabled"); clearInterval(iv); }
      } catch {}
    }, 3000);
    return () => clearInterval(iv);
  }, [step, customerId]);

  const validateToken = async () => {
    if (!token) {
      // Try to use saved token
      const saved = localStorage.getItem("bst_token");
      if (saved) { router.replace(`/gate?token=${saved}`); return; }
      setStep("invalid"); return;
    }

    try {
      const res = await fetch("/api/qr", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"validate", token }) });
      const data = await res.json();
      if (!data.valid) { setStep("invalid"); return; }
      if (!data.active) {
        // Store is disabled — check if user already exists
        const savedPhone = localStorage.getItem("bst_phone");
        if (savedPhone) {
          const check = await fetch(`/api/customers?phone=${encodeURIComponent(savedPhone)}`);
          const existing = (await check.json())?.[0];
          if (existing?.status === "store_disabled") { setStep("disabled"); return; }
        }
        setStep("disabled"); return;
      }

      // Check returning customer
      const savedPhone = localStorage.getItem("bst_phone");
      if (savedPhone) {
        const checkRes = await fetch(`/api/customers?phone=${encodeURIComponent(savedPhone)}`);
        const existing = (await checkRes.json())?.[0];
        if (existing) {
          if (existing.status === "active") { router.push("/store"); return; }
          if (existing.status === "suspended") { setStep("suspended"); return; }
          if (existing.status === "store_disabled") { setStep("disabled"); return; }
          if (existing.status === "pending") { setCustomerId(existing.id); setStep("pending"); return; }
        }
      }
      setStep("form");
    } catch { setStep("invalid"); }
  };

  const submit = async () => {
    if (!name.trim() || !phone.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/customers", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ name:name.trim(), phone:phone.trim(), status:"pending" }) });
      const data = await res.json();

      if (data.error === "duplicate phone") {
        const existing = (await (await fetch(`/api/customers?phone=${encodeURIComponent(phone.trim())}`)).json())?.[0];
        if (existing?.status === "active") { localStorage.setItem("bst_phone", phone.trim()); router.push("/store"); return; }
        if (existing?.status === "suspended") { setStep("suspended"); setSubmitting(false); return; }
        if (existing?.status === "store_disabled") { setStep("disabled"); setSubmitting(false); return; }
        if (existing?.status === "pending") { setCustomerId(existing.id); localStorage.setItem("bst_phone", phone.trim()); setStep("pending"); setSubmitting(false); return; }
      }

      if (data.error) throw new Error(data.error);

      fetch("/api/notifications", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ type:"access", title:"Access request", body:`${name.trim()} is requesting access`, link:"/admin/customers" }) }).catch(()=>{});
      localStorage.setItem("bst_phone", phone.trim());
      setCustomerId(data.id);
      setStep("pending");
    } catch(e:any) { alert(e.message || "Something went wrong"); }
    setSubmitting(false);
  };

  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <div style={{ minHeight:"100dvh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 20px", background:"#050506", textAlign:"center", position:"relative", overflow:"hidden", fontFamily:"'Barlow',sans-serif", color:"#EEEEF5" }}>
      <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(30,30,38,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(30,30,38,0.4) 1px,transparent 1px)", backgroundSize:"40px 40px", pointerEvents:"none" }}/>
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 80% 50% at 50% -10%, rgba(200,150,42,0.08) 0%, transparent 65%)", pointerEvents:"none" }}/>
      <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", width:"100%", maxWidth:400 }}>{children}</div>
    </div>
  );

  const Circle = ({ color, children }: { color:string; children:React.ReactNode }) => (
    <div style={{ width:80, height:80, borderRadius:"50%", background:`${color}12`, border:`2px solid ${color}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, marginBottom:24 }}>{children}</div>
  );

  const Title = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:26, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.02em", marginBottom:10 }}>{children}</div>
  );

  const Sub = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize:14, color:"#5A5A70", maxWidth:280, lineHeight:1.7 }}>{children}</div>
  );

  const inp: React.CSSProperties = { width:"100%", padding:"14px", background:"#050506", border:"1px solid #1E1E26", borderRadius:8, color:"#EEEEF5", fontSize:15, fontFamily:"'Barlow',sans-serif", outline:"none", boxSizing:"border-box", WebkitAppearance:"none", transition:"border-color 0.15s" };
  const label: React.CSSProperties = { display:"block", fontSize:11, fontWeight:800, color:"#5A5A70", marginBottom:7, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" };

  if (step === "checking") return (
    <Wrap><div style={{ width:40, height:40, border:"3px solid #1E1E26", borderTopColor:"#C8962A", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></Wrap>
  );

  if (step === "invalid") return (
    <Wrap><Circle color="#E53E3E">✕</Circle><Title>Invalid QR Code</Title><Sub>This code is no longer valid. Ask the store owner for an updated QR code.</Sub></Wrap>
  );

  if (step === "disabled") return (
    <Wrap>
      <Circle color="#F97316">⏸</Circle>
      <Title>Store Closed</Title>
      <Sub>The store is temporarily closed. Please check back later.</Sub>
      <button style={{ marginTop:28, padding:"12px 28px", background:"#131318", color:"#A8A8B8", border:"1px solid #1E1E26", borderRadius:8, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:900, textTransform:"uppercase", cursor:"pointer", letterSpacing:"0.06em" }} onClick={()=>{ window.location.reload(); }}>Check Again</button>
    </Wrap>
  );

  if (step === "suspended") return (
    <Wrap><Circle color="#E53E3E">⏹</Circle><Title>Access Suspended</Title><Sub>Your access has been suspended. Contact the store owner for more information.</Sub></Wrap>
  );

  if (step === "pending") return (
    <Wrap>
      <div style={{ width:84, height:84, borderRadius:"50%", background:"rgba(249,115,22,0.08)", border:"2px solid #F97316", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, marginBottom:24, animation:"orangePulse 2.5s infinite" }}>⏳</div>
      <Title>Awaiting Approval</Title>
      <Sub>Your request has been sent to the store owner. This page updates automatically — no need to refresh.</Sub>
      <div style={{ background:"#0F0F13", border:"1px solid #1E1E26", borderRadius:14, padding:"16px 20px", width:"100%", marginTop:28 }}>
        <div style={{ fontSize:10, fontWeight:800, color:"#5A5A70", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:8 }}>Your Request</div>
        <div style={{ fontWeight:700, fontSize:16 }}>{name}</div>
        <div style={{ fontSize:13, color:"#5A5A70", marginTop:3 }}>{phone}</div>
      </div>
      {pollCount > 0 && <div style={{ fontSize:11, color:"#3A3A4A", marginTop:20 }}>Checking every 3 seconds…</div>}
      <style>{`@keyframes orangePulse{0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,0.3)}50%{box-shadow:0 0 0 20px rgba(249,115,22,0)}}`}</style>
    </Wrap>
  );

  if (step === "approved") return (
    <Wrap>
      <Circle color="#1DB954">✓</Circle>
      <Title>Access Granted</Title>
      <Sub>Welcome, {name.split(" ")[0]}! You've been approved. Entering the store now.</Sub>
      <button style={{ marginTop:28, padding:"16px 40px", background:"#C8962A", color:"#000", border:"none", borderRadius:10, fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:900, textTransform:"uppercase", cursor:"pointer", letterSpacing:"0.06em" }} onClick={()=>router.push("/store")}>Enter Store →</button>
    </Wrap>
  );

  // FORM
  return (
    <Wrap>
      <div style={{ width:68, height:68, background:"#C8962A", clipPath:"polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, fontWeight:900, color:"#000", marginBottom:20, boxShadow:"0 0 40px rgba(200,150,42,0.25)" }}>B</div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>Blackstone Reserve</div>
      <div style={{ fontSize:11, color:"#5A5A70", marginBottom:36, letterSpacing:"0.12em", textTransform:"uppercase", fontWeight:700, fontFamily:"'Barlow Condensed',sans-serif" }}>Private Members Store</div>
      <div style={{ width:"100%", background:"#0C0C10", border:"1px solid #1E1E26", borderRadius:18, padding:"26px 24px", position:"relative" }}>
        <div style={{ position:"absolute", top:0, left:32, right:32, height:1, background:"linear-gradient(90deg,transparent,#C8962A,transparent)" }}/>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, fontWeight:900, textTransform:"uppercase", marginBottom:6 }}>Request Access</div>
        <div style={{ fontSize:13, color:"#5A5A70", marginBottom:22, lineHeight:1.6 }}>Enter your details. The store owner will review and approve your access.</div>
        <div style={{ marginBottom:14 }}>
          <label style={label}>Full Name</label>
          <input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. James Kariuki" autoComplete="name"
            onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} onKeyDown={e=>e.key==="Enter"&&submit()} />
        </div>
        <div>
          <label style={label}>Phone Number</label>
          <input style={inp} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="07XX XXX XXX" type="tel" autoComplete="tel"
            onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} onKeyDown={e=>e.key==="Enter"&&submit()} />
        </div>
        <button onClick={submit} disabled={!name.trim()||!phone.trim()||submitting}
          style={{ width:"100%", padding:"15px", background:(!name.trim()||!phone.trim()||submitting)?"#1A1408":"#C8962A", color:(!name.trim()||!phone.trim()||submitting)?"#4A3810":"#000", border:"none", borderRadius:10, fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:900, letterSpacing:"0.06em", textTransform:"uppercase", cursor:(!name.trim()||!phone.trim()||submitting)?"not-allowed":"pointer", marginTop:20, transition:"all 0.15s", WebkitTapHighlightColor:"transparent" }}>
          {submitting ? "Sending…" : "Request Access →"}
        </button>
        <div style={{ fontSize:11, color:"#2E2E38", marginTop:16, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif", textAlign:"center" }}>🔒 Private · By Approval Only</div>
      </div>
    </Wrap>
  );
}

export default function GatePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:"100dvh", background:"#050506", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:36, height:36, border:"3px solid #1E1E26", borderTopColor:"#C8962A", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <GateContent />
    </Suspense>
  );
}
