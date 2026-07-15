import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, admin, sanitizeNum, sanitize, validateCustomer } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin(req);
  if (authErr) return authErr;
  try {
    const cid = new URL(req.url).searchParams.get("customer_id");
    let q = admin().from("payments").select("*, orders(order_ref,total,amount_paid,payment_status,payment_timing)").order("created_at", { ascending: false });
    if (cid) q = q.eq("customer_id", cid);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "Internal error" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // ── CUSTOMER: submit "I've Paid" claim (no admin auth needed) ──
    if (action === "submit_payment") {
      const { order_id, customer_id } = body;
      if (!order_id || !customer_id) {
        return NextResponse.json({ error: "order_id and customer_id required" }, { status: 400 });
      }
      // Verify customer is active
      const { valid } = await validateCustomer(customer_id);
      if (!valid) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

      // Verify order belongs to this customer
      const { data: order, error: oErr } = await admin()
        .from("orders")
        .select("id, customer_id, payment_status, order_ref")
        .eq("id", order_id)
        .single();
      if (oErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      if (order.customer_id !== customer_id) return NextResponse.json({ error: "Not your order" }, { status: 403 });
      if (order.payment_status === "paid") return NextResponse.json({ error: "Already paid" }, { status: 400 });
      if (order.payment_status === "submitted") return NextResponse.json({ error: "Already submitted" }, { status: 400 });

      const { data, error } = await admin()
        .from("orders")
        .update({ payment_status: "submitted", payment_submitted_at: new Date().toISOString() })
        .eq("id", order_id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Notify admin
      try {
        await admin().from("notifications").insert({
          type: "order",
          title: "Payment submitted",
          body: `Payment submitted for ${order.order_ref} — awaiting confirmation`,
          link: "/admin/payments",
        });
      } catch {}
      return NextResponse.json(data);
    }

    // ── ADMIN: confirm payment receipt ──────────────────────────────
    if (action === "confirm_payment") {
      const { error: authErr } = await requireAdmin(req);
      if (authErr) return authErr;

      const { order_id, customer_id, amount, note } = body;
      if (!order_id || !customer_id) {
        return NextResponse.json({ error: "order_id and customer_id required" }, { status: 400 });
      }
      const amt = sanitizeNum(amount);
      if (!amt || amt <= 0) return NextResponse.json({ error: "Valid amount required" }, { status: 400 });

      const db = admin();
      const { data: order, error: oErr } = await db.from("orders").select("total, amount_paid, order_ref").eq("id", order_id).single();
      if (oErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      const newPaid = Math.min((order.amount_paid || 0) + amt, order.total);
      const newStatus = newPaid >= order.total ? "paid" : newPaid > 0 ? "partial" : "unpaid";

      // Record payment log
      await db.from("payments").insert({
        order_id,
        customer_id,
        amount: amt,
        note: note ? sanitize(note, 300) : `Payment confirmed for ${order.order_ref}`,
      });

      // Update order
      const { data, error } = await db.from("orders")
        .update({ amount_paid: newPaid, payment_status: newStatus, payment_submitted_at: null })
        .eq("id", order_id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    // ── ADMIN: record manual payment (admin initiated, no customer submission) ──
    if (action === "record_payment") {
      const { error: authErr } = await requireAdmin(req);
      if (authErr) return authErr;

      const { order_id, customer_id, amount, note } = body;
      if (!order_id || !customer_id) {
        return NextResponse.json({ error: "order_id and customer_id required" }, { status: 400 });
      }
      const amt = sanitizeNum(amount);
      if (!amt || amt <= 0) return NextResponse.json({ error: "Valid amount required" }, { status: 400 });

      const db = admin();
      const { data: order } = await db.from("orders").select("total, amount_paid").eq("id", order_id).single();
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      const newPaid = Math.min((order.amount_paid || 0) + amt, order.total);
      const newStatus = newPaid >= order.total ? "paid" : newPaid > 0 ? "partial" : "unpaid";

      await db.from("payments").insert({ order_id, customer_id, amount: amt, note: note ? sanitize(note, 300) : null });
      const { data, error } = await db.from("orders")
        .update({ amount_paid: newPaid, payment_status: newStatus })
        .eq("id", order_id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    // ── ADMIN: reject / mark not received ───────────────────────────
    if (action === "reject_payment") {
      const { error: authErr } = await requireAdmin(req);
      if (authErr) return authErr;

      const { order_id } = body;
      if (!order_id) return NextResponse.json({ error: "order_id required" }, { status: 400 });

      const { data, error } = await admin()
        .from("orders")
        .update({ payment_status: "unpaid", payment_submitted_at: null })
        .eq("id", order_id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    console.error("Payments error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
