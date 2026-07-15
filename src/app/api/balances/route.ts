import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const customerId = new URL(req.url).searchParams.get("customer_id");
    if (!customerId) return NextResponse.json({ error: "customer_id required" }, { status: 400 });
    const { data, error } = await admin().from("customer_balances").select("*").eq("customer_id", customerId).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}
