import { NextRequest, NextResponse } from "next/server";
import { admin, requireAdmin, rateLimit, sanitizeNum } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;
  try {
    const { data, error: dbErr } = await admin()
      .from("orders")
      .select("*, customers(name, phone)")
      .order("created_at", { ascending: false });
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, order_id, customer_id } = body;
    const amount = sanitizeNum(body.amount);

    if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });
    if (!order_id) return NextResponse.json({ error: "order_id required" }, { status: 400 });

    const supabase = admin();

    // ── CUSTOMER: "I've Paid" button (no admin auth — this is the customer-facing action) ──
    if (action === "submit_payment") {
      if (!customer_id) return NextResponse.json({ error: "customer_id required" }, { status: 400 });
      if (!rateLimit(`submit_payment:${customer_id}`, 10, 60000)) {
        return NextResponse.json({ error: "Too many attempts — wait a moment and try again" }, { status: 429 });
      }

      const { data: order, error: oErr } = await supabase
        .from("orders")
        .select("id, customer_id, status, payment_status, order_ref, total")
        .eq("id", order_id)
        .single();

      if (oErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      if (order.customer_id !== customer_id) return NextResponse.json({ error: "Not your order" }, { status: 403 });
      if (order.status === "cancelled") return NextResponse.json({ error: "This order was cancelled" }, { status: 400 });
      if (order.payment_status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 400 });
      if (order.payment_status === "submitted") return NextResponse.json({ error: "Already submitted — waiting for confirmation" }, { status: 400 });

      const { data, error: upErr } = await supabase
        .from("orders")
        .update({ payment_status: "submitted", payment_submitted_at: new Date().toISOString() })
        .eq("id", order_id)
        .select()
        .single();

      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

      try {
        await supabase.from("notifications").insert({
          type: "order",
          title: "Payment submitted",
          body: `${order.order_ref} — customer says they've paid KES ${order.total}`,
          link: "/admin/payments",
        });
      } catch (e) {
        console.log("Notification failed (non-blocking):", e);
      }

      return NextResponse.json({ success: true, order: data });
    }

    // ── Everything below changes money on someone else's behalf — admin only ──
    const { error: authErr } = await requireAdmin(req);
    if (authErr) return authErr;

    // ── ADMIN: confirm a customer's submitted claim (pays remaining balance) ──
    if (action === "confirm_payment") {
      const { data: order } = await supabase.from("orders").select("total, amount_paid").eq("id", order_id).single();
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      const payAmount = amount ?? (order.total - (order.amount_paid || 0));
      const newPaid = Math.min((order.amount_paid || 0) + payAmount, order.total);
      const newStatus = newPaid >= order.total ? "paid" : "partial";

      const { data, error } = await supabase
        .from("orders")
        .update({ amount_paid: newPaid, payment_status: newStatus, payment_submitted_at: null })
        .eq("id", order_id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      try {
        await supabase.from("payments").insert({ order_id, customer_id: customer_id || null, amount: payAmount, note: "Confirmed by admin" });
      } catch (e) {
        console.log("Payment log failed (non-blocking):", e);
      }

      return NextResponse.json({ success: true, order: data });
    }

    // ── ADMIN: manually record a payment (full remaining balance, or a partial amount) ──
    if (action === "record_payment") {
      const { data: order } = await supabase.from("orders").select("total, amount_paid, customer_id").eq("id", order_id).single();
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      const payAmount = amount ?? (order.total - (order.amount_paid || 0));
      if (payAmount <= 0) return NextResponse.json({ error: "Nothing owed on this order" }, { status: 400 });

      const newPaid = Math.min((order.amount_paid || 0) + payAmount, order.total);
      const newStatus = newPaid >= order.total ? "paid" : "partial";

      const { data, error } = await supabase
        .from("orders")
        .update({ amount_paid: newPaid, payment_status: newStatus, payment_submitted_at: null })
        .eq("id", order_id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      try {
        await supabase.from("payments").insert({
          order_id,
          customer_id: order.customer_id,
          amount: payAmount,
          note: payAmount < order.total ? `Partial: KES ${payAmount}` : "Full payment recorded",
        });
      } catch (e) {
        console.log("Payment log failed (non-blocking):", e);
      }

      return NextResponse.json({ success: true, order: data });
    }

    // ── ADMIN: reject — customer's claim wasn't actually received ──
    if (action === "reject_payment") {
      const { data, error } = await supabase
        .from("orders")
        .update({ payment_status: "unpaid", payment_submitted_at: null })
        .eq("id", order_id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, order: data });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (e: any) {
    console.log("PAYMENTS CRASH:", e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
