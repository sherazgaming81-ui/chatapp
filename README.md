# Chat — WhatsApp style messenger

WhatsApp jaisa web messenger — **sirf Google login**, koi phone number nahi, koi voice/video call nahi.

Backend: **Supabase** (preferred) ya **Firebase** — jo configure ho wahi chalega,
warna app demo mode me chalti hai.

## Features

- 🔑 Sirf Google se login
- 💬 1:1 chats + group chats (real-time)
- ✓✓ Sent / delivered / read ticks (blue ticks)
- ⌨️ Typing indicator, online / last-seen status
- 😊 Emoji picker, 📷 photo sharing, 🎤 voice notes
- ↩️ Reply, 🗑️ delete for me / for everyone
- 🔍 Chat search + user search, unread badges
- 🌙 WhatsApp Web jaisa dark theme

## Bina backend ke (demo mode)

Agar koi backend keys set nahi hain to app **demo mode** me chalti hai —
sample chats ke saath, taake UI dekha ja sake. Koi real login ya messaging nahi hogi.

## Supabase setup (real mode, ~10 min, free)

1. **Project banao:** [supabase.com](https://supabase.com) → New project (free plan)
2. **Tables banao:** SQL Editor → New query → `supabase-schema.sql` ka content
   paste karke Run karein (tables + realtime + storage + security policies sab ban jayengi)
3. **Google login on karo:**
   - Pehle [Google Cloud Console](https://console.cloud.google.com) → APIs & Services →
     Credentials → Create Credentials → OAuth client ID (Web application)
   - Authorized redirect URI me ye add karein:
     `https://<tumhara-project-ref>.supabase.co/auth/v1/callback`
     (project-ref Supabase dashboard ke URL me nazar aayega)
   - Client ID aur Client Secret copy karo
   - Supabase → Authentication → Providers → Google → Enable, wahan ID + secret paste karo
4. **Keys copy karo:** Supabase → Project Settings → API →
   `URL` aur `anon public` key
5. **Vercel me lagao:** Vercel project → Settings → Environment Variables →
   `NEXT_PUBLIC_SUPABASE_URL` aur `NEXT_PUBLIC_SUPABASE_ANON_KEY` add karo
6. **Redeploy karo** taake nayi env vars lag jayein

## Firebase setup (alternative)

1. [console.firebase.google.com](https://console.firebase.google.com) → Add project
2. Authentication → Sign-in method → Google → Enable
3. Firestore Database → Create database (Production mode) →
   Rules me `firestore.rules` ka content paste karke Publish
4. Storage → Get started → Rules me `storage.rules` ka content paste karke Publish
5. Project settings → Add web app → config values copy karo
6. Vercel → Environment Variables me `NEXT_PUBLIC_FIREBASE_*` keys lagao → Redeploy
7. Authentication → Settings → Authorized domains me apna Vercel domain add karo

## Local development

```bash
npm install
cp .env.example .env.local   # backend values bharein (ya khaali = demo mode)
npm run dev
```

## Deploy

Vercel project `chat` me har nayi deployment ke liye `create_deployment`
(API) use hota hai. Mustaqbil me GitHub repo link karke auto-deploy bhi lagaya ja sakta hai.
