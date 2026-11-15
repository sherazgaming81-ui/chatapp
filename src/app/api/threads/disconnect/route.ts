import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { OWNER_EMAIL } from "@/lib/types";

// POST /api/threads/disconnect — connected Threads account hatao.
// Owner check: client apna Supabase access token Authorization header me
// bhejta hai; server service-role client se getUser() karke email verify
// karta hai — sirf owner (OWNER_EMAIL) hi disconnect kar sakta hai.
export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if ((data.user.email || "").toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { error: delError } = await admin.from("social_accounts").delete().eq("platform", "threads");
  if (delError) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
