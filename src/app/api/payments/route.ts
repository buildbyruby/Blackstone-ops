import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { data, error } = await db()
      .from("orders")
      .select("*, customers(name, phone)")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, order_id, customer_id, amount } = body;

    console.log("PAYMENTS ACTION:", action, order_id, customer_id);

    if (!action) return NextResponse.json({ error: "action required" }, { status: 400 });
    if (!order_id) return NextResponse.json({ error: "order_id required" }, { status: 400 });

    const supabase = db();

    // ── CUSTOMER: "I've Paid" button ────────────────────────────────
    if (action === "submit_payment") {
      // Get the order - verify it exists and belongs to customer
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .select("id, customer_id, payment_status, order_ref, total")
        .eq("id", order_id)
        .single();

      console.log("ORDER FOUND:", order, "ERROR:", oErr);

      if (oErr || !order) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      if (customer_id && order.customer_id !== customer_id) {
        return NextResponse.json({ error: "Not your order" }, { status: 403 });
      }
      if (order.payment_status === "paid") {
        return NextResponse.json({ error: "Already paid" }, { status: 400 });
      }
      if (order.payment_status === "submitted") {
        return NextResponse.json({ error: "Already submitted — waiting for confirmation" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("orders")
        .update({
          payment_status: "submitted",
          payment_submitted_at: new Date().toISOString()
        })
        .eq("id", order_id)
        .select()
        .single();

      if (error) {
        console.log("UPDATE ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Notify admin
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

      console.log("SUBMIT SUCCESS:", data);
      return NextResponse.json({ success: true, order: data });
    }

    // ── ADMIN: confirm payment ───────────────────────────────────────
    if (action === "confirm_payment") {
      const { data: order } = await supabase
        .from("orders")
        .select("total, amount_paid")
        .eq("id", order_id)
        .single();

      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      const payAmount = amount || (order.total - (order.amount_paid || 0));
      const newPaid = Math.min((order.amount_paid || 0) + payAmount, order.total);
      const newStatus = newPaid >= order.total ? "paid" : "partial";

      const { data, error } = await supabase
        .from("orders")
        .update({
          amount_paid: newPaid,
          payment_status: newStatus,
          payment_submitted_at: null
        })
        .eq("id", order_id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Log payment
      try {
        await supabase.from("payments").insert({
          order_id,
          customer_id: customer_id || order_id,
          amount: payAmount,
          note: "Confirmed by admin"
        });
      } catch {}

      return NextResponse.json({ success: true, order: data });
    }

    // ── ADMIN: full payment ─────────────────────────────────────────
    if (action === "full_payment") {
      const { data: order } = await supabase
        .from("orders")
        .select("total, amount_paid, customer_id")
        .eq("id", order_id)
        .single();

      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      const payAmount = amount || (order.total - (order.amount_paid || 0));
      const newPaid = Math.min((order.amount_paid || 0) + payAmount, order.total);
      const newStatus = newPaid >= order.total ? "paid" : "partial";

      const { data, error } = await supabase
        .from("orders")
        .update({
          amount_paid: newPaid,
          payment_status: newStatus,
          payment_submitted_at: null
        })
        .eq("id", order_id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      try {
        await supabase.from("payments").insert({
          order_id,
          customer_id: order.customer_id,
          amount: payAmount,
          note: amount ? `Partial: KES ${amount}` : "Full payment recorded"
        });
      } catch {}

      return NextResponse.json({ success: true, order: data });
    }

    // ── ADMIN: reject — not received ────────────────────────────────
    if (action === "reject_payment") {
      const { data, error } = await supabase
        .from("orders")
        .update({
          payment_status: "unpaid",
          payment_submitted_at: null
        })
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
