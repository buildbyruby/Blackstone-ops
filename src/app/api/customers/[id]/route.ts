import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, admin } from "@/lib/api-auth";

const ACTIONS: Record<string, Record<string, any>> = {
  approve:   { status: "active", approved_at: new Date().toISOString() },
  reject:    { status: "suspended" },
  suspend:   { status: "suspended" },
  unsuspend: { status: "active" },
};

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await admin().from("customers").select("id,name,phone,status,created_at,approved_at").eq("id", id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const { action } = await req.json();
    if (!ACTIONS[action]) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    const update = action === "approve"
      ? { status: "active", approved_at: new Date().toISOString() }
      : action === "unsuspend"
      ? { status: "active" }
      : { status: "suspended" };
    const { data, error } = await admin().from("customers").update(update).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireAdmin(req);
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const { error } = await admin().from("customers").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}
