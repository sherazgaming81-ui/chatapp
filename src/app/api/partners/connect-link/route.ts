import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { OWNER_EMAIL } from "@/lib/types";
import { signPartnerLink } from "@/lib/partnerLink";

// POST /api/partners/connect-link { contactId } — partner ke liye signed
// Threads connect link banao. Link client-side sign NAHI ho sakta (HMAC
// secret server par hai), is liye owner HQ drawer se ye route call karta
// hai. Owner check disconnect route wala hi pattern: client apna Supabase
// access token Authorization header me bhejta hai, server getUser() se
// email verify karta hai — sirf OWNER link bana sakta hai.
// Sirf kind = 'partner' | 'affiliate' contacts ke liye link banta hai
// (owner ki shart: ye feature tamam clients/public ke liye NAHI).
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

  const body: any = await req.json().catch(() => null);
  const contactId = typeof body?.contactId === "string" ? body.contactId : "";
  if (!contactId) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const { data: contact, error: cErr } = await admin
    .from("crm_contacts")
    .select("id, kind, name")
    .eq("id", contactId)
    .maybeSingle();
  if (cErr) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  if (!contact) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (contact.kind !== "partner" && contact.kind !== "affiliate") {
    return NextResponse.json({ ok: false, error: "not_partner" }, { status: 400 });
  }

  const path = signPartnerLink(contactId);
  if (!path) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });

  const url = `${new URL(req.url).origin}${path}`;
  return NextResponse.json({ ok: true, url });
}
