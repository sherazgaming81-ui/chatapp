import { NextResponse } from "next/server";
import { verifyPartnerLink } from "@/lib/partnerLink";

// GET /api/threads/connect — Threads OAuth shuru karo.
// Do raste:
//  1) OWNER: HQ → Posting tab ke "Connect Threads" button se — state khaali,
//     callback HQ par wapas le jata hai (owner ka default account).
//  2) PARTNER: /threads/connect page se ?c=<contactId>&s=<signature> ke sath —
//     signature verify hone par contactId OAuth `state` me jata hai, taake
//     callback account ko usi partner (CRM contact) se jod de.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const appId = process.env.THREADS_APP_ID;
  const redirectUri = process.env.THREADS_REDIRECT_URI;

  const c = url.searchParams.get("c");
  const s = url.searchParams.get("s");
  const isPartner = !!(c && s);
  const partnerValid = isPartner && verifyPartnerLink(c!, s!);

  if (isPartner && !partnerValid) {
    // Ghalat signature — partner page par error ke sath wapas
    return NextResponse.redirect(`${origin}/threads/connect?error=invalid`);
  }

  if (!appId || !redirectUri) {
    // Meta app abhi Vercel env me configure nahi hua
    if (partnerValid) {
      return NextResponse.redirect(
        `${origin}/threads/connect?c=${encodeURIComponent(c!)}&s=${encodeURIComponent(s!)}&error=not_configured`
      );
    }
    return NextResponse.redirect(`${origin}/?threads=not_configured`);
  }

  const auth = new URL("https://threads.net/oauth/authorize");
  auth.searchParams.set("client_id", appId);
  auth.searchParams.set("redirect_uri", redirectUri);
  auth.searchParams.set("scope", "threads_basic,threads_content_publish");
  auth.searchParams.set("response_type", "code");
  if (partnerValid) auth.searchParams.set("state", c!);
  return NextResponse.redirect(auth.toString());
}
