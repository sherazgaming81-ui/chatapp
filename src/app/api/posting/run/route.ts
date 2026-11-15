import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// POST /api/posting/run — due Threads posts publish karo (cron se chalta hai).
// Guard: header `x-cron-secret` == env POSTING_CRON_SECRET ho tab hi chale ga.
// Kaam: crm_posts se due threads posts (queued, scheduled_at <= now, limit 5)
// uthao → har post ke account ke token se Threads API par publish →
// status posted/failed update.
//
// ACCOUNT SELECTION (partners system): post.social_account_id ho to post
// USI account se jati hai (partner ki post partner ke account se); na ho
// to default = sab se pehla connected account (created_at sab se pehla —
// aam tor par owner ka account). Koi account hi connected na ho to posts
// queued hi rehti hain (failed NAHI karte), summary me "no_account".
// Token expiry 7 din se kam ho to pehle refresh karte hain.

type AccountRow = {
  id: string;
  threads_user_id: string | null;
  username: string | null;
  access_token: string | null;
  token_expires_at: string | null;
};

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

  // 1) saare connected Threads accounts (created_at asc — pehla = default)
  const { data: accounts, error: accErr } = await admin
    .from("social_accounts")
    .select("id, threads_user_id, username, access_token, token_expires_at")
    .eq("platform", "threads")
    .order("created_at", { ascending: true });
  if (accErr) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });

  const usable = (accounts || []).filter((a: AccountRow) => a.access_token && a.threads_user_id) as AccountRow[];
  if (usable.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, posted: 0, failed: 0, note: "no_account" });
  }
  const defaultAccount = usable[0];
  const byId = new Map(usable.map((a) => [a.id, a]));

  // 2) due posts
  const { data: posts, error: postErr } = await admin
    .from("crm_posts")
    .select("id, body, social_account_id")
    .eq("platform", "threads")
    .eq("status", "queued")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(5);
  if (postErr) return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });

  // 3) har account ka token zaroorat par refresh (aik dafa per account)
  const tokenByAccount = new Map<string, string>();
  const freshToken = async (account: AccountRow): Promise<string> => {
    const cached = tokenByAccount.get(account.id);
    if (cached) return cached;
    let token: string = account.access_token!;
    const expiresAt = account.token_expires_at ? Date.parse(account.token_expires_at) : 0;
    if (expiresAt && expiresAt - Date.now() < 7 * 86400e3) {
      try {
        const url = new URL("https://graph.threads.net/refresh_access_token");
        url.searchParams.set("grant_type", "th_refresh_token");
        url.searchParams.set("access_token", token);
        const r = await fetch(url.toString());
        const j: any = await r.json().catch(() => null);
        if (r.ok && j?.access_token) {
          token = String(j.access_token);
          const newExpiry = j.expires_in ? new Date(Date.now() + Number(j.expires_in) * 1000).toISOString() : account.token_expires_at;
          await admin
            .from("social_accounts")
            .update({ access_token: token, token_expires_at: newExpiry, updated_at: new Date().toISOString() })
            .eq("id", account.id);
        }
      } catch { /* refresh fail — purane token se try karo */ }
    }
    tokenByAccount.set(account.id, token);
    return token;
  };

  let posted = 0;
  let failed = 0;

  for (const post of posts || []) {
    // post ka account: social_account_id wala, warna default (pehla connected)
    const account = (post.social_account_id && byId.get(post.social_account_id)) || defaultAccount;
    try {
      const accessToken = await freshToken(account);
      const userId = account.threads_user_id!;

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
    accounts: usable.length,
  });
}
