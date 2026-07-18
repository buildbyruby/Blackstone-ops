import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  try {
    const { data, error } = await admin()
      .from("messages")
      .select("customer_id")
      .eq("from_admin", false)
      .eq("read", false);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const counts: Record<string, number> = {};
    for (const row of data || []) counts[row.customer_id] = (counts[row.customer_id] || 0) + 1;
    return NextResponse.json(counts);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
