import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customer_id");
    let query = admin().from("orders").select("*, customers(name, phone), order_items(*)").order("created_at", { ascending: false });
    if (customerId) query = query.eq("customer_id", customerId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { customer_id, location, notes, items, total, payment_timing } = body;
    if (!customer_id || !location || !items?.length) {
      return NextResponse.json({ error: "customer_id, location, items required" }, { status: 400 });
    }
    const timing = ["before_delivery", "upon_delivery", "after_delivery"].includes(payment_timing)
      ? payment_timing
      : "upon_delivery";

    const supabase = admin();

    const { data: cust, error: custErr } = await supabase.from("customers").select("status").eq("id", customer_id).single();
    if (custErr || !cust || cust.status !== "active") {
      return NextResponse.json({ error: "Your account is not active. Please refresh.", status: cust?.status || "unknown" }, { status: 403 });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        customer_id,
        location,
        notes: notes || null,
        total,
        status: "new",
        payment_timing: timing,
        payment_status: "unpaid",
        amount_paid: 0,
      })
      .select()
      .single();
    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

    const orderItems = items.map((i: any) => ({
      order_id: order.id,
      product_id: i.product_id || null,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
    }));
    const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

    // Decrement stock — wrapped safely, never blocks order creation
    for (const item of items) {
      if (item.product_id) {
        try {
          await supabase.rpc("decrement_stock", { p_id: item.product_id, qty: item.quantity });
        } catch (stockErr) {
          console.error("Stock decrement failed (non-blocking):", stockErr);
        }
      }
    }

    try {
      await supabase.from("notifications").insert({
        type: "order",
        title: "New order",
        body: `New order ${order.order_ref} — KES ${Number(total).toFixed(2)}`,
        link: "/admin/orders",
      });
    } catch (notifErr) {
      console.error("Notification insert failed (non-blocking):", notifErr);
    }

    return NextResponse.json(order, { status: 201 });
  } catch (e: any) {
    console.error("Order creation failed:", e);
    return NextResponse.json({ error: e.message || "Failed to create order" }, { status: 500 });
  }
}
