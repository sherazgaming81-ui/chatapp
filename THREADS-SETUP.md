# Threads Posting — Setup Guide (Owner ke liye)

ChatsApp me Threads posting ke **do model** hain:

**1) Partners ke liye — ONE-TAP (ye asal model hai, koi setup NAHI chahiye)**
Partner ko sirf aik signed link milta hai. Us page par us ki ready-made
posts aati hain — "Threads par lagao" button se Threads composer (pehle
se bhara hua) khulta hai, partner sirf **Post** dabata hai aur wapas
aakar **"Ho gaya ✓"** mark kar deta hai. Na Meta app, na token, na
account connect. Is ke liye neeche wala Meta app setup **bilkul zaroori
NAHI** — sirf `supabase/crm-upgrade.sql` ke baad
`supabase/social-accounts.sql` chalana hai (us me `crm_posts` par
partner wala column hai) aur Vercel env me `POSTING_CRON_SECRET` +
`SUPABASE_SERVICE_ROLE_KEY` hone chahiye (signed link aur partner page
inhi se chalte hain). Partner wala poora flow neeche "Partners ko posts
lagwana (one-tap)" me hai.

**2) Owner ke apne account ke liye — Connect Threads / API auto-posting
(OPTIONAL, baad me)**
HQ → Posting tab me **Connect Threads** button se tum apna Threads
account jod sakte ho — phir tumhari apni queue posts Threads API se khud
publish hongi. Is ke liye Meta developer app wali aik-dafa setup
zaroori hai (neeche Steps 1–7). Ye dormant feature hai — jab dil kare
tab kar lena, partners wala kaam is ke baghair bhi pura chalta hai.

> ⚠️ **SAKHT RULE:** App Secret, service role key aur cron secret **sirf
> Vercel env me** dalne hain. Chat me kabhi mat bhejna, code me kabhi mat
> likhna. Jo banda secret chat me bhej de, wo compromised samjho — foran
> rotate karo.

---

## (Optional) Owner auto-posting — Meta app setup

> Ye poora hissa SIRF owner ke apne API auto-posting ke liye hai.
> Partners ke one-tap ke liye ye sab SKIP kar do.

## Step 1 — Meta developer app banao

1. Browser me [developers.facebook.com](https://developers.facebook.com) kholo
   aur apne Meta/Facebook account se login karo (wohi account jis ka Threads
   hai — behtar hai).
2. Upar **My Apps → Create App** par click karo.
3. App type/use case me **Threads** wala use case chuno
   ("Access the Threads API" / "Threads API" use case). Agar use case ki list
   aye to Threads wala select karke aage barho.
4. App ka naam do, masalan: `Symbiote ChatsApp` — aur **Create App** kar do.

## Step 2 — Threads API product + permissions

1. App dashboard me **Add Product / Use cases** me ja kar **Threads API**
   product add/configure karo.
2. Permissions me ye do lazmi hon:
   - `threads_basic`
   - `threads_content_publish`
3. Threads API Settings me **App ID** aur **App Secret** nazar ayenge — ye
   Step 5 me chahiye honge. (Secret abhi kahin share NAHI karna.)

## Step 3 — OAuth Redirect URI set karo

Threads API settings me **Redirect Callback URL / OAuth Redirect URI** wale
khane me **bilkul yehi** URI dalo (aik harf ka farq bhi nahi):

```
https://chatapp0071.vercel.app/api/threads/callback
```

Save kar do.

## Step 4 — Apna Threads account tester banao

App abhi "Development mode" me hoga — is mode me sirf **tester** accounts
connect kar sakte hain (public ke liye baad me Meta App Review lagega, wo
alag marhala hai).

1. App dashboard → **Roles / Testers** (Threads tester invites) me apna
   Threads username add karo as **Threads Tester**.
2. Phir apne Threads account me jao: **Settings → Account → Website
   permissions / Invites** — wahan invite ayega, **Accept** kar do.
3. Invite accept kiye baghair connect karne par Meta error dega.

## Step 5 — Vercel env me values dalo

Vercel → project **chatapp** (chatapp0071) → **Settings → Environment
Variables** me ye 5 variables add karo (Production par lazmi):

| Name | Value kahan se |
|---|---|
| `THREADS_APP_ID` | Step 2 wali Threads App ID |
| `THREADS_APP_SECRET` | Step 2 wali App Secret |
| `THREADS_REDIRECT_URI` | `https://chatapp0071.vercel.app/api/threads/callback` |
| `POSTING_CRON_SECRET` | Khud banao — lamba random text (masalan password generator se 32+ characters). Ye posting runner ka password hai, kisi ko mat do. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → apna project → **Project Settings → API** → **service_role** secret key |

> `NEXT_PUBLIC_SUPABASE_URL` pehle se Vercel me mojood hai — use mat chherna.

## Step 6 — Redeploy

Env dalne ke baad Vercel me **Deployments → latest deployment → ⋯ →
Redeploy** karo, warna naye env purani deployment ko nahi milenge.

Aur aik zaroori kaam main agent se karwana hai: Supabase SQL Editor me
`supabase/social-accounts.sql` chalana (table + RLS). Bina is ke connect
fail hoga.

## Step 7 — Connect karke test karo

1. ChatsApp kholo (owner account se login).
2. **HQ → Posting** tab me jao — upar **Threads account** wala card hoga.
3. **Connect Threads** button dabao → Meta ki screen khulegi → apne Threads
   account se permission do.
4. Wapas ChatsApp par aoge aur card par **@username — Connected** dikhega.
5. Test ke liye Posting tab me aik Threads post queue karo (schedule abhi ka
   rakho) — posting runner chalne par wo post tumhare Threads account par
   live ho jayegi aur queue me **posted** mark ho jayegi.

## Masla ho to?

- **"Server par Threads app abhi configure nahi"** — Vercel env missing hai
  ya redeploy nahi hua (Step 5/6 dobara check karo).
- **Meta error / connect fail** — redirect URI ghalat hai (Step 3) ya tester
  invite accept nahi hua (Step 4).
- **Connect ho gaya magar post nahi gayi** — account card par "Connected"
  check karo; post ka schedule time guzar chuka ho; runner cron-secret ke
  baghair nahi chalta (ye main agent setup karega).
- Account badalna ho to **Disconnect** karke dobara Connect kar do.

## Partners ko posts lagwana (one-tap)

Ye feature **tamam clients/public ke liye NAHI hai — sirf tumhare partners
aur affiliates ke liye hai** (owner ki shart). Partner ko na ChatsApp
account chahiye, na Threads connect karna hai — sirf aik signed link
chahiye:

**Owner ka kaam:**
1. **HQ → Posting** me post likho aur **Partner (one-tap)** wale dropdown
   se partner select karke queue kar do. (Partner select na karo to post
   tumhari apni samjhi jayegi — partner ke page par NAHI jayegi.)
2. **HQ → CRM** me partner ka contact kholo (type **Partner** ya
   **Affiliate** hona chahiye — sirf inhi par link banta hai). Drawer me
   **"Partner posts link (one-tap)"** wala section hai — link copy karo.
3. Link partner ko bhej do (masalan WhatsApp par). Link aik hi dafa
   bhejna hai — partner roz yehi link kholega.

**Partner ka kaam (roz):**
1. Link khole — page par **"<Naam> — Aaj ki posts"** ayega, us ki aaj ki
   ready posts list hongi.
2. Har post par **"Threads par lagao"** dabaye — Threads khulega, post
   pehle se likhi hogi — sirf **Post** dabana hai.
3. Wapas page par aakar **"Ho gaya ✓"** dabaye — post HQ me **posted**
   mark ho jayegi, taake tumhein pata chal jaye ke partner ne laga di.

**Note:** partner wali posts API/runner se NAHI jati — runner un ko
haath nahi lagata. Partner "Ho gaya" na dabaye to post HQ me queued hi
dikhegi, wahi asal check hai ke partner ne kaam kiya ya nahi.

## Public clients ke liye

One-tap model technically har kisi ke liye chal sakta hai, lekin owner
ki policy hai: **sirf partners/affiliates** ko link milega. Aam clients
ke liye ye feature NAHI kholna. (API auto-posting wala Connect Threads
bhi filhal sirf owner ke apne account ke liye dormant hai.)
