-- ═══════════════════════════════════════════════════════════════════════════
-- ChatsApp FULL UPGRADE — CRM / Business HQ tables (Round 1)
-- ═══════════════════════════════════════════════════════════════════════════
-- Ye file sirf BANAYI gayi hai — abhi RUN nahi hui.
-- Chalane ka tareeqa: Supabase Dashboard → SQL Editor → ye poori file paste
-- karke Run. (Valid Supabase access token milne par Round 2 me lagegi.)
--
-- Kya banta hai:
--   1) crm_contacts       — clients / partners / affiliates / leads, DEDUPE LOCK ke sath
--   2) crm_outreach_log   — pehli dafa bheja gaya email/DM/WhatsApp ka record
--                           (UNIQUE(contact_id, channel) = dobara bhejna impossible)
--   3) crm_posts          — social posts ki queue (threads / instagram / facebook)
--                           NOTE: posts owner ke order par BINA approval jayengi
--   4) crm_daily_reports  — roz ki report (leads, emails, DMs, replies, stage moves)
--
-- DEDUPE LOCK (sab se aham): instagram_username aur email par UNIQUE index hai
-- (lowercase par) — aik username/email dusri dafa database me ja hi nahi sakta,
-- chahe app se aye ya haath se. Repeat kaam khatam.
--
-- RLS ASSUMPTION: mojooda schema ka pattern ye hai ke owner ki pehchan JWT ke
-- email claim se hoti hai (owner = sherazgaming81@gmail.com). Isi pattern par
-- in chaaron tables par sirf-owner policies lagayi hain — members (madrasa
-- dost) in tables ko na dekh sakte hain, na likh sakte hain.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── chhota helper: updated_at khud update ho ────────────────────────────────
create or replace function public.crm_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) crm_contacts — CRM ka dil
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.crm_contacts (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null default 'lead'
                       check (kind in ('client','partner','affiliate','lead')),
  name               text not null default '',
  instagram_username text,                       -- @ ke baghair store karo
  email              text,
  whatsapp           text,
  stage              text not null default 'new'
                       check (stage in ('new','contacted','replied','meeting','client','done','lost')),
  notes              text not null default '',
  source             text not null default '',   -- kahan se aya: instagram / website / referral / manual ...
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  last_contacted_at  timestamptz
);

-- DEDUPE LOCK #1: aik Instagram username sirf aik dafa (chhota/bara letter aik hi)
create unique index if not exists crm_contacts_ig_unique
  on public.crm_contacts (lower(instagram_username))
  where instagram_username is not null and btrim(instagram_username) <> '';

-- DEDUPE LOCK #2: aik email sirf aik dafa
create unique index if not exists crm_contacts_email_unique
  on public.crm_contacts (lower(email))
  where email is not null and btrim(email) <> '';

create index if not exists crm_contacts_stage_idx on public.crm_contacts (stage);
create index if not exists crm_contacts_kind_idx  on public.crm_contacts (kind);

drop trigger if exists crm_contacts_touch on public.crm_contacts;
create trigger crm_contacts_touch
  before update on public.crm_contacts
  for each row execute function public.crm_touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) crm_outreach_log — first-touch record (repeat bhejna band)
-- ═══════════════════════════════════════════════════════════════════════════
-- UNIQUE(contact_id, channel): aik bande ko aik channel par pehla message
-- sirf Aik dafa log ho sakta hai. App pehle canSendTo() se check karti hai,
-- aur ye constraint peeche se pakki guarantee hai.
create table if not exists public.crm_outreach_log (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  channel    text not null check (channel in ('email','dm','whatsapp')),
  template   text not null default '',           -- kaunsa template / short label
  body       text not null default '',           -- asal bheja gaya message
  sent_at    timestamptz not null default now(),
  unique (contact_id, channel)
);

create index if not exists crm_outreach_contact_idx on public.crm_outreach_log (contact_id);
create index if not exists crm_outreach_sent_idx    on public.crm_outreach_log (sent_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) crm_posts — social posting queue (bina approval — owner order)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.crm_posts (
  id           uuid primary key default gen_random_uuid(),
  platform     text not null check (platform in ('threads','instagram','facebook')),
  body         text not null default '',
  scheduled_at timestamptz not null default now(),
  status       text not null default 'queued'
                 check (status in ('queued','posted','failed')),
  posted_at    timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists crm_posts_status_idx on public.crm_posts (status, scheduled_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) crm_daily_reports — roz ki report (aik din = aik row)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.crm_daily_reports (
  day          date primary key,
  leads_new    integer not null default 0,
  emails_sent  integer not null default 0,
  dms_queued   integer not null default 0,
  replies      integer not null default 0,
  stage_moves  integer not null default 0,
  summary      text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists crm_daily_reports_touch on public.crm_daily_reports;
create trigger crm_daily_reports_touch
  before update on public.crm_daily_reports
  for each row execute function public.crm_touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — sirf OWNER (JWT email = sherazgaming81@gmail.com), baqi sab band
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.crm_contacts      enable row level security;
alter table public.crm_outreach_log  enable row level security;
alter table public.crm_posts         enable row level security;
alter table public.crm_daily_reports enable row level security;

-- crm_contacts
drop policy if exists "crm_contacts owner all" on public.crm_contacts;
create policy "crm_contacts owner all" on public.crm_contacts
  for all
  using      ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com');

-- crm_outreach_log
drop policy if exists "crm_outreach owner all" on public.crm_outreach_log;
create policy "crm_outreach owner all" on public.crm_outreach_log
  for all
  using      ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com');

-- crm_posts
drop policy if exists "crm_posts owner all" on public.crm_posts;
create policy "crm_posts owner all" on public.crm_posts
  for all
  using      ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com');

-- crm_daily_reports
drop policy if exists "crm_reports owner all" on public.crm_daily_reports;
create policy "crm_reports owner all" on public.crm_daily_reports
  for all
  using      ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com');

-- Realtime (Upgrade 10): HQ page ko live updates milein.
-- NOTE: agar publication pehle se in tables ko cover karti ho to ye line
-- error de sakti hai — us surat me is block ko skip kar dein, app refresh
-- par bhi chalegi.
do $$
begin
  begin
    alter publication supabase_realtime add table public.crm_contacts;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.crm_outreach_log;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.crm_posts;
  exception when duplicate_object then null;
  end;
end $$;

-- Ho gaya. App (lib/crm.ts) in tables ke na hone par bhi crash nahi karti —
-- khaali list dikhati hai, taake migration se pehle build safe rahe.
