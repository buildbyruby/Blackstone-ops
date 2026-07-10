import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function requireAdmin(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
    if (!token) return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    const { data: { user }, error } = await admin().auth.getUser(token);
    if (error || !user) return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    return { user, error: null };
  } catch {
    return { user: null, error: NextResponse.json({ error: "Auth failed" }, { status: 500 }) };
  }
}

export async function validateCustomer(customerId: string) {
  if (!customerId) return { valid: false };
  try {
    const { data } = await admin().from("customers").select("status").eq("id", customerId).single();
    return { valid: data?.status === "active", status: data?.status };
  } catch { return { valid: false }; }
}

const rlMap = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, max = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rlMap.get(key);
  if (!entry || now > entry.resetAt) { rlMap.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (entry.count >= max) return false;
  entry.count++; return true;
}

export function sanitize(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max).replace(/[<>]/g, "");
}

export function sanitizeNum(v: unknown): number | null {
  const n = Number(v);
  return isNaN(n) || !isFinite(n) ? null : n;
}

export { admin };
