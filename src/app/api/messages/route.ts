import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customer_id");
    if (!customerId) return NextResponse.json({ error: "customer_id required" }, { status: 400 });
    const { data, error } = await admin().from("messages").select("*").eq("customer_id", customerId).order("created_at", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.customer_id || !body.body) return NextResponse.json({ error: "customer_id and body required" }, { status: 400 });
    const { data, error } = await admin().from("messages").insert({ customer_id: body.customer_id, from_admin: body.from_admin ?? false, body: body.body, order_id: body.order_id || null }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customer_id");
    if (!customerId) return NextResponse.json({ error: "customer_id required" }, { status: 400 });
    const { error } = await admin().from("messages").update({ read: true }).eq("customer_id", customerId).eq("from_admin", false).eq("read", false);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
