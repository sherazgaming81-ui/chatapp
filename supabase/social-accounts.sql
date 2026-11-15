-- ═══════════════════════════════════════════════════════════════════════════
-- ChatsApp — Social Accounts (Connect Threads) table
-- ═══════════════════════════════════════════════════════════════════════════
-- Ye file sirf BANAYI gayi hai — main agent baad me chalaye ga.
-- Chalane ka tareeqa: Supabase Dashboard → SQL Editor → ye poori file paste
-- karke Run. (crm-upgrade.sql ke BAAD chalana — wahi RLS pattern hai.)
--
-- Kya banta hai:
--   public.social_accounts — owner ke connected social accounts.
--   Threads OAuth se mila long-lived access token yahan store hota hai.
--   Posting runner (server, service role) isi token se Threads API par
--   queue ki posts publish karta hai — bina approval, kyunke publish ki
--   permission banda connect karte waqt khud deta hai.
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
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (platform, threads_user_id)
);

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
