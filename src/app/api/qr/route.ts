import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  try {
    const { data, error } = await admin().from("settings").select("key, value").in("key", ["qr_token", "store_active"]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const result: Record<string, string> = {};
    (data || []).forEach((row: any) => { result[row.key] = row.value; });
    return NextResponse.json(result);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;
    const supabase = admin();

    if (action === "regenerate") {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      const newToken = "bst_" + Array.from(arr).map(b => chars[b % chars.length]).join("");
      const { error } = await supabase.from("settings").update({ value: newToken }).eq("key", "qr_token");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Kick out everyone currently approved — they must re-request access with the new code
      const { error: kickErr } = await supabase
        .from("customers")
        .update({ status: "pending" })
        .eq("status", "active");
      if (kickErr) console.error("Kick-out on regenerate failed:", kickErr.message);

      return NextResponse.json({ token: newToken });
    }

    if (action === "toggle") {
      const { value } = body;
      // Update store_active setting
      const { error } = await supabase.from("settings").update({ value: String(value) }).eq("key", "store_active");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (value === false || value === "false") {
        // DISABLE: suspend ALL active customers — store their previous status so we can restore
        await supabase.from("settings").upsert({ key: "pre_disable_snapshot", value: "active_suspended" });
        const { error: suspendErr } = await supabase
          .from("customers")
          .update({ status: "store_disabled" })
          .eq("status", "active");
        if (suspendErr) console.error("Suspend error:", suspendErr.message);
      } else {
        // ENABLE: restore all store_disabled customers back to active
        const { error: restoreErr } = await supabase
          .from("customers")
          .update({ status: "active" })
          .eq("status", "store_disabled");
        if (restoreErr) console.error("Restore error:", restoreErr.message);
      }

      return NextResponse.json({ ok: true, active: value });
    }

    if (action === "validate") {
      const { token } = body;
      const { data: tokenData } = await supabase.from("settings").select("value").eq("key", "qr_token").single();
      const { data: activeData } = await supabase.from("settings").select("value").eq("key", "store_active").single();
      return NextResponse.json({
        valid: tokenData?.value === token,
        active: activeData?.value === "true"
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
