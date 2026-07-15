"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const fmt = (n: number) => `KES ${Number(n||0).toFixed(2)}`;
const timeAgo = (d: string) => { const s=Math.floor((Date.now()-new Date(d).getTime())/1000); if(s<60)return`${s}s ago`; if(s<3600)return`${Math.floor(s/60)}m ago`; if(s<86400)return`${Math.floor(s/3600)}h ago`; return`${Math.floor(s/86400)}d ago`; };

async function api(url: string, opts: RequestInit = {}) {
  const { data: { session } } = await createClient().auth.getSession();
  return fetch(url, { ...opts, headers: { "Content-Type":"application/json", ...(session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{}), ...(opts.headers||{}) } });
}

type Order = { id:string; order_ref:string; customer_id:string; status:string; payment_status:string; payment_timing:string; total:number; amount_paid:number; created_at:string; payment_submitted_at:string|null; customers?:{name:string;phone:string} };

export default function PaymentsPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [partialModal, setPartialModal] = useState<Order|null>(null);
  const [partialAmt, setPartialAmt] = useState("");
  const [saving, setSaving] = useState<string|null>(null);

  useEffect(() => {
    load();
    const ch = supabase.channel("pay-rt")
      .on("postgres_changes",{event:"*",schema:"public",table:"orders"},load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const load = async () => {
    const res = await api("/api/orders");
    const data = await res.json();
    setOrders(Array.isArray(data)?data.filter((o:Order)=>o.status!=="cancelled"):[]);
    setLoading(false);
  };

  const pay = async (order: Order, action: "confirm"|"full"|"reject", amount?: number) => {
    setSaving(order.id);
    const body: any = { action: action==="reject" ? "reject_payment" : "confirm_payment", order_id: order.id, customer_id: order.customer_id };
    if (action==="full") body.amount = order.total - (order.amount_paid||0);
    if (action==="confirm") body.amount = order.total - (order.amount_paid||0);
    if (amount) body.amount = amount;
    const res = await api("/api/payments", { method:"POST", body:JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok||data.error) { toast.error(data.error||"Failed"); setSaving(null); return; }
    toast.success(action==="reject"?"Marked as not received":"Payment confirmed ✓");
    setSaving(null); setPartialModal(null); setPartialAmt("");
    await load();
  };

  const submitted = orders.filter(o=>o.payment_status==="submitted");
  const unpaid    = orders.filter(o=>o.payment_status==="unpaid"||o.payment_status==="partial");
  const totalReceived = orders.reduce((s,o)=>s+(o.amount_paid||0),0);
  const totalOwed     = unpaid.reduce((s,o)=>s+(o.total-(o.amount_paid||0)),0);

  const TIMING: Record<string,{label:string;color:string}> = {
    before_delivery:{label:"Before Delivery",color:"#1DB954"},
    upon_delivery:  {label:"Upon Delivery",  color:"#E8B84B"},
    after_delivery: {label:"After Delivery", color:"#8B5CF6"},
  };

  const Card = ({ o, isSubmitted }: { o:Order; isSubmitted?:boolean }) => {
    const balance = o.total-(o.amount_paid||0);
    const timing  = TIMING[o.payment_timing]||{label:o.payment_timing,color:"#A8A8B8"};
    const busy = saving===o.id;
    return (
      <div style={{ background:"#0C0C0F", border:`1px solid ${isSubmitted?"rgba(200,150,42,0.3)":"#1E1E26"}`, borderRadius:14, padding:"16px", marginBottom:12, borderLeft:`4px solid ${isSubmitted?"#C8962A":"#E53E3E"}` }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:"#E8B84B", fontWeight:700 }}>{o.order_ref}</div>
            <div style={{ fontSize:15, fontWeight:800, color:"#EEEEF5", marginTop:3 }}>{o.customers?.name||"—"}</div>
            <div style={{ fontSize:12, color:"#5A5A70", marginTop:2 }}>{o.customers?.phone} · {timeAgo(o.created_at)}</div>
          </div>
          <div style={{ textAlign:"right", display:"flex", flexDirection:"column", gap:5 }}>
            <span style={{ fontSize:10, fontWeight:800, padding:"3px 10px", borderRadius:4, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", letterSpacing:"0.06em", background:`${timing.color}18`, color:timing.color }}>
              {timing.label}
            </span>
            {isSubmitted && <span style={{ fontSize:10, fontWeight:800, padding:"3px 10px", borderRadius:4, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", letterSpacing:"0.06em", background:"rgba(200,150,42,0.12)", color:"#E8B84B" }}>⏳ Claims Paid</span>}
          </div>
        </div>

        {/* Amounts — clean 3 boxes */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
          <div style={{ background:"#050506", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ fontSize:9, fontWeight:800, color:"#5A5A70", textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:4 }}>Total</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:900, color:"#EEEEF5" }}>{fmt(o.total)}</div>
          </div>
          <div style={{ background:"#050506", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ fontSize:9, fontWeight:800, color:"#5A5A70", textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:4 }}>Paid</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:900, color:"#1DB954" }}>{fmt(o.amount_paid||0)}</div>
          </div>
          <div style={{ background:"#050506", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ fontSize:9, fontWeight:800, color:"#5A5A70", textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:"'Barlow Condensed',sans-serif", marginBottom:4 }}>Balance</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:900, color:balance>0?"#E53E3E":"#1DB954" }}>{fmt(balance)}</div>
          </div>
        </div>

        {/* Action buttons */}
        {isSubmitted ? (
          // Customer claimed they paid → confirm or reject
          <div style={{ display:"flex", gap:8 }}>
            <button disabled={busy} onClick={()=>pay(o,"confirm")}
              style={{ flex:2, padding:"13px", background:busy?"#1A1A20":"#1DB954", color:busy?"#3A3A4A":"#000", border:"none", borderRadius:9, fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.06em", cursor:busy?"not-allowed":"pointer", transition:"all 0.15s" }}>
              {busy?"…":"✓ Confirm Payment"}
            </button>
            <button disabled={busy} onClick={()=>pay(o,"reject")}
              style={{ flex:1, padding:"13px", background:"rgba(229,62,62,0.08)", color:"#E53E3E", border:"1px solid rgba(229,62,62,0.2)", borderRadius:9, fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.06em", cursor:busy?"not-allowed":"pointer" }}>
              ✕ Not Received
            </button>
          </div>
        ) : (
          // Admin manually recording payment
          <div style={{ display:"flex", gap:8 }}>
            <button disabled={busy} onClick={()=>pay(o,"full")}
              style={{ flex:1, padding:"12px", background:busy?"#1A1A20":"#C8962A", color:busy?"#3A3A4A":"#000", border:"none", borderRadius:9, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.06em", cursor:busy?"not-allowed":"pointer", transition:"all 0.15s" }}>
              {busy?"…":"💵 Full Payment"}
            </button>
            <button disabled={busy} onClick={()=>{setPartialModal(o);setPartialAmt("");}}
              style={{ flex:1, padding:"12px", background:"rgba(200,150,42,0.08)", color:"#E8B84B", border:"1px solid rgba(200,150,42,0.2)", borderRadius:9, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.06em", cursor:busy?"not-allowed":"pointer" }}>
              ½ Partial
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ fontFamily:"'Barlow',sans-serif", color:"#EEEEF5" }}>
      <div style={{ marginBottom:22 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:26, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.04em" }}>Payments</div>
        <div style={{ fontSize:12, color:"#5A5A70", marginTop:3 }}>Confirm claims and record payments</div>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:24 }}>
        {[
          { label:"Money In",         value:fmt(totalReceived),     color:"#1DB954" },
          { label:"Awaiting Confirm", value:String(submitted.length),color:"#E8B84B", sub:submitted.length>0?"Need action":"" },
          { label:"Outstanding",      value:fmt(totalOwed),          color:"#E53E3E" },
          { label:"Paid Orders",      value:String(orders.filter(o=>o.payment_status==="paid").length), color:"#1DB954" },
        ].map(s=>(
          <div key={s.label} style={{ background:"#0C0C0F", border:"1px solid #1E1E26", borderRadius:12, padding:"14px 16px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:s.color }}/>
            <div style={{ fontSize:9, fontWeight:800, textTransform:"uppercase", letterSpacing:"0.1em", color:"#5A5A70", fontFamily:"'Barlow Condensed',sans-serif" }}>{s.label}</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:900, color:s.color, marginTop:6, lineHeight:1 }}>{s.value}</div>
            {s.sub&&<div style={{ fontSize:10, color:"#E8B84B", marginTop:4, fontWeight:700 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ color:"#5A5A70", fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", letterSpacing:"0.1em" }}>Loading…</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
          {/* LEFT: Customer submitted payment claims */}
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:"#E8B84B" }}>⏳ Awaiting Your Confirmation</span>
              <span style={{ background:"rgba(200,150,42,0.15)", color:"#E8B84B", padding:"2px 9px", borderRadius:10, fontSize:11, fontWeight:900 }}>{submitted.length}</span>
            </div>
            {submitted.length===0 ? (
              <div style={{ background:"#0C0C0F", border:"1px solid #1E1E26", borderRadius:14, padding:"40px 20px", textAlign:"center", color:"#5A5A70" }}>
                <div style={{ fontSize:32, marginBottom:10, opacity:0.2 }}>✓</div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, textTransform:"uppercase" }}>All clear</div>
                <div style={{ fontSize:12, marginTop:6 }}>No customers awaiting confirmation</div>
              </div>
            ) : submitted.map(o=><Card key={o.id} o={o} isSubmitted />)}
          </div>

          {/* RIGHT: Unpaid / needs payment recorded */}
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ color:"#E53E3E" }}>⚠ Pending Payments</span>
              <span style={{ background:"rgba(229,62,62,0.12)", color:"#E53E3E", padding:"2px 9px", borderRadius:10, fontSize:11, fontWeight:900 }}>{unpaid.length}</span>
            </div>
            {unpaid.length===0 ? (
              <div style={{ background:"#0C0C0F", border:"1px solid #1E1E26", borderRadius:14, padding:"40px 20px", textAlign:"center", color:"#5A5A70" }}>
                <div style={{ fontSize:32, marginBottom:10, opacity:0.2 }}>💰</div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, textTransform:"uppercase" }}>No pending payments</div>
              </div>
            ) : unpaid.map(o=><Card key={o.id} o={o} />)}
          </div>
        </div>
      )}

      {/* Partial payment modal — minimal */}
      {partialModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={()=>setPartialModal(null)}>
          <div style={{ background:"#0C0C0F", border:"1px solid #1E1E26", borderRadius:18, width:"100%", maxWidth:380, boxShadow:"0 24px 60px rgba(0,0,0,0.95)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"20px 22px 0" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:900, textTransform:"uppercase", marginBottom:4 }}>Partial Payment</div>
              <div style={{ fontSize:12, color:"#5A5A70", marginBottom:6 }}>{partialModal.order_ref} · {partialModal.customers?.name}</div>
              <div style={{ fontSize:13, color:"#E53E3E", fontWeight:700, marginBottom:18 }}>Balance due: {fmt(partialModal.total-(partialModal.amount_paid||0))}</div>
              <label style={{ display:"block", fontSize:10, fontWeight:800, color:"#5A5A70", marginBottom:7, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif" }}>Amount Received (KES)</label>
              <input type="number" min="1" step="0.01" value={partialAmt} onChange={e=>setPartialAmt(e.target.value)} placeholder="0.00" autoFocus
                style={{ width:"100%", padding:"13px 14px", background:"#050506", border:"1px solid #1E1E26", borderRadius:8, color:"#EEEEF5", fontSize:16, fontFamily:"'Barlow',sans-serif", outline:"none", boxSizing:"border-box", marginBottom:18 }}
                onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")}
                onKeyDown={e=>e.key==="Enter"&&partialAmt&&+partialAmt>0&&pay(partialModal,"full",+partialAmt)} />
            </div>
            <div style={{ padding:"0 22px 22px", display:"flex", gap:8 }}>
              <button onClick={()=>setPartialModal(null)} style={{ flex:1, padding:"13px", background:"#131318", color:"#A8A8B8", border:"1px solid #1E1E26", borderRadius:9, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:900, textTransform:"uppercase", cursor:"pointer" }}>Cancel</button>
              <button disabled={!partialAmt||+partialAmt<=0||saving===partialModal.id} onClick={()=>partialAmt&&+partialAmt>0&&pay(partialModal,"full",+partialAmt)}
                style={{ flex:2, padding:"13px", background:!partialAmt||+partialAmt<=0?"#1E1408":"#C8962A", color:!partialAmt||+partialAmt<=0?"#4A3810":"#000", border:"none", borderRadius:9, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:900, textTransform:"uppercase", cursor:!partialAmt||+partialAmt<=0?"not-allowed":"pointer" }}>
                Record {partialAmt?fmt(+partialAmt):"Amount"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
