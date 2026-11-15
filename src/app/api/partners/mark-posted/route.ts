import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyPartnerLink } from "@/lib/partnerLink";

// POST /api/partners/mark-posted { postId, c, s }
// Partner "Ho gaya ✓" dabata hai — post asal me us ne Threads par laga
// di hai. Signature verify + post ka crm_contact_id isi partner ka hona
// lazmi check hota hai (koi aur ki post mark nahi ho sakti).
// Status 'posted' + posted_at lag jata hai — HQ queue me bhi posted
// dikhega (owner ko pata chalta hai partner ne post laga di).
export async function POST(req: Request) {
  const body: any = await req.json().catch(() => null);
  const postId = typeof body?.postId === "string" ? body.postId : "";
  const c = typeof body?.c === "string" ? body.c : "";
  const s = typeof body?.s === "string" ? body.s : "";
  if (!postId || !verifyPartnerLink(c, s)) {
    return NextResponse.json({ ok: false, error: "invalid_link" }, { status: 401 });
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }

  const { data: post, error: pErr } = await admin
    .from("crm_posts")
    .select("id, crm_contact_id, status")
    .eq("id", postId)
    .maybeSingle();
  if (pErr) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  if (!post || post.crm_contact_id !== c) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  if (post.status === "posted") return NextResponse.json({ ok: true, already: true });

  const { error: uErr } = await admin
    .from("crm_posts")
    .update({ status: "posted", posted_at: new Date().toISOString() })
    .eq("id", postId);
  if (uErr) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
