# Threads Posting — Setup Guide (for the Owner)

ChatsApp has **two Threads posting models**:

**1) For partners — ONE-TAP (the main model, NO setup needed)**
The partner simply receives a signed link. Their page shows their
ready-made posts — tapping **"Post on Threads"** opens the Threads
composer with the post already written; the partner just presses
**Post**, comes back, and taps **"Mark as Posted ✓"**. No Meta app, no
token, no account connection. For this model you do NOT need the Meta
app setup below at all — you only need:
- `supabase/crm-upgrade.sql` run first, then `supabase/social-accounts.sql`
  (it adds the partner column on `crm_posts`), and
- the Vercel env vars `POSTING_CRON_SECRET` and
  `SUPABASE_SERVICE_ROLE_KEY` (the signed links and the partner page run
  on these).
The full partner flow is under "Getting partners to post (one-tap)" below.

**2) For your own account — Connect Threads / API auto-posting
(OPTIONAL, later)**
The **Connect Threads** button in HQ → Posting connects your own
Threads account — your own queued posts then publish automatically via
the Threads API. This needs the one-time Meta developer app setup
(Steps 1–7 below). It is a dormant feature — do it whenever you like;
partner posting works fully without it.

> ⚠️ **HARD RULE:** App secrets, the service role key, and the cron
> secret go **only into Vercel env**. Never send them in chat, never
> write them in code. If a secret is ever shared in chat, treat it as
> compromised and rotate it immediately.

---

## (Optional) Owner auto-posting — Meta app setup

> This whole section is ONLY for your own API auto-posting.
> Skip all of it for partner one-tap posting.

## Step 1 — Create the Meta developer app

1. Open [developers.facebook.com](https://developers.facebook.com) and
   log in with your Meta/Facebook account (ideally the one that owns
   your Threads account).
2. Click **My Apps → Create App**.
3. For the app type/use case, pick the **Threads** one
   ("Access the Threads API" / "Threads API"). If a use-case list
   appears, select Threads and continue.
4. Name the app, e.g. `Symbiote ChatsApp`, and create it.

## Step 2 — Threads API product + permissions

1. In the app dashboard, go to **Add Product / Use cases** and
   add/configure the **Threads API** product.
2. These two permissions are required:
   - `threads_basic`
   - `threads_content_publish`
3. In the Threads API settings you'll see the **App ID** and
   **App Secret** — you'll need them in Step 5. (Do NOT share the
   secret anywhere yet.)

## Step 3 — Set the OAuth Redirect URI

In the Threads API settings, in the **Redirect Callback URL / OAuth
Redirect URI** field, enter **exactly** this URI (not a single
character different):

```
https://chatapp0071.vercel.app/api/threads/callback
```

Save it.

## Step 4 — Make your Threads account a tester

The app starts in "Development mode" — in this mode only **tester**
accounts can connect (public use needs Meta App Review, a later stage).

1. In the app dashboard → **Roles / Testers** (Threads tester invites),
   add your Threads username as a **Threads Tester**.
2. Then in your Threads account go to: **Settings → Account → Website
   permissions / Invites** — the invite will be there; **Accept** it.
3. Without accepting the invite, Meta will reject the connection.

## Step 5 — Put the values into Vercel env

In Vercel → project **chatapp** (chatapp0071) → **Settings →
Environment Variables**, add these 5 variables (Production at minimum):

| Name | Where the value comes from |
|---|---|
| `THREADS_APP_ID` | The Threads App ID from Step 2 |
| `THREADS_APP_SECRET` | The App Secret from Step 2 |
| `THREADS_REDIRECT_URI` | `https://chatapp0071.vercel.app/api/threads/callback` |
| `POSTING_CRON_SECRET` | Make it yourself — a long random string (e.g. 32+ characters from a password generator). This is the posting runner's password; don't give it to anyone. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → your project → **Project Settings → API** → the **service_role** secret key |

> `NEXT_PUBLIC_SUPABASE_URL` already exists in Vercel — don't touch it.
> Note: `POSTING_CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are ALSO
> required for partner one-tap links — if you only do one-tap, add at
> least those two.

## Step 6 — Redeploy

After adding env vars, go to Vercel → **Deployments → latest
deployment → ⋯ → Redeploy**, otherwise the running deployment won't
see the new variables.

One more thing to arrange via the main agent: run
`supabase/social-accounts.sql` in the Supabase SQL Editor (tables +
columns + RLS). Without it, connecting and partner pages will fail.

## Step 7 — Connect and test

1. Open ChatsApp (logged in as the owner).
2. Go to **HQ → Posting** — at the top there's the **Threads account**
   card.
3. Press **Connect Threads** → Meta's screen opens → give permission
   with your Threads account.
4. You'll return to ChatsApp and the card will show
   **@username — Connected**.
5. To test, queue a Threads post in the Posting tab (schedule it for
   now) — when the posting runner runs, the post will go live on your
   Threads account and be marked **posted** in the queue.

## Troubleshooting

- **"The Threads app isn't configured on the server yet"** — Vercel
  env is missing or you didn't redeploy (re-check Steps 5/6).
- **Meta error / connection fails** — the redirect URI is wrong
  (Step 3) or the tester invite wasn't accepted (Step 4).
- **Connected but the post didn't go out** — check the card shows
  "Connected"; make sure the post's scheduled time has passed; the
  runner doesn't run without the cron secret (the main agent sets
  that up).
- To switch accounts, **Disconnect** and connect again.

## Getting partners to post (one-tap)

This feature is **NOT for all clients/public — only for your partners
and affiliates** (owner's rule). The partner needs neither a ChatsApp
account nor a Threads connection — just one signed link:

**Your job (owner):**
1. In **HQ → Posting**, write the post and pick the partner in the
   **Partner (one-tap)** dropdown, then queue it. (If you don't pick a
   partner, the post counts as your own and will NOT appear on any
   partner's page.)
2. In **HQ → CRM**, open the partner's contact (the type must be
   **Partner** or **Affiliate** — links are only generated for those).
   In the drawer there's a **"Partner posting link (one-tap)"**
   section — copy the link.
3. Send the link to the partner (e.g. on WhatsApp). You only send it
   once — the partner opens the same link every day.

**The partner's job (daily):**
1. Open the link — the page shows **"<Name> — Today's Posts"** with
   today's ready posts listed.
2. On each post, tap **"Post on Threads"** — Threads opens with the
   post already written — just press **Post**.
3. Come back to the page and tap **"Mark as Posted ✓"** — the post is
   marked **posted** in HQ, so you can see the partner actually did it.

**Note:** partner posts do NOT go through the API/runner — the runner
never touches them. If the partner doesn't tap "Mark as Posted", the
post stays **queued** in HQ — that's your real check of whether the
partner did the work.

## Public clients

Technically the one-tap model could work for anyone, but the owner's
policy is: **only partners/affiliates** get a link. Do not open this
feature to general clients. (API auto-posting via Connect Threads also
stays dormant, for the owner's own account only, for now.)
