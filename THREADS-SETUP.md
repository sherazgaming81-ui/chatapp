# Connect Threads — Setup Guide (Owner ke liye)

ChatsApp ke HQ → Posting tab me **Connect Threads** ka button hai. Us se banda
apna Threads account jodta hai, aur phir queue ki Threads posts **usi account
se, Threads API se, bina approval** publish hoti hain (permission connect
karte waqt hi mil jati hai).

Lekin pehle **aik dafa ki setup** zaroori hai: Meta par developer app banana
aur us ki keys Vercel me dalna. Neeche saare steps hain.

> ⚠️ **SAKHT RULE:** App Secret, service role key aur cron secret **sirf
> Vercel env me** dalne hain. Chat me kabhi mat bhejna, code me kabhi mat
> likhna. Jo banda secret chat me bhej de, wo compromised samjho — foran
> rotate karo.

---

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

## Partners ko connect karwana

Ye feature **tamam clients/public ke liye NAHI hai — sirf tumhare partners
aur affiliates ke liye hai** (owner ki shart). Partner ko ChatsApp account
bhi NAHI chahiye — wo sirf aik signed link se apna Threads jodta hai:

1. ChatsApp me **HQ → CRM** kholo aur partner ka contact kholo (contact ka
   type **Partner** ya **Affiliate** hona chahiye — sirf inhi par link
   banta hai).
2. Drawer me **"Threads connect link (partner ke liye)"** wala section
   hoga — wahan link khud ban jata hai. **Copy** dabao.
3. Wo link partner ko bhej do (masalan WhatsApp par).
4. Partner link kholega — use apna naam ke sath salaam aur bara
   **Connect Threads** button milega. Button dabate hi Threads ki official
   screen khulegi → wo apne Threads account se login karke **Allow**
   karega → "Ho gaya!" wala page aa jayega. Khatam — us ka account us ke
   CRM contact ke sath jud gaya.
5. Ab **HQ → Posting** me us partner ki post queue karte waqt
   **Threads account** wale dropdown se **us partner ka account** select
   karna — post usi ke account se jayegi. "Default" rehne do to post sab
   se pehle connected account (aam tor par tumhare apne) se jayegi.
   Connected accounts ki poori list bhi Posting tab me dikhti hai.

**Dev mode ki note:** jab tak Meta app Development mode me hai, partner
ko bhi pehle Step 4 ki tarah **Threads Tester** add karke invite accept
karwana hoga, warna Meta connect rok dega. Har partner ke liye ye aik
dafa ka kaam hai. (App Review ke baad ye shart khatam ho jati hai.)

## Public clients ke liye (baad ka marhala)

Abhi app Development mode me hai — sirf tester accounts (tumhare apne +
partners jin ko tester banaya ho) connect honge. Jab ChatsApp aam clients
ko dena ho to Meta **App Review** ke liye submit karna hoga taake har
banda apna Threads jod sake. Wo marhala alag hai — filhal apne aur
partners ke accounts par poora system test kar lo.
