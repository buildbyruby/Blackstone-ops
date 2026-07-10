"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchAdmin } from "@/lib/fetch-admin";
import { toast } from "sonner";

const fmt = (n: number) => `KES ${Number(n).toFixed(2)}`;
const timeAgo = (d: string) => { const s=Math.floor((Date.now()-new Date(d).getTime())/1000); if(s<60)return`${s}s ago`; if(s<3600)return`${Math.floor(s/60)}m ago`; if(s<86400)return`${Math.floor(s/3600)}h ago`; return`${Math.floor(s/86400)}d ago`; };

const STATUSES = ["new","confirmed","processing","out-for-delivery","delivered","cancelled"] as const;
type Status = typeof STATUSES[number];
const STATUS_CFG: Record<Status,{label:string;color:string;bg:string}> = {
  "new":              {label:"New",             color:"#3B82F6",bg:"rgba(59,130,246,0.1)"},
  "confirmed":        {label:"Confirmed",       color:"#E8B84B",bg:"rgba(232,184,75,0.1)"},
  "processing":       {label:"Processing",      color:"#8B5CF6",bg:"rgba(139,92,246,0.1)"},
  "out-for-delivery": {label:"Out for Delivery",color:"#F97316",bg:"rgba(249,115,22,0.1)"},
  "delivered":        {label:"Delivered",       color:"#1DB954",bg:"rgba(29,185,84,0.1)"},
  "cancelled":        {label:"Cancelled",       color:"#E53E3E",bg:"rgba(229,62,62,0.1)"},
};

const Badge = ({status}:{status:string}) => {
  const cfg = STATUS_CFG[status as Status] || {label:status,color:"#A8A8B8",bg:"rgba(168,168,184,0.1)"};
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:3,fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",background:cfg.bg,color:cfg.color}}>● {cfg.label}</span>;
};

export default function OrdersPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all"|Status>("all");
  const [selected, setSelected] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    load();
    const ch = supabase.channel("orders-rt")
      .on("postgres_changes",{event:"*",schema:"public",table:"orders"},load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const load = async () => {
    const res = await fetchAdmin("/api/orders");
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: Status) => {
    setUpdating(true);
    const res = await fetchAdmin(`/api/orders/${id}`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
    const data = await res.json();
    if (data.error) { toast.error(data.error); setUpdating(false); return; }
    toast.success(`Status → ${STATUS_CFG[status].label}`);
    setSelected((prev: any) => prev ? {...prev, status} : null);
    await load();
    setUpdating(false);
  };

  const counts: Record<string,number> = {all: orders.length};
  orders.forEach(o => { counts[o.status] = (counts[o.status]||0)+1; });
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const revenue = orders.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+(o.total||0),0);

  const btn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    padding:"6px 12px", borderRadius:4, fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
    fontWeight:900, letterSpacing:"0.06em", textTransform:"uppercase", cursor:"pointer",
    border:"none", display:"inline-flex", alignItems:"center", gap:4, ...extra
  });

  return (
    <div style={{fontFamily:"'Barlow',sans-serif",color:"#EEEEF5"}}>
      <div style={{marginBottom:24}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.04em"}}>Orders</div>
        <div style={{fontSize:12,color:"#5A5A70",marginTop:3}}>{orders.length} total · {fmt(revenue)} revenue</div>
      </div>

      {/* Pipeline */}
      <div style={{display:"flex",gap:0,marginBottom:20,border:"1px solid #1E1E26",borderRadius:8,overflow:"hidden"}}>
        {[["all","All",counts.all||0],["new","New",counts.new||0],["confirmed","Confirmed",counts.confirmed||0],["processing","Processing",counts.processing||0],["out-for-delivery","Delivery",counts["out-for-delivery"]||0],["delivered","Done",counts.delivered||0]].map(([k,l,c],i,arr)=>(
          <div key={k} onClick={()=>setFilter(k as any)} style={{flex:1,padding:"10px 6px",textAlign:"center",background:filter===k?"rgba(200,150,42,0.07)":"#0F0F13",cursor:"pointer",borderRight:i<arr.length-1?"1px solid #1E1E26":"none",transition:"background 0.12s"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,color:filter===k?"#E8B84B":"#EEEEF5",lineHeight:1}}>{c}</div>
            <div style={{fontSize:9,color:filter===k?"#E8B84B":"#5A5A70",marginTop:3,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:800}}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{background:"#0F0F13",border:"1px solid #1E1E26",borderRadius:12,overflow:"hidden"}}>
        {loading ? (
          <div style={{padding:"40px 20px",textAlign:"center",color:"#5A5A70"}}>Loading orders…</div>
        ) : filtered.length === 0 ? (
          <div style={{padding:"48px 20px",textAlign:"center",color:"#5A5A70"}}>
            <div style={{fontSize:36,marginBottom:12,opacity:0.4}}>📦</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,textTransform:"uppercase",letterSpacing:"0.06em"}}>No orders {filter!=="all"?`with status "${STATUS_CFG[filter as Status]?.label}"`:""}</div>
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>{["Order","Customer","Location","Total","Status","Time",""].map(h=>(
                  <th key={h} style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.1em",color:"#5A5A70",padding:"10px 16px",textAlign:"left",borderBottom:"1px solid #1E1E26",fontFamily:"'Barlow Condensed',sans-serif",whiteSpace:"nowrap"}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(o=>(
                  <tr key={o.id} style={{cursor:"pointer"}} onClick={()=>setSelected(o)}
                    onMouseEnter={e=>Array.from(e.currentTarget.cells).forEach(c=>((c as HTMLElement).style.background="#131318"))}
                    onMouseLeave={e=>Array.from(e.currentTarget.cells).forEach(c=>((c as HTMLElement).style.background="transparent"))}>
                    <td style={{padding:"13px 16px",borderBottom:"1px solid rgba(30,30,38,0.5)",fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:"#E8B84B",whiteSpace:"nowrap"}}>{o.order_ref}</td>
                    <td style={{padding:"13px 16px",borderBottom:"1px solid rgba(30,30,38,0.5)",fontSize:13}}>
                      <div style={{fontWeight:700}}>{o.customers?.name||"—"}</div>
                      <div style={{fontSize:11,color:"#5A5A70"}}>{o.customers?.phone||""}</div>
                    </td>
                    <td style={{padding:"13px 16px",borderBottom:"1px solid rgba(30,30,38,0.5)",fontSize:12,color:"#A8A8B8",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.location}</td>
                    <td style={{padding:"13px 16px",borderBottom:"1px solid rgba(30,30,38,0.5)",fontSize:13,fontWeight:700,whiteSpace:"nowrap"}}>{fmt(o.total)}</td>
                    <td style={{padding:"13px 16px",borderBottom:"1px solid rgba(30,30,38,0.5)"}}><Badge status={o.status}/></td>
                    <td style={{padding:"13px 16px",borderBottom:"1px solid rgba(30,30,38,0.5)",fontSize:11,color:"#5A5A70",whiteSpace:"nowrap"}}>{timeAgo(o.created_at)}</td>
                    <td style={{padding:"13px 16px",borderBottom:"1px solid rgba(30,30,38,0.5)",color:"#E8B84B"}}>→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order detail modal */}
      {selected && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(8px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setSelected(null)}>
          <div style={{background:"#0C0C0F",border:"1px solid #1E1E26",borderRadius:16,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.95)"}} onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div style={{padding:"18px 22px 14px",borderBottom:"1px solid #1E1E26",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,color:"#E8B84B",fontWeight:700,marginBottom:4}}>{selected.order_ref}</div>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,fontWeight:900,textTransform:"uppercase"}}>{selected.customers?.name||"Unknown"}</div>
                <div style={{fontSize:11,color:"#5A5A70",marginTop:2}}>{selected.customers?.phone} · {timeAgo(selected.created_at)}</div>
              </div>
              <Badge status={selected.status}/>
            </div>
            <div style={{padding:"18px 22px"}}>
              {/* Location */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:800,color:"#5A5A70",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:4}}>Delivery Location</div>
                <div style={{fontSize:13,color:"#A8A8B8"}}>{selected.location}</div>
              </div>
              {/* Notes */}
              {selected.notes && (
                <div style={{background:"rgba(200,150,42,0.07)",border:"1px solid rgba(200,150,42,0.2)",borderRadius:6,padding:"12px 14px",marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:800,color:"#E8B84B",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:5}}>📝 Customer Notes</div>
                  <div style={{fontSize:13,color:"#A8A8B8",lineHeight:1.6}}>{selected.notes}</div>
                </div>
              )}
              {/* Items */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:800,color:"#5A5A70",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:8}}>Items</div>
                {(selected.order_items||[]).map((item:any,i:number)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:13}}>
                    <span style={{color:"#A8A8B8"}}>{item.name} × {item.quantity}</span>
                    <span style={{fontWeight:700}}>{fmt(item.price*item.quantity)}</span>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1E1E26",paddingTop:10,marginTop:4}}>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,textTransform:"uppercase",fontSize:13}}>Total</span>
                  <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#E8B84B"}}>{fmt(selected.total)}</span>
                </div>
              </div>
              {/* Status update */}
              <div>
                <div style={{fontSize:10,fontWeight:800,color:"#5A5A70",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",marginBottom:10}}>Update Status</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {STATUSES.filter(s=>s!=="cancelled").map(s=>(
                    <button key={s} disabled={updating||selected.status===s} onClick={()=>updateStatus(selected.id,s)}
                      style={btn({background:selected.status===s?STATUS_CFG[s].bg:"#131318",color:selected.status===s?STATUS_CFG[s].color:"#A8A8B8",border:`1px solid ${selected.status===s?STATUS_CFG[s].color:"#1E1E26"}`,opacity:updating?0.5:1})}>
                      {STATUS_CFG[s].label}
                    </button>
                  ))}
                  <button disabled={updating} onClick={()=>updateStatus(selected.id,"cancelled")}
                    style={btn({background:"rgba(229,62,62,0.1)",color:"#E53E3E",border:"1px solid rgba(229,62,62,0.2)",opacity:updating?0.5:1})}>
                    ✕ Cancel
                  </button>
                </div>
              </div>
            </div>
            <div style={{padding:"14px 22px",borderTop:"1px solid #1E1E26",display:"flex",justifyContent:"flex-end"}}>
              <button onClick={()=>setSelected(null)} style={btn({background:"#131318",color:"#A8A8B8",border:"1px solid #1E1E26",padding:"8px 16px"})}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
