import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, admin, sanitize, sanitizeNum } from "@/lib/api-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const b = await req.json();
    const u: Record<string, any> = {};
    if (b.name !== undefined) u.name = sanitize(b.name, 200);
    if (b.description !== undefined) u.description = sanitize(b.description, 1000) || null;
    if (b.price !== undefined) { const p = sanitizeNum(b.price); if (p !== null && p >= 0) u.price = p; }
    if (b.stock !== undefined) { const s = sanitizeNum(b.stock); if (s !== null && s >= 0) u.stock = s; }
    if (b.emoji !== undefined) u.emoji = sanitize(b.emoji, 10);
    if (b.image_url !== undefined) u.image_url = sanitize(b.image_url, 500) || null;
    if (b.is_active !== undefined) u.is_active = Boolean(b.is_active);
    if (b.remove_offer === true) {
      u.offer_price = null;
      u.offer_label = null;
      u.offer_expires_at = null;
    } else {
      if (b.offer_price !== undefined) {
        const op = b.offer_price === null ? null : sanitizeNum(b.offer_price);
        u.offer_price = op;
      }
      if (b.offer_label !== undefined) u.offer_label = b.offer_label ? sanitize(b.offer_label, 50) : null;
      if (b.offer_expires_at !== undefined) u.offer_expires_at = b.offer_expires_at || null;
    }
    const { data, error } = await admin().from("products").update(u).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const { error } = await admin().from("products").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}
