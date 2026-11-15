-- ═══════════════════════════════════════════════════════════════════════════
-- ChatsApp Business OS — Phase 2: CRM Completion
-- ═══════════════════════════════════════════════════════════════════════════
-- Ye file sirf BANAYI gayi hai — abhi RUN nahi hui.
-- Chalane ka tareeqa: Supabase Dashboard → SQL Editor → ye poori file paste
-- karke Run. (Parent pehle ye chalaye ga, phir code push hoga.)
--
-- REQUIREMENT: supabase/crm-upgrade.sql pehle se lagi honi chahiye
-- (crm_contacts table mojood ho). Ye file usi par Phase 2 ke columns aur
-- activities table add karti hai — sab IF NOT EXISTS / idempotent hai,
-- dobara chalane par koi nuqsan nahi.
--
-- Kya hota hai:
--   1) crm_contacts par naye columns: deal_value, priority (low/medium/high),
--      tags (text[]), follow_up_at, lead_score, source (pehle se hai — safe)
--   2) Nayi table crm_activities — contact ki activity timeline
--      (note / stage / outreach / system), owner-only RLS, realtime on
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) crm_contacts — Phase 2 columns
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.crm_contacts
  add column if not exists deal_value   numeric(12,2) not null default 0;

alter table public.crm_contacts
  add column if not exists priority     text not null default 'medium';

-- priority ki values sirf low / medium / high (check constraint, idempotent)
do $$
begin
  alter table public.crm_contacts
    add constraint crm_contacts_priority_check
    check (priority in ('low','medium','high'));
exception when duplicate_object then null;
end $$;

alter table public.crm_contacts
  add column if not exists tags         text[] not null default '{}';

alter table public.crm_contacts
  add column if not exists follow_up_at timestamptz;

alter table public.crm_contacts
  add column if not exists lead_score   int not null default 0;

-- source column crm-upgrade.sql me pehle se hai — ye sirf safety ke liye hai
alter table public.crm_contacts
  add column if not exists source       text not null default '';

-- Follow-ups Due strip ke liye index
create index if not exists crm_contacts_followup_idx
  on public.crm_contacts (follow_up_at);

create index if not exists crm_contacts_score_idx
  on public.crm_contacts (lead_score desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) crm_activities — activity timeline (notes, stage changes, outreach)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.crm_activities (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  kind       text not null check (kind in ('note','stage','outreach','system')),
  body       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists crm_activities_contact_idx
  on public.crm_activities (contact_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — sirf OWNER (JWT email = sherazgaming81@gmail.com), baqi sab band
-- (crm-upgrade.sql wala hi pattern)
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.crm_activities enable row level security;

drop policy if exists "crm_activities owner all" on public.crm_activities;
create policy "crm_activities owner all" on public.crm_activities
  for all
  using      ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com');

-- Realtime: HQ page ko activities ke live updates milein.
-- (publication me pehle se ho to duplicate_object exception ignore ho jata hai)
do $$
begin
  begin
    alter publication supabase_realtime add table public.crm_activities;
  exception when duplicate_object then null;
  end;
end $$;

-- Ho gaya. App (lib/crm.ts) activities table ke na hone par bhi crash nahi
-- karti — timeline khaali rehti hai, baqi CRM waisa hi chalta hai.
