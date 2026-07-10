import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    let query = admin().from("customers").select("*").order("created_at", { ascending: false });
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { data, error } = await admin().from("customers").insert(body).select().single();
    if (error) {
      if (error.code === "23505" || /duplicate key.*phone/i.test(error.message)) {
        return NextResponse.json({ error: "duplicate phone" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
