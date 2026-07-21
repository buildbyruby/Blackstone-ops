import { NextRequest, NextResponse } from "next/server";
import { admin, requireAdmin, sanitize } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const phone = searchParams.get("phone");

    if (!phone) {
      const { error: authErr } = await requireAdmin(req);
      if (authErr) return authErr;
    }

    let query = admin().from("customers").select("*").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    if (phone) query = query.eq("phone", phone);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = sanitize(body.name, 200);
    const phone = sanitize(body.phone, 30);
    if (!name || !phone) return NextResponse.json({ error: "name and phone required" }, { status: 400 });
    const { data, error } = await admin().from("customers").insert({ name, phone, status: "pending" }).select().single();
    if (error) {
      if (error.code === "23505" || /duplicate key.*phone/i.test(error.message)) {
        return NextResponse.json({ error: "duplicate phone" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
