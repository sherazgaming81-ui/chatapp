import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signPartnerLink } from "@/lib/partnerLink";

// GET /api/threads/callback?code=...&state=... — Threads OAuth ka wapas ana.
// Flow: code → short-lived token → long-lived token (~60 din) →
// /me se user id + username → social_accounts me upsert (service role).
// `state` me contactId ho (partner flow) to account us CRM contact se
// judta hai (crm_contact_id + label = contact ka naam) aur redirect
// partner page par success ke sath jata hai. State na ho to owner flow —
// HQ par redirect (?threads=connected).
export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const origin = reqUrl.origin;
  const contactId = reqUrl.searchParams.get("state") || null;

  const partnerBack = (ok: boolean) => {
    if (contactId) {
      const link = signPartnerLink(contactId);
      if (link) {
        const sep = link.includes("?") ? "&" : "?";
        return NextResponse.redirect(`${origin}${link}${ok ? `${sep}done=1` : `${sep}error=error`}`);
      }
    }
    return NextResponse.redirect(`${origin}/?threads=${ok ? "connected" : "error"}`);
  };
  const back = (s: string) => {
    if (contactId && s !== "connected") return partnerBack(false);
    return NextResponse.redirect(`${origin}/?threads=${s}`);
  };

  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  const redirectUri = process.env.THREADS_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    if (contactId) {
      const link = signPartnerLink(contactId);
      if (link) return NextResponse.redirect(`${origin}${link}&error=not_configured`);
    }
    return back("not_configured");
  }

  const code = reqUrl.searchParams.get("code");
  if (!code) return back("error");

  try {
    // 1) code → short-lived access token
    const form = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    });
    const shortRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const shortJson: any = await shortRes.json().catch(() => null);
    const shortToken: string | undefined = shortJson?.access_token;
    const userIdFromToken: string | undefined = shortJson?.user_id ? String(shortJson.user_id) : undefined;
    if (!shortRes.ok || !shortToken) return back("error");

    // 2) short → long-lived token (~60 din)
    const longUrl = new URL("https://graph.threads.net/access_token");
    longUrl.searchParams.set("grant_type", "th_exchange_token");
    longUrl.searchParams.set("client_secret", appSecret);
    longUrl.searchParams.set("access_token", shortToken);
    const longRes = await fetch(longUrl.toString());
    const longJson: any = await longRes.json().catch(() => null);
    const longToken: string | undefined = longJson?.access_token;
    const expiresIn: number = Number(longJson?.expires_in || 0);
    if (!longRes.ok || !longToken) return back("error");

    // 3) user id + username
    const meUrl = new URL("https://graph.threads.net/v1.0/me");
    meUrl.searchParams.set("fields", "id,username");
    meUrl.searchParams.set("access_token", longToken);
    const meRes = await fetch(meUrl.toString());
    const meJson: any = await meRes.json().catch(() => null);
    const threadsUserId = String(meJson?.id || userIdFromToken || "");
    const username = typeof meJson?.username === "string" ? meJson.username : null;
    if (!threadsUserId) return back("error");

    // 4) Partner flow: contact ka naam label ke liye (state = crm_contact_id)
    const admin = supabaseAdmin();
    let label: string | null = null;
    if (contactId) {
      const { data: contact } = await admin.from("crm_contacts").select("name").eq("id", contactId).maybeSingle();
      label = contact?.name || null;
    }

    // 5) social_accounts me upsert (service role — RLS bypass, server-only)
    const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    const { error } = await admin
      .from("social_accounts")
      .upsert(
        {
          platform: "threads",
          threads_user_id: threadsUserId,
          username,
          access_token: longToken,
          token_expires_at: expiresAt,
          crm_contact_id: contactId,
          label,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "platform,threads_user_id" }
      );
    if (error) return back("error");

    if (contactId) return partnerBack(true);
    return back("connected");
  } catch {
    return back("error");
  }
}
