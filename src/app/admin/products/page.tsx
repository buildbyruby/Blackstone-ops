"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const fmt = (n: number) => `KES ${Number(n).toFixed(2)}`;

type Product = { id:string; name:string; description:string|null; price:number; stock:number; emoji:string; image_url:string|null; is_active:boolean };
type Form = { name:string; description:string; price:string; stock:string; emoji:string; image_url:string };
const EMPTY: Form = { name:"", description:"", price:"", stock:"", emoji:"📦", image_url:"" };

// ── AUTH-AWARE FETCH ──────────────────────────────────────────
async function apiFetch(url: string, options: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

const B = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  padding:"9px 18px", borderRadius:4, fontFamily:"'Barlow Condensed',sans-serif", fontSize:13,
  fontWeight:900, letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer",
  border:"none", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, ...extra
});
const INP: React.CSSProperties = {
  width:"100%", padding:"10px 13px", background:"#050506", border:"1px solid #1E1E26",
  borderRadius:4, color:"#EEEEF5", fontSize:13, fontFamily:"'Barlow',sans-serif", outline:"none", boxSizing:"border-box"
};
const LBL: React.CSSProperties = {
  display:"block", fontSize:10, fontWeight:800, color:"#5A5A70", marginBottom:5,
  letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif"
};

export default function ProductsPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<null|"add"|Product>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [imgTab, setImgTab] = useState<"upload"|"url"|"emoji">("upload");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await apiFetch("/api/products");
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to load");
      setProducts(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  };

  const openAdd = () => { setForm(EMPTY); setPreview(""); setImgTab("upload"); setModal("add"); };
  const openEdit = (p: Product) => {
    setForm({ name:p.name, description:p.description||"", price:String(p.price), stock:String(p.stock), emoji:p.emoji||"📦", image_url:p.image_url||"" });
    setPreview(p.image_url||""); setImgTab(p.image_url?"url":"emoji"); setModal(p);
  };

  const handleFile = async (file: File) => {
    if (file.size > 5*1024*1024) { toast.error("Max 5MB"); return; }
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `products/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert:true, contentType:file.type });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage.from("product-images").getPublicUrl(path);
      setForm(f => ({ ...f, image_url:data.publicUrl }));
      setPreview(data.publicUrl);
      toast.success("Image uploaded ✓");
    } catch (e: any) { toast.error(`Upload failed: ${e.message}`); setPreview(""); }
    setUploading(false);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return; }
    if (!form.price || isNaN(+form.price) || +form.price < 0) { toast.error("Valid price required"); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: +form.price,
      stock: Math.max(0, +form.stock || 0),
      emoji: form.emoji || "📦",
      image_url: form.image_url || null,
    };
    try {
      const isAdd = modal === "add";
      const res = await apiFetch(
        isAdd ? "/api/products" : `/api/products/${(modal as Product).id}`,
        { method: isAdd ? "POST" : "PATCH", body: JSON.stringify(payload) }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      toast.success(isAdd ? "Product added ✓" : "Product updated ✓");
      setModal(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };

  const del = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      const res = await apiFetch(`/api/products/${p.id}`, { method:"DELETE" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      toast.success("Deleted");
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleActive = async (p: Product) => {
    try {
      const res = await apiFetch(`/api/products/${p.id}`, { method:"PATCH", body:JSON.stringify({ is_active:!p.is_active }) });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      toast.success(p.is_active ? "Hidden from store" : "Now visible");
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div style={{ fontFamily:"'Barlow',sans-serif", color:"#EEEEF5" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:26, fontWeight:900, textTransform:"uppercase", letterSpacing:"0.04em" }}>Products</div>
          <div style={{ fontSize:12, color:"#5A5A70", marginTop:3 }}>{products.length} items in catalog</div>
        </div>
        <button style={B({ background:"#C8962A", color:"#000", padding:"10px 20px" })} onClick={openAdd}>+ Add Product</button>
      </div>

      {error && (
        <div style={{ background:"rgba(229,62,62,0.1)", border:"1px solid rgba(229,62,62,0.3)", borderRadius:8, padding:"12px 16px", marginBottom:16, fontSize:13, color:"#E53E3E" }}>
          ⚠ {error} <button style={{ color:"#E8B84B", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }} onClick={load}>Retry</button>
        </div>
      )}

      {loading ? (
        <div style={{ color:"#5A5A70", fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", letterSpacing:"0.1em" }}>Loading…</div>
      ) : products.length === 0 && !error ? (
        <div style={{ textAlign:"center", padding:"80px 20px", color:"#5A5A70" }}>
          <div style={{ fontSize:48, marginBottom:16, opacity:0.2 }}>🏪</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, textTransform:"uppercase" }}>No products yet</div>
          <button style={B({ background:"#C8962A", color:"#000", marginTop:20 })} onClick={openAdd}>Add First Product</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:14 }}>
          {products.map(p => (
            <div key={p.id} style={{ background:"#0F0F13", border:`1px solid ${p.is_active?"#1E1E26":"#2A1010"}`, borderRadius:12, overflow:"hidden", opacity:p.is_active?1:0.6, transition:"all 0.15s" }}
              onMouseEnter={e=>(e.currentTarget.style.borderColor=p.is_active?"#C8962A":"#5A2020")}
              onMouseLeave={e=>(e.currentTarget.style.borderColor=p.is_active?"#1E1E26":"#2A1010")}>
              <div style={{ width:"100%", aspectRatio:"16/10", background:"#0A0A0D", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", position:"relative" }}>
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e=>{(e.target as HTMLImageElement).style.display="none";}} />
                  : <span style={{ fontSize:52 }}>{p.emoji}</span>
                }
                {!p.is_active && <div style={{ position:"absolute", top:8, right:8, background:"#E53E3E", color:"#fff", fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:3, fontFamily:"'Barlow Condensed',sans-serif" }}>HIDDEN</div>}
                <div style={{ position:"absolute", bottom:8, left:8, background:"rgba(0,0,0,0.7)", color:p.stock<10?"#E53E3E":"#A8A8B8", fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:3, fontFamily:"'Barlow Condensed',sans-serif", backdropFilter:"blur(4px)" }}>
                  {p.stock} LEFT
                </div>
              </div>
              <div style={{ padding:"12px 14px" }}>
                <div style={{ fontWeight:700, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginBottom:4 }}>{p.name}</div>
                {p.description && <div style={{ fontSize:11, color:"#5A5A70", marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.description}</div>}
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, fontWeight:900, color:"#E8B84B", marginBottom:12 }}>{fmt(p.price)}</div>
                <div style={{ display:"flex", gap:6 }}>
                  <button style={B({ flex:1, background:"#131318", color:"#A8A8B8", border:"1px solid #1E1E26", padding:"6px 10px", fontSize:11 })} onClick={()=>openEdit(p)}>✏ Edit</button>
                  <button style={B({ background:p.is_active?"rgba(229,62,62,0.08)":"rgba(29,185,84,0.08)", color:p.is_active?"#E53E3E":"#1DB954", border:`1px solid ${p.is_active?"rgba(229,62,62,0.2)":"rgba(29,185,84,0.2)"}`, padding:"6px 10px", fontSize:11 })} onClick={()=>toggleActive(p)}>{p.is_active?"Hide":"Show"}</button>
                  <button style={B({ width:32, height:32, padding:0, background:"rgba(229,62,62,0.08)", color:"#E53E3E", border:"1px solid rgba(229,62,62,0.2)" })} onClick={()=>del(p)}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={()=>!saving&&setModal(null)}>
          <div style={{ background:"#0C0C0F", border:"1px solid #1E1E26", borderRadius:16, width:"100%", maxWidth:520, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.95)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"18px 22px 14px", borderBottom:"1px solid #1E1E26", position:"sticky", top:0, background:"#0C0C0F", zIndex:1, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:18, fontWeight:900, textTransform:"uppercase" }}>{modal==="add"?"Add Product":`Edit: ${(modal as Product).name}`}</div>
              <button style={B({ background:"#131318", color:"#5A5A70", border:"1px solid #1E1E26", padding:"4px 10px", fontSize:11 })} onClick={()=>setModal(null)}>✕</button>
            </div>
            <div style={{ padding:"18px 22px" }}>
              {/* Image tabs */}
              <div style={{ marginBottom:18 }}>
                <label style={LBL}>Product Image</label>
                <div style={{ display:"flex", gap:4, marginBottom:12, background:"#050506", padding:4, borderRadius:6, border:"1px solid #1E1E26" }}>
                  {(["upload","url","emoji"] as const).map(t=>(
                    <button key={t} onClick={()=>setImgTab(t)} style={{ flex:1, padding:"6px 8px", borderRadius:4, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", fontFamily:"'Barlow Condensed',sans-serif", cursor:"pointer", border:"none", background:imgTab===t?"#C8962A":"transparent", color:imgTab===t?"#000":"#5A5A70", transition:"all 0.12s" }}>
                      {t==="upload"?"📷 Upload":t==="url"?"🔗 URL":"🎯 Emoji"}
                    </button>
                  ))}
                </div>
                {imgTab==="upload" && (
                  <div onClick={()=>fileRef.current?.click()} style={{ border:"2px dashed #1E1E26", borderRadius:10, padding:20, textAlign:"center", cursor:"pointer", background:"#050506" }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor="#C8962A")} onMouseLeave={e=>(e.currentTarget.style.borderColor="#1E1E26")}>
                    {uploading ? <div style={{ color:"#C8962A", fontFamily:"'Barlow Condensed',sans-serif", textTransform:"uppercase", fontSize:13 }}>Uploading…</div> :
                      preview ? <><img src={preview} alt="" style={{ width:100, height:70, objectFit:"cover", borderRadius:6, marginBottom:6 }}/><div style={{ fontSize:11, color:"#1DB954" }}>✓ Ready · click to change</div></> :
                      <><div style={{ fontSize:32, marginBottom:8, opacity:0.5 }}>📷</div><div style={{ fontSize:13, color:"#A8A8B8", marginBottom:4 }}>Click to upload or <strong>paste</strong> an image</div><div style={{ fontSize:11, color:"#5A5A70" }}>JPG · PNG · WEBP · max 5MB</div></>
                    }
                  </div>
                )}
                {imgTab==="url" && (
                  <input style={INP} value={form.image_url} placeholder="https://example.com/image.jpg"
                    onChange={e=>{setForm(f=>({...f,image_url:e.target.value}));setPreview(e.target.value);}}
                    onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
                )}
                {imgTab==="emoji" && (
                  <input style={{...INP,fontSize:24,textAlign:"center"}} value={form.emoji}
                    onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} placeholder="📦"
                    onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }}
                  onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);e.target.value="";}} />
              </div>

              <div style={{ marginBottom:14 }}>
                <label style={LBL}>Product Name *</label>
                <input style={INP} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Wagyu Burger"
                  onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
              </div>
              <div className="products-modal-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                <div>
                  <label style={LBL}>Price (KES) *</label>
                  <input style={INP} type="number" min="0" step="0.01" value={form.price}
                    onChange={e=>setForm(f=>({...f,price:e.target.value}))} placeholder="0.00"
                    onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
                </div>
                <div>
                  <label style={LBL}>Stock Qty</label>
                  <input style={INP} type="number" min="0" value={form.stock}
                    onChange={e=>setForm(f=>({...f,stock:e.target.value}))} placeholder="0"
                    onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
                </div>
              </div>
              <div>
                <label style={LBL}>Description</label>
                <textarea style={{...INP,minHeight:75,resize:"vertical",fontFamily:"'Barlow',sans-serif"}} value={form.description}
                  onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Describe the product…"
                  onFocus={e=>(e.target.style.borderColor="#C8962A")} onBlur={e=>(e.target.style.borderColor="#1E1E26")} />
              </div>
            </div>
            <div style={{ padding:"14px 22px", borderTop:"1px solid #1E1E26", display:"flex", gap:8, justifyContent:"flex-end", position:"sticky", bottom:0, background:"#0C0C0F" }}>
              <button style={B({ background:"#131318", color:"#A8A8B8", border:"1px solid #1E1E26" })} onClick={()=>setModal(null)} disabled={saving}>Cancel</button>
              <button style={B({ background:saving?"#7A5A14":"#C8962A", color:saving?"#5A4010":"#000", minWidth:140 })} onClick={save} disabled={saving||uploading}>
                {saving?"Saving…":uploading?"Wait for upload…":modal==="add"?"Save Product":"Update Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
