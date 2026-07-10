"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const fmt = (n: number) => `KES ${Number(n).toFixed(2)}`;
type Product = { id:string; name:string; description:string|null; price:number; stock:number; emoji:string; image_url:string|null; is_active:boolean };
type CartItem = Product & { qty:number };
type Msg = { id:string; from_admin:boolean; body:string; created_at:string };

export default function StorePage() {
  const router = useRouter();
  const msgEndRef = useRef<HTMLDivElement>(null);
  const subscribedRef = useRef(false);
  const channelRef = useRef<any>(null);

  const [customer, setCustomer] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"store"|"cart"|"checkout"|"confirmed"|"messages">("store");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any>(null);
  const [toast, setToast] = useState<string|null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    init();
    return () => {
      // Cleanup on unmount
      if (channelRef.current) {
        try { channelRef.current.unsubscribe(); } catch {}
        channelRef.current = null;
      }
      subscribedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (view === "messages") {
      setUnread(0);
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
    }
  }, [view, messages.length]);

  const redirectToGate = () => {
    // Always preserve the token when redirecting back to gate
    const token = localStorage.getItem("bst_token");
    if (token) router.push(`/gate?token=${token}`);
    else router.push("/gate");
  };

  const init = async () => {
    const phone = localStorage.getItem("bst_phone");
    if (!phone) { redirectToGate(); return; }

    const res = await fetch(`/api/customers?phone=${encodeURIComponent(phone)}`);
    const data = await res.json();
    const cust = data?.[0];

    if (!cust) { redirectToGate(); return; }
    if (cust.status === "suspended") { redirectToGate(); return; }
    if (cust.status === "store_disabled") { redirectToGate(); return; }
    if (cust.status !== "active") { redirectToGate(); return; }

    setCustomer(cust);

    const [prodRes, msgRes] = await Promise.all([
      fetch("/api/products"),
      fetch(`/api/messages?customer_id=${cust.id}`)
    ]);
    const [prodData, msgData] = await Promise.all([prodRes.json(), msgRes.json()]);
    setProducts((Array.isArray(prodData) ? prodData : []).filter((p:Product) => p.is_active));
    if (Array.isArray(msgData)) setMessages(msgData);
    setLoading(false);

    // Guard: only subscribe once even in React Strict Mode
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    // Remove any existing channel with same name before creating
    const channelName = `store-${cust.id}`;
    try {
      const existing = supabase.getChannels().find((c: any) => c.topic === `realtime:${channelName}`);
      if (existing) { await supabase.removeChannel(existing); }
    } catch {}

    const ch = supabase.channel(channelName)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `customer_id=eq.${cust.id}`
      }, (payload: any) => {
        setMessages(prev => {
          // Deduplicate
          if (prev.find(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as Msg];
        });
        if (payload.new.from_admin) {
          setUnread(prev => prev + 1);
          showToast("💬 New message from store");
        }
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "customers",
        filter: `id=eq.${cust.id}`
      }, (payload: any) => {
        const status = payload.new.status;
        if (status === "suspended" || status === "store_disabled") {
          redirectToGate();
        }
      });

    ch.subscribe((status: string) => {
      if (status === "SUBSCRIBED") channelRef.current = ch;
    });
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
  const total = cart.reduce((s,c) => s + c.price * c.qty, 0);
  const itemCount = cart.reduce((s,c) => s + c.qty, 0);

  const addToCart = (p: Product) => {
    if (p.stock <= 0) { showToast("Out of stock"); return; }
    setCart(prev => {
      const ex = prev.find(c => c.id === p.id);
      if (ex) {
        if (ex.qty >= p.stock) { showToast("Max stock reached"); return prev; }
        return prev.map(c => c.id === p.id ? {...c,qty:c.qty+1} : c);
      }
      return [...prev, {...p,qty:1}];
    });
    showToast(`✓ ${p.name}`);
  };

  const updateQty = (id:string, d:number) => setCart(prev => prev.map(c => c.id===id ? {...c,qty:Math.max(0,c.qty+d)} : c).filter(c => c.qty>0));
  const showToast = (msg:string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const placeOrder = async () => {
    if (!customer || !location.trim()) return;
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ customer_id:customer.id, location:location.trim(), notes:notes.trim()||null, total, items:cart.map(c=>({product_id:c.id,name:c.name,price:c.price,quantity:c.qty})) })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed");
      setPlacedOrder(data); setCart([]); setLocation(""); setNotes(""); setView("confirmed");
    } catch(e:any) { showToast(e.message || "Failed to place order"); }
    setPlacing(false);
  };

  const sendMessage = async () => {
    if (!msgInput.trim() || !customer || sending) return;
    setSending(true);
    const res = await fetch("/api/messages", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({customer_id:customer.id,from_admin:false,body:msgInput.trim()}) });
    const data = await res.json();
    if (!data.error) {
      setMessages(prev => prev.find(m=>m.id===data.id) ? prev : [...prev,data]);
      setMsgInput("");
      setTimeout(() => msgEndRef.current?.scrollIntoView({behavior:"smooth"}), 50);
    }
    setSending(false);
  };

  // Shared styles
  const S = {
    screen:     { minHeight:"100dvh", background:"#050506", color:"#EEEEF5", fontFamily:"'Barlow',sans-serif" } as React.CSSProperties,
    topbar:     { position:"sticky" as const, top:0, zIndex:50, height:56, background:"rgba(5,5,6,0.96)", borderBottom:"1px solid #1E1E26", display:"flex", alignItems:"center", padding:"0 16px", gap:12, backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)" },
    bottomnav:  { position:"fixed" as const, bottom:0, left:0, right:0, height:62, background:"rgba(8,8,10,0.97)", borderTop:"1px solid #1E1E26", display:"flex", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)", zIndex:50, paddingBottom:"env(safe-area-inset-bottom,0px)" },
    navBtn:     (a:boolean): React.CSSProperties => ({ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, cursor:"pointer", border:"none", background:"none", color:a?"#E8B84B":"#5A5A70", transition:"color 0.15s", padding:"6px 0", WebkitTapHighlightColor:"transparent" }),
    inp:        { width:"100%", padding:"13px 14px", background:"#0A0A0D", border:"1px solid #1E1E26", borderRadius:10, color:"#EEEEF5", fontSize:15, fontFamily:"'Barlow',sans-serif", outline:"none", boxSizing:"border-box" as const, WebkitAppearance:"none" as const, transition:"border-color 0.15s" },
    goldBtn:    (dis=false): React.CSSProperties => ({ width:"100%", padding:"16px", background:dis?"#1E1408":"#C8962A", color:dis?"#4A3810":"#000", border:"none", borderRadius:10, fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:900, letterSpacing:"0.06em", textTransform:"uppercase" as const, cursor:dis?"not-allowed":"pointer", transition:"all 0.15s", WebkitTapHighlightColor:"transparent" }),
    backBtn:    { background:"none", border:"none", color:"#A8A8B8", cursor:"pointer", fontSize:24, padding:"4px 8px", lineHeight:1, WebkitTapHighlightColor:"transparent" } as React.CSSProperties,
    label:      { display:"block", fontSize:11, fontWeight:800, color:"#5A5A70", marginBottom:7, letterSpacing:"0.1em", textTransform:"uppercase" as const, fontFamily:"'Barlow Condensed',sans-serif" },
  };

  if (loading) return (
    <div style={{...S.screen,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:40,height:40,border:"3px solid #1E1E26",borderTopColor:"#C8962A",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── MESSAGES ──
  if (view === "messages") return (
    <div style={{...S.screen,display:"flex",flexDirection:"column"}}>
      <div style={S.topbar}>
        <button onClick={()=>setView("store")} style={S.backBtn}>←</button>
        <div style={{width:36,height:36,borderRadius:"50%",background:"#C8962A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#000",flexShrink:0}}>B</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.04em",lineHeight:1.2}}>Store Support</div>
          <div style={{fontSize:10,color:"#1DB954",fontWeight:700,marginTop:1}}>● Online</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px",paddingBottom:"90px",display:"flex",flexDirection:"column",gap:8}}>
        {messages.length===0 && (
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#5A5A70",gap:12,paddingTop:80,textAlign:"center"}}>
            <span style={{fontSize:56,opacity:0.15}}>💬</span>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,textTransform:"uppercase",letterSpacing:"0.08em"}}>Start a conversation</span>
            <span style={{fontSize:13,color:"#3A3A4A",maxWidth:220}}>We reply as fast as possible</span>
          </div>
        )}
        {messages.map(m=>(
          <div key={m.id} style={{display:"flex",flexDirection:"column",alignSelf:m.from_admin?"flex-start":"flex-end",maxWidth:"84%"}}>
            <div style={{padding:"11px 15px",borderRadius:m.from_admin?"16px 16px 16px 4px":"16px 16px 4px 16px",fontSize:14,lineHeight:1.6,background:m.from_admin?"#141418":"#C8962A",color:m.from_admin?"#EEEEF5":"#000",fontWeight:m.from_admin?400:600,border:m.from_admin?"1px solid #242430":"none",wordBreak:"break-word"}}>{m.body}</div>
            <div style={{fontSize:10,color:"#3A3A4A",marginTop:4,paddingLeft:m.from_admin?4:0,paddingRight:m.from_admin?0:4}}>{m.from_admin?"Store":"You"} · {new Date(m.created_at).toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit"})}</div>
          </div>
        ))}
        <div ref={msgEndRef}/>
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,padding:"10px 14px",paddingBottom:"calc(10px + env(safe-area-inset-bottom,0px))",background:"rgba(8,8,10,0.97)",borderTop:"1px solid #1E1E26",display:"flex",gap:8,backdropFilter:"blur(20px)"}}>
        <input value={msgInput} onChange={e=>setMsgInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()} placeholder="Type a message…"
          style={{...S.inp,flex:1,padding:"12px 14px",fontSize:14}} onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
        <button onClick={sendMessage} disabled={!msgInput.trim()||sending}
          style={{padding:"12px 18px",background:!msgInput.trim()||sending?"#1A1208":"#C8962A",color:!msgInput.trim()||sending?"#4A3810":"#000",border:"none",borderRadius:10,fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.06em",cursor:!msgInput.trim()||sending?"not-allowed":"pointer",WebkitTapHighlightColor:"transparent"}}>
          {sending?"…":"Send"}
        </button>
      </div>
    </div>
  );

  // ── CONFIRMED ──
  if (view === "confirmed") return (
    <div style={{...S.screen,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 20px",textAlign:"center"}}>
      <div style={{width:90,height:90,borderRadius:"50%",background:"rgba(29,185,84,0.08)",border:"2px solid #1DB954",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,marginBottom:24}}>✓</div>
      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:32,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.02em",marginBottom:8}}>Order Placed!</div>
      <div style={{fontSize:15,color:"#5A5A70",marginBottom:6}}>We'll call you on {customer?.phone}</div>
      {placedOrder && <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:"#E8B84B",marginBottom:32,letterSpacing:"0.06em"}}>{placedOrder.order_ref}</div>}
      <div style={{display:"flex",flexDirection:"column",gap:12,width:"100%",maxWidth:340}}>
        <button style={S.goldBtn()} onClick={()=>{setPlacedOrder(null);setView("store");}}>← Continue Shopping</button>
        <button style={{...S.goldBtn(),background:"#101014",color:"#A8A8B8",border:"1px solid #1E1E26"}} onClick={()=>setView("messages")}>💬 Message Store</button>
      </div>
    </div>
  );

  // ── CHECKOUT ──
  if (view === "checkout") return (
    <div style={{...S.screen,paddingBottom:40}}>
      <div style={S.topbar}>
        <button onClick={()=>setView("cart")} style={S.backBtn}>←</button>
        <div style={{flex:1,fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.04em"}}>Checkout</div>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#E8B84B"}}>{fmt(total)}</div>
      </div>
      <div style={{padding:"20px 16px",maxWidth:520,margin:"0 auto",width:"100%"}}>
        <div style={{background:"#0C0C10",border:"1px solid #1E1E26",borderRadius:14,padding:"14px 18px",marginBottom:20}}>
          <div style={{...S.label,marginBottom:5}}>Ordering As</div>
          <div style={{fontWeight:700,fontSize:16}}>{customer?.name}</div>
          <div style={{fontSize:13,color:"#5A5A70",marginTop:2}}>{customer?.phone}</div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={S.label}>Delivery Location *</label>
          <input style={S.inp} value={location} onChange={e=>setLocation(e.target.value)} placeholder="Estate, area, or landmark…" autoComplete="street-address"
            onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
        </div>
        <div style={{marginBottom:22}}>
          <label style={S.label}>Order Notes (Optional)</label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special instructions, preferences…" rows={3}
            style={{...S.inp,minHeight:85,resize:"vertical",fontFamily:"'Barlow',sans-serif"}}
            onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
        </div>
        <div style={{background:"#0C0C10",border:"1px solid #1E1E26",borderRadius:14,padding:"14px 18px",marginBottom:24}}>
          <div style={{...S.label,marginBottom:12}}>Order Summary</div>
          {cart.map(item=>(
            <div key={item.id} style={{display:"flex",justifyContent:"space-between",marginBottom:10,fontSize:14}}>
              <span style={{color:"#A8A8B8"}}>{item.name}<span style={{color:"#5A5A70"}}> × {item.qty}</span></span>
              <span style={{fontWeight:700}}>{fmt(item.price*item.qty)}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1E1E26",paddingTop:12,marginTop:6}}>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,textTransform:"uppercase",fontSize:15}}>Total</span>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#E8B84B"}}>{fmt(total)}</span>
          </div>
        </div>
        <button style={S.goldBtn(!location.trim()||placing)} onClick={placeOrder} disabled={!location.trim()||placing}>
          {placing?"Placing Order…":"Confirm Order →"}
        </button>
      </div>
    </div>
  );

  // ── CART ──
  if (view === "cart") return (
    <div style={{...S.screen,paddingBottom:80}}>
      <div style={S.topbar}>
        <button onClick={()=>setView("store")} style={S.backBtn}>←</button>
        <div style={{flex:1,fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.04em"}}>Cart</div>
        {itemCount>0 && <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#E8B84B"}}>{fmt(total)}</div>}
      </div>
      <div style={{padding:"16px",maxWidth:520,margin:"0 auto",width:"100%"}}>
        {cart.length===0 ? (
          <div style={{textAlign:"center",padding:"80px 20px",color:"#5A5A70"}}>
            <div style={{fontSize:56,marginBottom:16,opacity:0.15}}>🛒</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:20,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:24}}>Your cart is empty</div>
            <button style={{...S.goldBtn(),maxWidth:200,margin:"0 auto"}} onClick={()=>setView("store")}>Browse Products</button>
          </div>
        ) : (
          <>
            {cart.map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:"1px solid #1E1E26"}}>
                <div style={{width:60,height:60,background:"#0C0C10",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
                  {item.image_url?<img src={item.image_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:28}}>{item.emoji}</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>{item.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <button onClick={()=>updateQty(item.id,-1)} style={{width:32,height:32,borderRadius:8,background:"#0C0C10",border:"1px solid #1E1E26",color:"#A8A8B8",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>−</button>
                    <span style={{fontSize:16,fontWeight:900,minWidth:24,textAlign:"center"}}>{item.qty}</span>
                    <button onClick={()=>updateQty(item.id,+1)} style={{width:32,height:32,borderRadius:8,background:"#0C0C10",border:"1px solid #1E1E26",color:"#A8A8B8",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent"}}>+</button>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#E8B84B"}}>{fmt(item.price*item.qty)}</div>
                  <button onClick={()=>updateQty(item.id,-item.qty)} style={{fontSize:11,color:"#E53E3E",background:"none",border:"none",cursor:"pointer",marginTop:4,WebkitTapHighlightColor:"transparent"}}>Remove</button>
                </div>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"20px 0",marginBottom:20}}>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,textTransform:"uppercase",fontSize:16}}>Total</span>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,color:"#E8B84B"}}>{fmt(total)}</span>
            </div>
            <button style={S.goldBtn()} onClick={()=>setView("checkout")}>Proceed to Checkout →</button>
          </>
        )}
      </div>
      <div style={S.bottomnav}>
        <button style={S.navBtn(false)} onClick={()=>setView("store")}><span style={{fontSize:22}}>🏪</span><span style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:"'Barlow Condensed',sans-serif"}}>Store</span></button>
        <button style={S.navBtn(true)}><span style={{fontSize:22}}>🛒</span><span style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:"'Barlow Condensed',sans-serif"}}>Cart{itemCount>0?` (${itemCount})`:""}</span></button>
        <button style={S.navBtn(false)} onClick={()=>setView("messages")}><span style={{fontSize:22,position:"relative"}}>{unread>0&&<span style={{position:"absolute",top:-5,right:-8,width:17,height:17,borderRadius:"50%",background:"#E53E3E",fontSize:9,fontWeight:900,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</span>}💬</span><span style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:"'Barlow Condensed',sans-serif"}}>Messages</span></button>
      </div>
    </div>
  );

  // ── STORE (main) ──
  return (
    <div style={{...S.screen,paddingBottom:80}}>
      <div style={S.topbar}>
        <div style={{width:30,height:30,background:"#C8962A",clipPath:"polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#000",flexShrink:0}}>B</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.06em",lineHeight:1.2}}>Blackstone Reserve</div>
          <div style={{fontSize:10,color:"#5A5A70",marginTop:1}}>Hello, {customer?.name?.split(" ")[0]} 👋</div>
        </div>
        <button onClick={()=>setView("cart")} style={{position:"relative",background:"#0C0C10",border:"1px solid #1E1E26",borderRadius:10,width:44,height:44,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0,WebkitTapHighlightColor:"transparent",transition:"border-color 0.15s"}}
          onMouseEnter={e=>(e.currentTarget.style.borderColor="#C8962A")} onMouseLeave={e=>(e.currentTarget.style.borderColor="#1E1E26")}>
          🛒
          {itemCount>0&&<span style={{position:"absolute",top:-6,right:-6,width:20,height:20,borderRadius:"50%",background:"#C8962A",fontSize:10,fontWeight:900,color:"#000",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(200,150,42,0.5)"}}>{itemCount}</span>}
        </button>
      </div>

      <div style={{padding:"12px 16px",borderBottom:"1px solid #1E1E26",background:"#030304"}}>
        <div style={{position:"relative",maxWidth:600}}>
          <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:"#5A5A70",fontSize:16,pointerEvents:"none"}}>⌕</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…"
            style={{...S.inp,paddingLeft:42,fontSize:14,background:"#080810"}} onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
        </div>
      </div>

      {!search && (
        <div style={{padding:"16px 16px 0",background:"linear-gradient(180deg,rgba(200,150,42,0.03) 0%,transparent 100%)"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(200,150,42,0.06)",border:"1px solid rgba(200,150,42,0.15)",borderRadius:4,padding:"4px 12px",fontSize:10,fontWeight:800,color:"#C8962A",letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:10}}>🔒 Members Only</div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.04em",color:"#EEEEF5"}}>Premium Selections</div>
          <div style={{fontSize:12,color:"#5A5A70",marginTop:4,marginBottom:12}}>{products.length} items · Delivered to your door</div>
        </div>
      )}

      <div style={{padding:"12px 16px 20px",display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,maxWidth:800,margin:"0 auto",width:"100%"}}>
        {filtered.map(p=>(
          <div key={p.id} style={{background:"#0C0C10",border:"1px solid #1E1E26",borderRadius:16,overflow:"hidden",transition:"border-color 0.15s, transform 0.12s",cursor:"pointer"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#C8962A90";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#1E1E26";}}
            onTouchStart={e=>{e.currentTarget.style.transform="scale(0.97)";e.currentTarget.style.transition="transform 0.1s";}}
            onTouchEnd={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.transition="transform 0.2s";}}>
            <div style={{width:"100%",aspectRatio:"1",background:"#080810",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative"}}>
              {p.image_url
                ? <img src={p.image_url} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}} loading="lazy"/>
                : <span style={{fontSize:54,filter:"drop-shadow(0 4px 12px rgba(0,0,0,0.5))"}}>{p.emoji}</span>
              }
              {p.stock<=5&&p.stock>0&&<div style={{position:"absolute",top:8,left:8,background:"rgba(249,115,22,0.9)",color:"#fff",fontSize:9,fontWeight:800,padding:"3px 8px",borderRadius:4,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.05em",backdropFilter:"blur(4px)"}}>LOW STOCK</div>}
              {p.stock<=0&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#E53E3E",fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase",letterSpacing:"0.08em"}}>Sold Out</div>}
            </div>
            <div style={{padding:"11px 13px 13px"}}>
              <div style={{fontSize:13,fontWeight:700,lineHeight:1.35,marginBottom:5,color:"#EEEEF5"}}>{p.name}</div>
              {p.description && <div style={{fontSize:11,color:"#5A5A70",lineHeight:1.4,marginBottom:8,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" as const}}>{p.description}</div>}
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:19,fontWeight:900,color:"#E8B84B",marginBottom:10}}>{fmt(p.price)}</div>
              <button onClick={()=>addToCart(p)} disabled={p.stock<=0}
                style={{width:"100%",padding:"11px",background:p.stock<=0?"#111116":"#C8962A",color:p.stock<=0?"#2E2E38":"#000",border:p.stock<=0?"1px solid #1A1A20":"none",borderRadius:9,fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.06em",cursor:p.stock<=0?"not-allowed":"pointer",transition:"opacity 0.12s, transform 0.1s",WebkitTapHighlightColor:"transparent"}}>
                {p.stock<=0?"Unavailable":"+ Add to Cart"}
              </button>
            </div>
          </div>
        ))}
        {filtered.length===0 && (
          <div style={{gridColumn:"1/-1",textAlign:"center",padding:"60px 20px",color:"#5A5A70"}}>
            <div style={{fontSize:48,marginBottom:14,opacity:0.15}}>🔍</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,textTransform:"uppercase",letterSpacing:"0.06em"}}>No results for "{search}"</div>
          </div>
        )}
      </div>

      <div style={S.bottomnav}>
        <button style={S.navBtn(true)}><span style={{fontSize:22}}>🏪</span><span style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:"'Barlow Condensed',sans-serif"}}>Store</span></button>
        <button style={S.navBtn(false)} onClick={()=>setView("cart")}>
          <span style={{fontSize:22,position:"relative"}}>🛒{itemCount>0&&<span style={{position:"absolute",top:-5,right:-8,width:18,height:18,borderRadius:"50%",background:"#C8962A",fontSize:9,fontWeight:900,color:"#000",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 6px rgba(200,150,42,0.5)"}}>{itemCount}</span>}</span>
          <span style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:"'Barlow Condensed',sans-serif"}}>Cart</span>
        </button>
        <button style={S.navBtn(false)} onClick={()=>setView("messages")}>
          <span style={{fontSize:22,position:"relative"}}>💬{unread>0&&<span style={{position:"absolute",top:-5,right:-8,width:18,height:18,borderRadius:"50%",background:"#E53E3E",fontSize:9,fontWeight:900,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{unread}</span>}</span>
          <span style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.05em",fontFamily:"'Barlow Condensed',sans-serif"}}>Messages</span>
        </button>
      </div>

      {toast && (
        <div style={{position:"fixed",bottom:78,left:"50%",transform:"translateX(-50%)",background:"#0F0F13",border:"1px solid #1E1E26",borderRadius:10,padding:"11px 22px",fontSize:12,fontWeight:700,zIndex:100,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"'Barlow Condensed',sans-serif",whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,0.8)"}}>
          {toast}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{-webkit-tap-highlight-color:transparent}`}</style>
    </div>
  );
}
