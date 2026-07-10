"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchAdmin } from "@/lib/fetch-admin";
import { toast } from "sonner";

const timeAgo = (d: string) => { const s=Math.floor((Date.now()-new Date(d).getTime())/1000); if(s<60)return`${s}s ago`; if(s<3600)return`${Math.floor(s/60)}m ago`; if(s<86400)return`${Math.floor(s/3600)}h ago`; return`${Math.floor(s/86400)}d ago`; };

export default function CustomersPage() {
  const supabase = createClient();
  const [customers, setCustomers] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending"|"active"|"suspended">("pending");

  useEffect(() => {
    load();
    const ch = supabase.channel("customers-realtime")
      .on("postgres_changes", { event:"*", schema:"public", table:"customers" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const load = async () => {
    const res = await fetchAdmin("/api/customers");
    const data = await res.json();
    if (!Array.isArray(data)) return;
    setPending(data.filter((c:any) => c.status === "pending"));
    setCustomers(data.filter((c:any) => c.status !== "pending"));
    setLoading(false);
  };

  const action = async (id: string, act: string, name: string) => {
    const res = await fetchAdmin(`/api/customers/${id}`, { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action: act }) });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    const labels: Record<string,string> = { approve:"✓ Approved", reject:"✕ Rejected", suspend:"⏸ Suspended", unsuspend:"▶ Reinstated" };
    toast.success(`${name} — ${labels[act] || act}`);
    await load();
  };

  const del = async (id: string, name: string) => {
    if (!confirm(`Permanently delete ${name}?`)) return;
    const res = await fetchAdmin(`/api/customers/${id}`, { method:"DELETE" });
    if (res.ok) { toast.success(`${name} removed`); await load(); }
  };

  const btnStyle = (bg: string, color: string, border?: string): React.CSSProperties => ({
    padding:"5px 12px", borderRadius:4, fontFamily:"'Barlow Condensed',sans-serif", fontSize:11,
    fontWeight:900, letterSpacing:"0.06em", textTransform:"uppercase", cursor:"pointer",
    border:`1px solid ${border||bg}`, background:bg, color, display:"inline-flex", alignItems:"center", gap:4
  });

  const shown = tab === "pending" ? pending : customers.filter((c:any) => c.status === tab);

  return (
    <div style={{ fontFamily:"'Barlow',sans-serif", color:"#EEEEF5" }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:26, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.04em" }}>Customers</div>
        <div style={{ fontSize:12, color:"#5A5A70", marginTop:3 }}>Manage who can access your store</div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:20, background:"#050506", padding:4, borderRadius:8, border:"1px solid #1E1E26", width:"fit-content" }}>
        {([["pending","⚡ Pending",pending.length],["active","✓ Active",customers.filter((c:any)=>c.status==="active").length],["suspended","⏸ Suspended",customers.filter((c:any)=>c.status==="suspended").length]] as [string,string,number][]).map(([key,label,count]) => (
          <button key={key} onClick={()=>setTab(key as any)} style={{ padding:"7px 16px", borderRadius:6, fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer", border:"none", background:tab===key?"#C8962A":"transparent", color:tab===key?"#000":key==="pending"&&count>0?"#F97316":"#5A5A70", transition:"all 0.12s" }}>
            {label} {count > 0 && <span style={{ marginLeft:4, background:tab===key?"rgba(0,0,0,0.2)":"rgba(200,150,42,0.15)", color:tab===key?"#000":"#C8962A", padding:"1px 6px", borderRadius:10, fontSize:10 }}>{count}</span>}
          </button>
        ))}
      </div>

      <div style={{ background:"#0F0F13", border:"1px solid #1E1E26", borderRadius:12, overflow:"hidden" }}>
        {loading ? (
          <div style={{ padding:"40px 20px", textAlign:"center", color:"#5A5A70" }}>Loading…</div>
        ) : shown.length === 0 ? (
          <div style={{ padding:"48px 20px", textAlign:"center", color:"#5A5A70" }}>
            <div style={{ fontSize:32, marginBottom:12, opacity:0.4 }}>👥</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, textTransform:"uppercase", letterSpacing:"0.06em" }}>
              {tab==="pending" ? "No pending requests" : tab==="active" ? "No active customers" : "No suspended customers"}
            </div>
          </div>
        ) : shown.map((c:any, i:number) => (
          <div key={c.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 20px", borderBottom:i<shown.length-1?"1px solid rgba(30,30,38,0.5)":"none" }}>
            <div style={{ width:38, height:38, borderRadius:"50%", background:c.status==="pending"?"#F97316":c.status==="suspended"?"#E53E3E":"#C8962A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:900, color:"#000", fontFamily:"'Barlow Condensed',sans-serif", flexShrink:0 }}>
              {c.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700 }}>{c.name}</div>
              <div style={{ fontSize:11, color:"#5A5A70", marginTop:2 }}>{c.phone} · {timeAgo(c.created_at)}</div>
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end" }}>
              {c.status === "pending" && <>
                <button style={btnStyle("rgba(29,185,84,0.1)","#1DB954","rgba(29,185,84,0.2)")} onClick={()=>action(c.id,"approve",c.name)}>✓ Approve</button>
                <button style={btnStyle("rgba(229,62,62,0.1)","#E53E3E","rgba(229,62,62,0.2)")} onClick={()=>action(c.id,"reject",c.name)}>✕ Reject</button>
              </>}
              {c.status === "active" && <>
                <button style={btnStyle("rgba(249,115,22,0.1)","#F97316","rgba(249,115,22,0.2)")} onClick={()=>action(c.id,"suspend",c.name)}>⏸ Suspend</button>
                <button style={btnStyle("rgba(229,62,62,0.1)","#E53E3E","rgba(229,62,62,0.2)")} onClick={()=>del(c.id,c.name)}>🗑 Remove</button>
              </>}
              {c.status === "suspended" && <>
                <button style={btnStyle("rgba(29,185,84,0.1)","#1DB954","rgba(29,185,84,0.2)")} onClick={()=>action(c.id,"unsuspend",c.name)}>▶ Reinstate</button>
                <button style={btnStyle("rgba(229,62,62,0.1)","#E53E3E","rgba(229,62,62,0.2)")} onClick={()=>del(c.id,c.name)}>🗑 Remove</button>
              </>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
