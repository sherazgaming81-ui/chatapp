import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyPartnerLink } from "@/lib/partnerLink";

// GET /api/partners/posts?c=<contactId>&s=<signature>
// Partner ke signed page ke liye us ki AAJ ki queued posts.
// Signature HMAC se verify hoti hai (partnerLink.ts) — bina sahi link ke
// koi posts nahi milti. Data service role se ata hai kyunke partner ke
// paas ChatsApp login nahi hota aur client anon key crm_posts nahi parh
// sakti (owner-only RLS).
// Due = scheduled_at aaj (Asia/Karachi) ke khatam hone se pehle ki har
// queued post (jo waqt guzar chuka hai wo bhi, aaj ki aane wali bhi).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const c = url.searchParams.get("c") || "";
  const s = url.searchParams.get("s") || "";
  if (!verifyPartnerLink(c, s)) {
    return NextResponse.json({ ok: false, error: "invalid_link" }, { status: 401 });
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }

  const { data: contact, error: cErr } = await admin
    .from("crm_contacts")
    .select("id, name, kind")
    .eq("id", c)
    .maybeSingle();
  if (cErr) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  if (!contact) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  // Aaj ki tareekh Asia/Karachi me, aur us din ka aakhir (+05:00)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const todayKarachi = `${get("year")}-${get("month")}-${get("day")}`;
  const endOfToday = new Date(`${todayKarachi}T23:59:59.999+05:00`).toISOString();

  const { data: posts, error: pErr } = await admin
    .from("crm_posts")
    .select("id, platform, body, scheduled_at")
    .eq("crm_contact_id", c)
    .eq("status", "queued")
    .lte("scheduled_at", endOfToday)
    .order("scheduled_at", { ascending: true });
  if (pErr) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    partner: { name: contact.name || "" },
    posts: (posts || []).map((p: any) => ({
      id: p.id,
      platform: p.platform,
      body: p.body || "",
      scheduled_at: p.scheduled_at,
    })),
  });
}
