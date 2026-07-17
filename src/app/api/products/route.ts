import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, admin, rateLimit, sanitize, sanitizeNum } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "ip";
  if (!rateLimit(`prod-${ip}`, 60, 60000)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  try {
    const { data, error } = await admin()
      .from("products")
      .select("id,name,description,price,stock,emoji,image_url,is_active,offer_price,offer_label,offer_expires_at")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin(req);
  if (authErr) return authErr;
  try {
    const b = await req.json();
    const name = sanitize(b.name, 200);
    const price = sanitizeNum(b.price);
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
    if (price === null || price < 0) return NextResponse.json({ error: "Valid price required" }, { status: 400 });
    const offer_price = b.offer_price ? sanitizeNum(b.offer_price) : null;
    const { data, error } = await admin().from("products").insert({
      name,
      description: sanitize(b.description, 1000) || null,
      price,
      stock: Math.max(0, sanitizeNum(b.stock) ?? 0),
      emoji: sanitize(b.emoji, 10) || "📦",
      image_url: sanitize(b.image_url, 500) || null,
      is_active: true,
      offer_price: offer_price && offer_price < price ? offer_price : null,
      offer_label: b.offer_label ? sanitize(b.offer_label, 50) : null,
      offer_expires_at: b.offer_expires_at || null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}
