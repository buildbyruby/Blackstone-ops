"use client";
import { fetchAdmin } from "@/lib/fetch-admin";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const timeStr = (d: string) => new Date(d).toLocaleTimeString("en-KE",{hour:"2-digit",minute:"2-digit"});
const timeAgo = (d: string) => { const s=Math.floor((Date.now()-new Date(d).getTime())/1000); if(s<60)return`${s}s ago`; if(s<3600)return`${Math.floor(s/60)}m ago`; if(s<86400)return`${Math.floor(s/3600)}h ago`; return`${Math.floor(s/86400)}d ago`; };

export default function MessagesPage() {
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState<Record<string,number>>({});

  useEffect(() => { loadCustomers(); }, []);

  useEffect(() => {
    if (!active) return;
    loadMessages(active.id);
    const ch = supabase.channel(`messages-${active.id}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`customer_id=eq.${active.id}`},(payload)=>{
        setMessages(prev=>[...prev,payload.new]);
        setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),50);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior:"smooth"});
  }, [messages]);

  const loadCustomers = async () => {
    const res = await fetchAdmin("/api/customers?status=active");
    const data = await res.json();
    if (Array.isArray(data)) setCustomers(data);
  };

  const loadMessages = async (customerId: string) => {
    const res = await fetchAdmin(`/api/messages?customer_id=${customerId}`);
    const data = await res.json();
    if (Array.isArray(data)) setMessages(data);
    // Mark as read
    await fetchAdmin(`/api/messages?customer_id=${customerId}`, {method:"PATCH"}).catch(()=>{});
    setUnread(prev=>({...prev,[customerId]:0}));
  };

  const send = async () => {
    if (!input.trim() || !active || sending) return;
    setSending(true);
    const res = await fetchAdmin("/api/messages",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({customer_id:active.id,from_admin:true,body:input.trim()})
    });
    const data = await res.json();
    if (data.error) { toast.error(data.error); setSending(false); return; }
    setMessages(prev=>[...prev,data]);
    setInput("");
    setSending(false);
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),50);
  };

  return (
    <div style={{fontFamily:"'Barlow',sans-serif",color:"#EEEEF5"}}>
      <div style={{marginBottom:20}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:26,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.04em"}}>Messages</div>
        <div style={{fontSize:12,color:"#5A5A70",marginTop:3}}>Real-time 1-1 chat with your customers</div>
      </div>

      <div className="messages-shell" style={{display:"grid",gridTemplateColumns:"240px 1fr",height:"calc(100vh - 180px)",border:"1px solid #1E1E26",borderRadius:12,overflow:"hidden"}}>
        {/* Contacts sidebar */}
        <div style={{background:"#0C0C0F",borderRight:"1px solid #1E1E26",overflowY:"auto",display:"flex",flexDirection:"column"}}>
          <div style={{padding:"12px 14px",borderBottom:"1px solid #1E1E26",fontSize:10,fontWeight:800,color:"#5A5A70",textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"'Barlow Condensed',sans-serif"}}>
            Conversations ({customers.length})
          </div>
          {customers.length === 0 ? (
            <div style={{padding:"32px 14px",textAlign:"center",color:"#5A5A70",fontSize:12}}>No active customers yet.</div>
          ) : customers.map(c=>(
            <div key={c.id} onClick={()=>{setActive(c); setMessages([]);}}
              style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer",borderBottom:"1px solid rgba(30,30,38,0.4)",background:active?.id===c.id?"rgba(200,150,42,0.07)":"transparent",borderLeft:active?.id===c.id?"2px solid #C8962A":"2px solid transparent",transition:"background 0.12s"}}
              onMouseEnter={e=>{if(active?.id!==c.id)(e.currentTarget as HTMLElement).style.background="#131318"}}
              onMouseLeave={e=>{if(active?.id!==c.id)(e.currentTarget as HTMLElement).style.background="transparent"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:active?.id===c.id?"#C8962A":"#1E1E26",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:active?.id===c.id?"#000":"#A8A8B8",flexShrink:0,fontFamily:"'Barlow Condensed',sans-serif",transition:"all 0.12s"}}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:active?.id===c.id?"#E8B84B":"#EEEEF5"}}>{c.name}</div>
                <div style={{fontSize:11,color:"#5A5A70",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.phone}</div>
              </div>
              {(unread[c.id]||0)>0 && (
                <div style={{width:18,height:18,borderRadius:"50%",background:"#C8962A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:"#000",flexShrink:0}}>{unread[c.id]}</div>
              )}
            </div>
          ))}
        </div>

        {/* Chat window */}
        {active ? (
          <div style={{display:"flex",flexDirection:"column",background:"#050506"}}>
            {/* Chat header */}
            <div style={{padding:"12px 18px",borderBottom:"1px solid #1E1E26",background:"#0C0C0F",display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"#C8962A",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#000",fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0}}>
                {active.name.charAt(0).toUpperCase()}
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.04em"}}>{active.name}</div>
                <div style={{fontSize:11,color:"#5A5A70"}}>{active.phone}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:"#1DB954"}}/>
                <span style={{fontSize:10,color:"#1DB954",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Active</span>
              </div>
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:10}}>
              {messages.length === 0 && (
                <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#5A5A70",gap:8}}>
                  <span style={{fontSize:32,opacity:0.4}}>💬</span>
                  <span style={{fontSize:13}}>No messages yet. Say hello.</span>
                </div>
              )}
              {messages.map(m=>(
                <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:m.from_admin?"flex-end":"flex-start",maxWidth:"72%",alignSelf:m.from_admin?"flex-end":"flex-start"}}>
                  <div style={{padding:"9px 13px",borderRadius:m.from_admin?"10px 10px 2px 10px":"10px 10px 10px 2px",fontSize:13,lineHeight:1.5,background:m.from_admin?"#C8962A":"#1A1A20",color:m.from_admin?"#000":"#EEEEF5",fontWeight:m.from_admin?600:400,border:m.from_admin?"none":"1px solid #1E1E26"}}>
                    {m.body}
                  </div>
                  <div style={{fontSize:10,color:"#5A5A70",marginTop:3}}>{timeStr(m.created_at)}</div>
                </div>
              ))}
              <div ref={bottomRef}/>
            </div>

            {/* Input */}
            <div style={{padding:"12px 14px",borderTop:"1px solid #1E1E26",background:"#0C0C0F",display:"flex",gap:8}}>
              <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder={`Message ${active.name.split(" ")[0]}…`}
                style={{flex:1,padding:"10px 13px",background:"#050506",border:"1px solid #1E1E26",borderRadius:4,color:"#EEEEF5",fontSize:13,fontFamily:"'Barlow',sans-serif",outline:"none"}}
                onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
              <button onClick={send} disabled={!input.trim()||sending}
                style={{padding:"10px 18px",borderRadius:4,fontFamily:"'Barlow Condensed',sans-serif",fontSize:12,fontWeight:900,letterSpacing:"0.08em",textTransform:"uppercase",cursor:!input.trim()||sending?"not-allowed":"pointer",border:"none",background:!input.trim()||sending?"#3A2A10":"#C8962A",color:!input.trim()||sending?"#7A5A14":"#000"}}>
                {sending?"…":"Send →"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#050506",color:"#5A5A70",gap:12}}>
            <span style={{fontSize:48,opacity:0.2}}>💬</span>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,textTransform:"uppercase",letterSpacing:"0.06em"}}>Select a customer to chat</span>
          </div>
        )}
      </div>
    </div>
  );
}
