"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const timeAgo = (d: string) => { const s=Math.floor((Date.now()-new Date(d).getTime())/1000); if(s<60)return`${s}s ago`; if(s<3600)return`${Math.floor(s/60)}m ago`; if(s<86400)return`${Math.floor(s/3600)}h ago`; return`${Math.floor(s/86400)}d ago`; };

async function apiFetch(url: string, opts: RequestInit = {}) {
  const s = createClient();
  const { data: { session } } = await s.auth.getSession();
  return fetch(url, { ...opts, headers: { "Content-Type":"application/json", ...(session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{}), ...(opts.headers||{}) } });
}

export default function CustomersPage() {
  const supabase = createClient();
  const [all, setAll] = useState<any[]>([]);
  const [tab, setTab] = useState<"pending"|"active"|"suspended">("pending");
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<any>(null);

  useEffect(() => {
    load();
    const ch = supabase.channel("cust-rt").on("postgres_changes",{event:"*",schema:"public",table:"customers"},load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const load = async () => {
    const res = await apiFetch("/api/customers");
    const data = await res.json();
    setAll(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const act = async (id: string, action: string, name: string) => {
    const res = await apiFetch(`/api/customers/${id}`, { method:"PATCH", body:JSON.stringify({action}) });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    const labels: Record<string,string> = { approve:"Approved ✓", reject:"Rejected", suspend:"Suspended", unsuspend:"Reinstated ▶" };
    toast.success(`${name} — ${labels[action]||action}`);
    await load();
  };

  const del = async (id: string, name: string) => {
    const res = await apiFetch(`/api/customers/${id}`, { method:"DELETE" });
    if (res.ok) { toast.success(`${name} removed`); setConfirm(null); await load(); }
    else { const d = await res.json(); toast.error(d.error || "Failed"); }
  };

  const pending   = all.filter(c => c.status === "pending");
  const active    = all.filter(c => c.status === "active");
  const suspended = all.filter(c => c.status === "suspended");
  const shown = tab === "pending" ? pending : tab === "active" ? active : suspended;

  const Btn = ({ bg, color, border, onClick, children }: any) => (
    <button onClick={onClick} style={{ padding:"5px 12px", borderRadius:4, fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:900, letterSpacing:"0.06em", textTransform:"uppercase", cursor:"pointer", border:`1px solid ${border||bg}`, background:bg, color, display:"inline-flex", alignItems:"center", gap:4 }}>
      {children}
    </button>
  );

  return (
    <div style={{ fontFamily:"'Barlow',sans-serif", color:"#EEEEF5" }}>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:26, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.04em" }}>Customers</div>
        <div style={{ fontSize:12, color:"#5A5A70", marginTop:3 }}>Manage who can access your store · {all.filter(c=>c.status==="active").length} active members</div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:4, marginBottom:20, background:"#050506", padding:4, borderRadius:8, border:"1px solid #1E1E26", width:"fit-content" }}>
        {([["pending","⚡ Pending",pending.length],["active","✓ Active",active.length],["suspended","⏸ Suspended",suspended.length]] as [string,string,number][]).map(([key,label,count])=>(
          <button key={key} onClick={()=>setTab(key as any)} style={{ padding:"7px 16px", borderRadius:6, fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer", border:"none", background:tab===key?"#C8962A":"transparent", color:tab===key?"#000":key==="pending"&&count>0?"#F97316":"#5A5A70" }}>
            {label}{count>0&&<span style={{ marginLeft:5, background:tab===key?"rgba(0,0,0,0.2)":"rgba(200,150,42,0.15)", color:tab===key?"#000":"#C8962A", padding:"1px 7px", borderRadius:10, fontSize:10 }}>{count}</span>}
          </button>
        ))}
      </div>

      <div style={{ background:"#0F0F13", border:"1px solid #1E1E26", borderRadius:12, overflow:"hidden" }}>
        {loading ? (
          <div style={{ padding:"40px 20px", textAlign:"center", color:"#5A5A70" }}>Loading…</div>
        ) : shown.length === 0 ? (
          <div style={{ padding:"52px 20px", textAlign:"center", color:"#5A5A70" }}>
            <div style={{ fontSize:36, marginBottom:12, opacity:0.2 }}>👥</div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, textTransform:"uppercase", letterSpacing:"0.06em" }}>
              {tab==="pending"?"No pending requests":tab==="active"?"No active customers":"No suspended customers"}
            </div>
          </div>
        ) : shown.map((c:any, i:number) => (
          <div key={c.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 18px", borderBottom:i<shown.length-1?"1px solid rgba(30,30,38,0.5)":"none", flexWrap:"wrap", gap:12 }}>
            {/* Avatar */}
            <div style={{ width:40, height:40, borderRadius:"50%", background:c.status==="pending"?"#F97316":c.status==="suspended"?"#E53E3E":"#C8962A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:900, color:"#000", fontFamily:"'Barlow Condensed',sans-serif", flexShrink:0 }}>
              {c.name.charAt(0).toUpperCase()}
            </div>
            {/* Info */}
            <div style={{ flex:1, minWidth:140 }}>
              <div style={{ fontSize:14, fontWeight:700 }}>{c.name}</div>
              <div style={{ fontSize:11, color:"#5A5A70", marginTop:2 }}>{c.phone} · {timeAgo(c.created_at)}</div>
            </div>
            {/* Status badge */}
            <span style={{ fontSize:10, fontWeight:800, padding:"2px 9px", borderRadius:3, fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", letterSpacing:"0.06em", background:c.status==="pending"?"rgba(249,115,22,0.1)":c.status==="active"?"rgba(29,185,84,0.1)":"rgba(229,62,62,0.1)", color:c.status==="pending"?"#F97316":c.status==="active"?"#1DB954":"#E53E3E" }}>
              {c.status}
            </span>
            {/* Actions */}
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {c.status === "pending" && <>
                <Btn bg="rgba(29,185,84,0.1)" color="#1DB954" border="rgba(29,185,84,0.2)" onClick={()=>act(c.id,"approve",c.name)}>✓ Approve</Btn>
                <Btn bg="rgba(229,62,62,0.1)" color="#E53E3E" border="rgba(229,62,62,0.2)" onClick={()=>act(c.id,"reject",c.name)}>✕ Reject</Btn>
              </>}
              {c.status === "active" && <>
                <Btn bg="rgba(249,115,22,0.1)" color="#F97316" border="rgba(249,115,22,0.2)" onClick={()=>act(c.id,"suspend",c.name)}>⏸ Suspend</Btn>
                <Btn bg="rgba(229,62,62,0.1)" color="#E53E3E" border="rgba(229,62,62,0.2)" onClick={()=>setConfirm(c)}>🗑 Remove</Btn>
              </>}
              {c.status === "suspended" && <>
                <Btn bg="rgba(29,185,84,0.1)" color="#1DB954" border="rgba(29,185,84,0.2)" onClick={()=>act(c.id,"unsuspend",c.name)}>▶ Reinstate</Btn>
                <Btn bg="rgba(229,62,62,0.1)" color="#E53E3E" border="rgba(229,62,62,0.2)" onClick={()=>setConfirm(c)}>🗑 Remove</Btn>
              </>}
            </div>
          </div>
        ))}
      </div>

      {/* Remove confirm */}
      {confirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={()=>setConfirm(null)}>
          <div style={{ background:"#0C0C0F", border:"1px solid #1E1E26", borderRadius:16, width:"100%", maxWidth:380, boxShadow:"0 20px 60px rgba(0,0,0,0.95)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"20px 22px" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, fontWeight:900, textTransform:"uppercase", marginBottom:8 }}>Remove Customer</div>
              <div style={{ fontSize:13, color:"#A8A8B8", lineHeight:1.6 }}>Remove <strong>{confirm.name}</strong>? They will immediately lose all access to the store.</div>
            </div>
            <div style={{ padding:"14px 22px", borderTop:"1px solid #1E1E26", display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>setConfirm(null)} style={{ padding:"8px 16px", borderRadius:4, fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, fontWeight:900, textTransform:"uppercase", cursor:"pointer", border:"1px solid #1E1E26", background:"#131318", color:"#A8A8B8" }}>Cancel</button>
              <button onClick={()=>del(confirm.id,confirm.name)} style={{ padding:"8px 16px", borderRadius:4, fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, fontWeight:900, textTransform:"uppercase", cursor:"pointer", border:"none", background:"rgba(229,62,62,0.1)", color:"#E53E3E" }}>Yes, Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
