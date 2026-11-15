import { NextResponse } from "next/server";

// GET /api/threads/connect — Threads OAuth shuru karo.
// Owner HQ → Posting tab ke "Connect Threads" button se yahan ata hai,
// phir Threads (Meta) ki official authorize screen par redirect hota hai.
// Permission wahan milti hai: threads_basic + threads_content_publish.
export async function GET(req: Request) {
  const appId = process.env.THREADS_APP_ID;
  const redirectUri = process.env.THREADS_REDIRECT_URI;
  const origin = new URL(req.url).origin;

  if (!appId || !redirectUri) {
    // Meta app abhi Vercel env me configure nahi hua
    return NextResponse.redirect(`${origin}/?threads=not_configured`);
  }

  const url = new URL("https://threads.net/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "threads_basic,threads_content_publish");
  url.searchParams.set("response_type", "code");
  return NextResponse.redirect(url.toString());
}
