import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// POST /api/posting/run — due Threads posts publish karo (cron se chalta hai).
// Guard: header `x-cron-secret` == env POSTING_CRON_SECRET ho tab hi chale ga.
// Kaam: crm_posts se due threads posts (queued, scheduled_at <= now, limit 5)
// uthao → connected Threads account ke token se Threads API par publish →
// status posted/failed update. Account connected na ho to posts queued hi
// rehti hain (failed NAHI karte) aur summary me "no_account" ata hai.
// Token expiry 7 din se kam ho to pehle refresh karte hain.
export async function POST(req: Request) {
  const secret = process.env.POSTING_CRON_SECRET;
  const given = req.headers.get("x-cron-secret");
  if (!secret || !given || given !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 });
  }

  // 1) connected Threads account (sab se taza)
  const { data: accounts, error: accErr } = await admin
    .from("social_accounts")
    .select("id, threads_user_id, username, access_token, token_expires_at")
    .eq("platform", "threads")
    .order("updated_at", { ascending: false })
    .limit(1);
  if (accErr) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });

  const account = accounts?.[0];
  if (!account?.access_token || !account?.threads_user_id) {
    return NextResponse.json({ ok: true, processed: 0, posted: 0, failed: 0, note: "no_account" });
  }

  let accessToken: string = account.access_token;
  const userId: string = account.threads_user_id;

  // 2) token expiry qareeb (< 7 din) ho to refresh
  const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : 0;
  if (expiresAt && expiresAt - Date.now() < 7 * 86400e3) {
    try {
      const url = new URL("https://graph.threads.net/refresh_access_token");
      url.searchParams.set("grant_type", "th_refresh_token");
      url.searchParams.set("access_token", accessToken);
      const r = await fetch(url.toString());
      const j: any = await r.json().catch(() => null);
      if (r.ok && j?.access_token) {
        accessToken = String(j.access_token);
        const newExpiry = j.expires_in ? new Date(Date.now() + Number(j.expires_in) * 1000).toISOString() : account.token_expires_at;
        await admin
          .from("social_accounts")
          .update({ access_token: accessToken, token_expires_at: newExpiry, updated_at: new Date().toISOString() })
          .eq("id", account.id);
      }
    } catch { /* refresh fail — purane token se try karo */ }
  }

  // 3) due posts
  const { data: posts, error: postErr } = await admin
    .from("crm_posts")
    .select("id, body")
    .eq("platform", "threads")
    .eq("status", "queued")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(5);
  if (postErr) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });

  let posted = 0;
  let failed = 0;

  for (const post of posts || []) {
    try {
      // container banao
      const createForm = new URLSearchParams({
        media_type: "TEXT",
        text: post.body || "",
        access_token: accessToken,
      });
      const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: createForm.toString(),
      });
      const createJson: any = await createRes.json().catch(() => null);
      const creationId = createJson?.id ? String(createJson.id) : null;
      if (!createRes.ok || !creationId) throw new Error("container_failed");

      // Threads API ko container ready hone ke liye thora waqt chahiye hota hai
      await new Promise((res) => setTimeout(res, 1500));

      // publish karo
      const pubForm = new URLSearchParams({ creation_id: creationId, access_token: accessToken });
      const pubRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: pubForm.toString(),
      });
      const pubJson: any = await pubRes.json().catch(() => null);
      if (!pubRes.ok || !pubJson?.id) throw new Error("publish_failed");

      await admin
        .from("crm_posts")
        .update({ status: "posted", posted_at: new Date().toISOString() })
        .eq("id", post.id);
      posted++;
    } catch {
      await admin.from("crm_posts").update({ status: "failed" }).eq("id", post.id);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: (posts || []).length,
    posted,
    failed,
    account: account.username || undefined,
  });
}
