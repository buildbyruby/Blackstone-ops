import { NextRequest, NextResponse } from "next/server";
import { admin, requireAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin(req);
  if (authErr) return authErr;
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
