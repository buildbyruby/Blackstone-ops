"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchAdmin } from "@/lib/fetch-admin";

const fmt = (n: number) => `KES ${Number(n).toFixed(2)}`;
const timeAgo = (d: string) => { const s=Math.floor((Date.now()-new Date(d).getTime())/1000); if(s<60)return`${s}s ago`; if(s<3600)return`${Math.floor(s/60)}m ago`; if(s<86400)return`${Math.floor(s/3600)}h ago`; return`${Math.floor(s/86400)}d ago`; };
const STATUS_COLOR: Record<string,string> = {"new":"#3B82F6","confirmed":"#E8B84B","processing":"#8B5CF6","out-for-delivery":"#F97316","delivered":"#1DB954","cancelled":"#E53E3E"};
const STATUS_LABEL: Record<string,string> = {"new":"New","confirmed":"Confirmed","processing":"Processing","out-for-delivery":"Out for Delivery","delivered":"Delivered","cancelled":"Cancelled"};

export default function OverviewPage() {
  const router = useRouter();
  const supabase = createClient();
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const ch = supabase.channel("overview-rt")
      .on("postgres_changes",{event:"*",schema:"public",table:"orders"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"customers"},fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchAll = async () => {
    const [ordRes, custRes] = await Promise.all([
      fetchAdmin("/api/orders"),
      fetchAdmin("/api/customers"),
    ]);
    const [ordData, custData] = await Promise.all([ordRes.json(), custRes.json()]);
    const allOrders = Array.isArray(ordData) ? ordData : [];
    const allCustomers = Array.isArray(custData) ? custData : [];
    setOrders(allOrders);
    setCustomers(allCustomers.filter((c:any)=>c.status==="active"));
    setPending(allCustomers.filter((c:any)=>c.status==="pending"));
    setLoading(false);
  };

  const revenue = orders.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+(o.total||0),0);
  const active = orders.filter(o=>!["delivered","cancelled"].includes(o.status)).length;
  const outForDelivery = orders.filter(o=>o.status==="out-for-delivery").length;
  const delivered = orders.filter(o=>o.status==="delivered").length;
  const statusCounts: Record<string,number> = {};
  orders.forEach(o=>{ statusCounts[o.status]=(statusCounts[o.status]||0)+1; });
  const bars = [38,52,45,71,63,88,95];
  const barLabels = ["MON","TUE","WED","THU","FRI","SAT","SUN"];

  const pill = (extra: React.CSSProperties={}): React.CSSProperties => ({padding:"5px 14px",borderRadius:4,fontSize:11,fontWeight:700,cursor:"pointer",border:"1px solid #1E1E26",color:"#A8A8B8",background:"#131318",textTransform:"uppercase",letterSpacing:"0.04em",fontFamily:"'Barlow Condensed',sans-serif",...extra});

  return (
    <div style={{fontFamily:"'Barlow',sans-serif",color:"#EEEEF5"}}>
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.04em"}}>Operations Overview</div>
        <div style={{fontSize:12,color:"#5A5A70",marginTop:3}}>Real-time intelligence · {new Date().toLocaleDateString("en-KE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
      </div>

      {/* Quick nav */}
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        {[["📦 Orders","/admin/orders"],["👥 Customers","/admin/customers"],["💬 Messages","/admin/messages"],["⬛ QR Access","/admin/qr"],["🏪 Products","/admin/products"]].map(([l,p])=>(
          <button key={p} style={pill()} onClick={()=>router.push(p)}>{l}</button>
        ))}
        {pending.length>0&&<button style={pill({background:"rgba(249,115,22,0.12)",color:"#F97316",borderColor:"rgba(249,115,22,0.25)"})} onClick={()=>router.push("/admin/customers")}>⚠ {pending.length} Pending Approval</button>}
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10,marginBottom:18}}>
        {[
          {label:"Revenue",value:fmt(revenue),icon:"💰",hint:"View orders →",path:"/admin/orders"},
          {label:"Active Orders",value:String(active),icon:"📦",hint:"Manage →",path:"/admin/orders"},
          {label:"Customers",value:String(customers.length),icon:"👥",hint:"View all →",path:"/admin/customers"},
          {label:"Pending Access",value:String(pending.length),icon:"🔐",hint:"Review →",path:"/admin/customers",alert:pending.length>0},
          {label:"Out for Delivery",value:String(outForDelivery),icon:"🛵",hint:"Track →",path:"/admin/orders"},
          {label:"Delivered",value:String(delivered),icon:"✅",hint:"View →",path:"/admin/orders"},
        ].map(s=>(
          <div key={s.label} onClick={()=>router.push(s.path)}
            style={{background:"#0F0F13",border:`1px solid ${s.alert?"rgba(249,115,22,0.35)":"#1E1E26"}`,borderRadius:12,padding:16,position:"relative",overflow:"hidden",cursor:"pointer",transition:"border-color 0.15s"}}
            onMouseEnter={e=>(e.currentTarget.style.borderColor=s.alert?"rgba(249,115,22,0.5)":"#C8962A")}
            onMouseLeave={e=>(e.currentTarget.style.borderColor=s.alert?"rgba(249,115,22,0.35)":"#1E1E26")}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:s.alert?"#F97316":"linear-gradient(90deg,#C8962A 0%,transparent 60%)"}}/>
            <div style={{position:"absolute",bottom:10,right:12,fontSize:20,opacity:0.12}}>{s.icon}</div>
            <div style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.1em",color:"#5A5A70",fontFamily:"'Barlow Condensed',sans-serif"}}>{s.label}</div>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:30,fontWeight:900,color:"#EEEEF5",marginTop:6,letterSpacing:"-0.01em",lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:10,color:"#C8962A",fontWeight:700,marginTop:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="overview-widgets" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {/* Revenue chart */}
        <div style={{background:"#0F0F13",border:"1px solid #1E1E26",borderRadius:12,padding:"18px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.06em"}}>Revenue — This Week</div>
            <span style={{color:"#E8B84B",fontWeight:700,fontSize:13,fontFamily:"'Barlow Condensed',sans-serif"}}>{fmt(revenue)}</span>
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:5,height:80}}>
            {bars.map((h,i)=><div key={i} style={{flex:1,height:`${h}%`,borderRadius:"2px 2px 0 0",background:i===6?"linear-gradient(180deg,#E8B84B,#C8962A)":"#131318"}}/>)}
          </div>
          <div style={{display:"flex",gap:5,marginTop:5}}>
            {barLabels.map(l=><div key={l} style={{flex:1,textAlign:"center",fontSize:9,color:"#2E2E3A",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,letterSpacing:"0.06em"}}>{l}</div>)}
          </div>
        </div>

        {/* Orders by status */}
        <div style={{background:"#0F0F13",border:"1px solid #1E1E26",borderRadius:12,padding:"18px 20px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.06em"}}>Orders by Status</div>
            <button style={pill({padding:"3px 10px",fontSize:10})} onClick={()=>router.push("/admin/orders")}>View All →</button>
          </div>
          {Object.entries(STATUS_LABEL).map(([key,label])=>{
            const v=statusCounts[key]||0;
            return(
              <div key={key} onClick={()=>router.push("/admin/orders")} style={{display:"flex",alignItems:"center",gap:8,marginBottom:9,cursor:"pointer",padding:"3px 5px",borderRadius:4}}
                onMouseEnter={e=>(e.currentTarget.style.background="#131318")} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                <div style={{width:110,fontSize:11,color:"#5A5A70",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>
                <div style={{flex:1,height:4,background:"#131318",borderRadius:2,overflow:"hidden"}}>
                  <div style={{width:`${((v/(orders.length||1))*100)}%`,height:"100%",background:STATUS_COLOR[key],borderRadius:2,transition:"width 0.4s"}}/>
                </div>
                <div style={{width:18,textAlign:"right",fontSize:11,fontWeight:700,color:"#A8A8B8"}}>{v}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending approvals */}
      {pending.length>0&&(
        <div style={{background:"#0F0F13",border:"1px solid rgba(249,115,22,0.3)",borderRadius:12,marginTop:12}}>
          <div style={{padding:"14px 20px",borderBottom:"1px solid rgba(249,115,22,0.2)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.06em",color:"#F97316"}}>⚠ {pending.length} Pending Approval</div>
            <button style={pill({background:"rgba(249,115,22,0.12)",color:"#F97316",borderColor:"rgba(249,115,22,0.25)"})} onClick={()=>router.push("/admin/customers")}>Review →</button>
          </div>
          {pending.slice(0,3).map((p:any)=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:13,padding:"12px 20px",borderBottom:"1px solid rgba(30,30,38,0.4)"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:"#F97316",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#000",fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0}}>{p.name.charAt(0)}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700}}>{p.name}</div>
                <div style={{fontSize:11,color:"#5A5A70"}}>{p.phone} · {timeAgo(p.created_at)}</div>
              </div>
              <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:2,fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",background:"rgba(249,115,22,0.1)",color:"#F97316"}}>● Pending</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent orders */}
      <div style={{background:"#0F0F13",border:"1px solid #1E1E26",borderRadius:12,marginTop:12}}>
        <div style={{padding:"14px 20px",borderBottom:"1px solid #1E1E26",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.06em"}}>Recent Orders</div>
          <button style={pill({padding:"3px 10px",fontSize:10})} onClick={()=>router.push("/admin/orders")}>View All →</button>
        </div>
        {loading ? (
          <div style={{padding:"24px 20px",textAlign:"center",color:"#5A5A70"}}>Loading…</div>
        ) : orders.length===0 ? (
          <div style={{padding:"32px 20px",textAlign:"center",color:"#5A5A70",fontSize:13}}>No orders yet. Share your QR code to get started.</div>
        ) : (
          <>
          {/* Desktop: full table */}
          <div className="overview-table-wrap" style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Order","Customer","Total","Status","Time",""].map(h=><th key={h} style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.1em",color:"#5A5A70",padding:"9px 16px",textAlign:"left",borderBottom:"1px solid #1E1E26",fontFamily:"'Barlow Condensed',sans-serif"}}>{h}</th>)}</tr></thead>
              <tbody>
                {orders.slice(0,8).map(o=>(
                  <tr key={o.id} style={{cursor:"pointer"}} onClick={()=>router.push("/admin/orders")}
                    onMouseEnter={e=>Array.from(e.currentTarget.cells).forEach(c=>((c as HTMLElement).style.background="#131318"))}
                    onMouseLeave={e=>Array.from(e.currentTarget.cells).forEach(c=>((c as HTMLElement).style.background="transparent"))}>
                    <td style={{padding:"12px 16px",borderBottom:"1px solid rgba(30,30,38,0.6)",fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:"#E8B84B"}}>{o.order_ref}</td>
                    <td style={{padding:"12px 16px",borderBottom:"1px solid rgba(30,30,38,0.6)",fontSize:13,fontWeight:700}}>{o.customers?.name||"—"}<br/><span style={{fontSize:11,color:"#5A5A70",fontWeight:400}}>{o.customers?.phone||""}</span></td>
                    <td style={{padding:"12px 16px",borderBottom:"1px solid rgba(30,30,38,0.6)",fontSize:13,fontWeight:700}}>{fmt(o.total)}</td>
                    <td style={{padding:"12px 16px",borderBottom:"1px solid rgba(30,30,38,0.6)"}}><span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:2,fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",background:(STATUS_COLOR[o.status]||"#A8A8B8")+"18",color:STATUS_COLOR[o.status]||"#A8A8B8"}}>● {STATUS_LABEL[o.status]||o.status}</span></td>
                    <td style={{padding:"12px 16px",borderBottom:"1px solid rgba(30,30,38,0.6)",fontSize:11,color:"#5A5A70"}}>{timeAgo(o.created_at)}</td>
                    <td style={{padding:"12px 16px",borderBottom:"1px solid rgba(30,30,38,0.6)",color:"#E8B84B"}}>→</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="overview-mobile-list" style={{display:"none",flexDirection:"column",gap:9,padding:10}}>
            {orders.slice(0,8).map(o=>(
              <div key={o.id} onClick={()=>router.push("/admin/orders")} style={{background:"#050506",border:"1px solid #1E1E26",borderRadius:8,padding:"12px 14px",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:"#E8B84B",fontWeight:700}}>{o.order_ref}</span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:2,fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"'Barlow Condensed',sans-serif",background:(STATUS_COLOR[o.status]||"#A8A8B8")+"18",color:STATUS_COLOR[o.status]||"#A8A8B8"}}>● {STATUS_LABEL[o.status]||o.status}</span>
                </div>
                <div style={{fontSize:13,fontWeight:700}}>{o.customers?.name||"—"}</div>
                <div style={{fontSize:11,color:"#5A5A70",marginBottom:8}}>{o.customers?.phone||""}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8,borderTop:"1px solid #1E1E26"}}>
                  <span style={{fontSize:11,color:"#5A5A70"}}>{timeAgo(o.created_at)}</span>
                  <span style={{fontSize:13,fontWeight:700}}>{fmt(o.total)}</span>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  );
}
