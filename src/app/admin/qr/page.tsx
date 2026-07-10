"use client";
import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { fetchAdmin } from "@/lib/fetch-admin";

const S = {
  btn: { padding: "9px 18px", borderRadius: 4, fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" as const, cursor: "pointer", border: "none", display: "inline-flex", alignItems: "center", gap: 6 },
  label: { fontSize: 10, fontWeight: 800, color: "#5A5A70", letterSpacing: "0.1em", textTransform: "uppercase" as const, fontFamily: "'Barlow Condensed',sans-serif" },
  card: { background: "#0F0F13", border: "1px solid #1E1E26", borderRadius: 12 },
};

export default function QRPage() {
  const [token, setToken] = useState("");
  const [active, setActive] = useState(true);
  const [regen, setRegen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const appUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const qrUrl = token ? `${appUrl}/gate?token=${token}` : "";

  useEffect(() => { fetchSettings(); fetchPending(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetchAdmin("/api/qr");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToken(data.qr_token || "");
      setActive(data.store_active !== "false");
      setLoading(false);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const fetchPending = async () => {
    try {
      const res = await fetchAdmin("/api/customers?status=pending");
      if (!res.ok) return;
      const data = await res.json();
      setPending(Array.isArray(data) ? data : []);
    } catch {}
  };

  const doRegen = async () => {
    setConfirmOpen(false);
    setRegen(true);
    try {
      const res = await fetchAdmin("/api/qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "regenerate" }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setToken(data.token);
      toast.success("QR regenerated — old code is now invalid");
    } catch (e: any) {
      toast.error(e.message);
    }
    setRegen(false);
  };

  const toggleActive = async () => {
    const next = !active;
    try {
      const res = await fetchAdmin("/api/qr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", value: next }) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setActive(next);
      toast.success(next ? "Store enabled" : "Store disabled");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const approve = async (id: string, name: string) => {
    const res = await fetchAdmin(`/api/customers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }) });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    toast.success(`${name} approved`);
    fetchPending();
  };

  const reject = async (id: string, name: string) => {
    const res = await fetchAdmin(`/api/customers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject" }) });
    const data = await res.json();
    if (data.error) { toast.error(data.error); return; }
    toast.success(`${name} rejected`);
    fetchPending();
  };

  const timeAgo = (d: string) => { const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`; return `${Math.floor(s / 3600)}h ago`; };

  return (
    <div style={{ fontFamily: "'Barlow',sans-serif", color: "#EEEEF5" }}>
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>QR Access Control</div>
      <div style={{ fontSize: 12, color: "#5A5A70", marginBottom: 24 }}>Control who can enter your private store</div>

      {error && (
        <div style={{ background: "rgba(229,62,62,0.1)", border: "1px solid rgba(229,62,62,0.3)", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#E53E3E" }}>
          ⚠ Error loading settings: {error}
          <br /><span style={{ fontSize: 11, color: "#A8A8B8" }}>Check that SUPABASE_SERVICE_ROLE_KEY is set in .env.local and the settings table has data.</span>
        </div>
      )}

      <div style={{ ...S.card, padding: 32, textAlign: "center", marginBottom: 16, maxWidth: 560 }}>
        <div style={{ ...S.label, marginBottom: 20 }}>Active QR Code</div>

        <div style={{ width: 180, height: 180, background: "#fff", borderRadius: 10, margin: "0 auto 18px", padding: 12, boxShadow: "0 4px 30px rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {loading ? (
            <div style={{ color: "#999", fontSize: 12 }}>Loading…</div>
          ) : regen ? (
            <div style={{ fontSize: 36, color: "#C8962A" }}>⟳</div>
          ) : token ? (
            <QRCodeSVG value={qrUrl} size={156} bgColor="#ffffff" fgColor="#050506" level="M" />
          ) : (
            <div style={{ fontSize: 11, color: "#999", textAlign: "center" }}>No token found.<br />Check settings table.</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 14 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: active ? "#1DB954" : "#E53E3E", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: active ? "#1DB954" : "#E53E3E", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Barlow Condensed',sans-serif" }}>
            {active ? "Active — customers can scan" : "Disabled — store closed"}
          </span>
        </div>

        <div style={{ fontSize: 11, color: "#5A5A70", fontFamily: "'JetBrains Mono',monospace", marginBottom: 10, background: "#131318", padding: "7px 14px", borderRadius: 4, display: "inline-block", border: "1px solid #1E1E26" }}>
          {token || "—"}
        </div>

        <div style={{ fontSize: 11, color: "#5A5A70", marginBottom: 20, wordBreak: "break-all", background: "#131318", padding: "8px 14px", borderRadius: 4, border: "1px solid #1E1E26", fontFamily: "'JetBrains Mono',monospace" }}>
          {qrUrl || "loading…"}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button style={{ ...S.btn, background: "#C8962A", color: "#000" }} onClick={() => setConfirmOpen(true)} disabled={regen || loading}>⟳ Regenerate QR</button>
          <button style={{ ...S.btn, background: active ? "rgba(229,62,62,0.1)" : "#131318", color: active ? "#E53E3E" : "#A8A8B8", border: `1px solid ${active ? "rgba(229,62,62,0.2)" : "#1E1E26"}` }} onClick={toggleActive} disabled={loading}>
            {active ? "⏸ Disable" : "▶ Enable"}
          </button>
          <button style={{ ...S.btn, background: "#131318", color: "#A8A8B8", border: "1px solid #1E1E26" }} onClick={() => { if (qrUrl) { navigator.clipboard.writeText(qrUrl); toast.success("Link copied!"); } }}>⎘ Copy Link</button>
        </div>
      </div>

      <div style={{ ...S.card, maxWidth: 560 }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${pending.length > 0 ? "rgba(249,115,22,0.2)" : "#1E1E26"}` }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.06em", color: pending.length > 0 ? "#F97316" : "#EEEEF5" }}>
            {pending.length > 0 ? `⚠ ${pending.length} Pending Approval` : "Access Requests"}
          </div>
          <div style={{ fontSize: 12, color: "#5A5A70", marginTop: 4 }}>New people who scanned the QR — approve or reject before they can enter.</div>
        </div>
        {pending.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 20px", color: "#5A5A70", fontSize: 13 }}>No pending requests.</div>
        ) : pending.map(p => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: "1px solid rgba(30,30,38,0.5)" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F97316", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#000", fontFamily: "'Barlow Condensed',sans-serif", flexShrink: 0 }}>{p.name.charAt(0)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "#5A5A70" }}>{p.phone} · {timeAgo(p.created_at)}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={{ ...S.btn, padding: "5px 11px", fontSize: 11, background: "rgba(29,185,84,0.1)", color: "#1DB954", border: "1px solid rgba(29,185,84,0.2)" }} onClick={() => approve(p.id, p.name)}>✓ Approve</button>
              <button style={{ ...S.btn, padding: "5px 11px", fontSize: 11, background: "rgba(229,62,62,0.1)", color: "#E53E3E", border: "1px solid rgba(229,62,62,0.2)" }} onClick={() => reject(p.id, p.name)}>✕ Reject</button>
            </div>
          </div>
        ))}
      </div>

      {confirmOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#0C0C0F", border: "1px solid #1E1E26", borderRadius: 16, width: "100%", maxWidth: 400, boxShadow: "0 8px 40px rgba(0,0,0,0.9)" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #1E1E26", display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 900, textTransform: "uppercase" }}>Regenerate QR?</div>
              <span>⚠️</span>
            </div>
            <div style={{ padding: "18px 22px" }}>
              <div style={{ background: "rgba(229,62,62,0.07)", border: "1px solid rgba(229,62,62,0.18)", borderRadius: 4, padding: 13, marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: "#E53E3E", fontWeight: 700, marginBottom: 4 }}>Old QR code is invalidated immediately.</div>
                <div style={{ fontSize: 12, color: "#A8A8B8", lineHeight: 1.7 }}>Anyone with the old link can no longer scan in. You must reshare the new code.</div>
              </div>
              <div style={{ fontSize: 12, color: "#5A5A70" }}>Existing approved customers <span style={{ color: "#E53E3E", fontWeight: 700 }}>will be logged out and must be re-approved.</span></div>
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1px solid #1E1E26", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={{ ...S.btn, background: "#131318", color: "#A8A8B8", border: "1px solid #1E1E26" }} onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button style={{ ...S.btn, background: "rgba(229,62,62,0.1)", color: "#E53E3E", border: "1px solid rgba(229,62,62,0.2)" }} onClick={doRegen}>Yes, Regenerate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
