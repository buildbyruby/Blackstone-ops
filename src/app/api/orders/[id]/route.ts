import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, admin } from "@/lib/api-auth";

const VALID = ["new","confirmed","processing","out-for-delivery","delivered","cancelled"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const { data, error } = await admin().from("orders").select("*, customers(name,phone), order_items(*)").eq("id", id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const { status } = await req.json();
    if (!VALID.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    const { data, error } = await admin().from("orders").update({ status }).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    try { await admin().from("notifications").insert({ type: "order", title: "Order updated", body: `${data.order_ref} is now ${status}`, link: "/admin/orders" }); } catch {}
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}
