-- ═══════════════════════════════════════════════════════════════════════════
-- ChatsApp — Social Accounts (Connect Threads) table
-- ═══════════════════════════════════════════════════════════════════════════
-- Ye file sirf BANAYI gayi hai — main agent baad me chalaye ga.
-- Chalane ka tareeqa: Supabase Dashboard → SQL Editor → ye poori file paste
-- karke Run. (crm-upgrade.sql ke BAAD chalana — wahi RLS pattern hai.)
--
-- Kya banta hai:
--   public.social_accounts — connected social accounts (owner + PARTNERS).
--   Threads OAuth se mila long-lived access token yahan store hota hai.
--   Posting runner (server, service role) isi token se Threads API par
--   queue ki posts publish karta hai — bina approval, kyunke publish ki
--   permission banda connect karte waqt khud deta hai.
--
-- PARTNERS-ONLY (owner ki shart): ye feature tamam clients/public ke liye
-- NAHI hai. Sirf owner ke partners/affiliates (crm_contacts me kind =
-- 'partner' ya 'affiliate') ke liye hai.
--
-- PARTNER MODEL = ONE-TAP (owner ka faisla): partners ke liye OAuth /
-- Connect Threads NAHI hai. Owner CRM se partner ko aik signed link
-- bhejta hai; partner us page par apni ready-made queued posts dekhta
-- hai, "Threads par lagao" button se Threads composer (pehle se bhara
-- hua) khulta hai, wo sirf Post dabata hai aur "Ho gaya" mark kar deta
-- hai. Partner ki posts crm_posts.crm_contact_id se us se judti hain.
--
-- social_accounts / OAuth wala hissa sirf OWNER ke apne auto-posting ke
-- liye hai (optional — kabhi Meta app banaya to kaam ayega, dormant hai).
-- Owner ka account connect ho to crm_contact_id NULL wali row banti hai
-- aur crm_posts.social_account_id se account select hota hai.
--
-- SECURITY: access_token SIRF server (service role) parh sakta hai.
-- Client (HQ page) sirf username / platform / token_expires_at dekhta hai —
-- token column client ko kabhi select karke NAHI bhejna (lib/crm.ts ka
-- getThreadsAccount() sirf safe columns select karta hai). RLS bhi
-- owner-only hai (JWT email = sherazgaming81@gmail.com).
-- ═══════════════════════════════════════════════════════════════════════════

-- updated_at helper (crm-upgrade.sql wala hi pattern — idempotent)
create or replace function public.crm_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.social_accounts (
  id               uuid primary key default gen_random_uuid(),
  platform         text not null check (platform in ('threads')),
  threads_user_id  text,
  username         text,
  access_token     text,
  token_expires_at timestamptz,
  -- user_id: agar kabhi ChatsApp-login wala user khud connect kare (filhal null)
  user_id          uuid null,
  -- crm_contact_id: ye account kis CRM contact (partner/affiliate) ka hai.
  -- Owner ke apne default account par NULL rehta hai.
  crm_contact_id   uuid null references public.crm_contacts(id) on delete set null,
  -- label: dikhane ke liye naam (masalan partner ka naam)
  label            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (platform, threads_user_id)
);

-- Agar table pehle wale version se bani ho to naye columns idempotent add
alter table public.social_accounts add column if not exists user_id uuid null;
alter table public.social_accounts
  add column if not exists crm_contact_id uuid null references public.crm_contacts(id) on delete set null;
alter table public.social_accounts add column if not exists label text;

-- Har post kis account se jayegi — Posting tab me select hota hai.
-- NULL = default (sab se pehla connected account).
alter table public.crm_posts
  add column if not exists social_account_id uuid references public.social_accounts(id) on delete set null;

-- Har post kis partner ki hai (one-tap model) — Posting tab me partner
-- select hota hai; partner apne signed page par sirf APNI posts dekhta
-- hai aur khud laga kar "Ho gaya" mark karta hai. NULL = owner ki post.
alter table public.crm_posts
  add column if not exists crm_contact_id uuid references public.crm_contacts(id) on delete set null;

drop trigger if exists social_accounts_touch on public.social_accounts;
create trigger social_accounts_touch
  before update on public.social_accounts
  for each row execute function public.crm_touch_updated_at();

-- RLS — sirf OWNER (JWT email = sherazgaming81@gmail.com), baqi sab band
alter table public.social_accounts enable row level security;

drop policy if exists "social_accounts owner all" on public.social_accounts;
create policy "social_accounts owner all" on public.social_accounts
  for all
  using      ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com');

-- NOTE: server routes (OAuth callback / posting runner) service role key
-- istemal karte hain jo RLS bypass karti hai — wo routes khud owner/session
-- ya cron-secret check karte hain. Client hamesha anon key + owner JWT se
-- ata hai, is liye policy zaroori hai.
--
-- NOTE (partners): partner ka connect bhi SERVER routes (service role) se
-- hota hai — signed link verify hone ke baad. Partner ke paas ChatsApp
-- login hi nahi hota, is liye partner ke liye koi alag client RLS policy
-- NAHI chahiye aur NAHI banayi gayi. Client-side sirf owner (upar wali
-- policy) social_accounts parh sakta hai.
