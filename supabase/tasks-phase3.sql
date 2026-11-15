-- ═══════════════════════════════════════════════════════════════════════════
-- ChatsApp Business OS — Phase 3: Tasks + Calendar
-- ═══════════════════════════════════════════════════════════════════════════
-- Ye file sirf BANAYI gayi hai — abhi RUN nahi hui.
-- Chalane ka tareeqa: Supabase Dashboard → SQL Editor → ye poori file paste
-- karke Run. (Parent pehle ye chalaye ga, phir code push hoga.)
--
-- REQUIREMENT: supabase/crm-upgrade.sql pehle se lagi honi chahiye
-- (crm_contacts table mojood ho — crm_tasks.contact_id usi ko reference
-- karta hai). Ye file idempotent hai — dobara chalane par koi nuqsan nahi.
--
-- Kya hota hai:
--   Nayi table crm_tasks — HQ ke Tasks tab + Calendar ke liye.
--   Har task aik CRM contact se link ho sakta hai (optional); contact
--   delete ho to task rehta hai, sirf link null ho jata hai (SET NULL).
--   Owner-only RLS (crm tables wala hi JWT email pattern) + realtime on.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.crm_tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  notes        text not null default '',
  contact_id   uuid references public.crm_contacts(id) on delete set null,
  due_at       timestamptz,
  priority     text not null default 'medium'
               check (priority in ('low','medium','high')),
  status       text not null default 'open'
               check (status in ('open','done')),
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- Tasks list (status + due order) aur contact drawer ke liye indexes
create index if not exists crm_tasks_status_due_idx
  on public.crm_tasks (status, due_at);

create index if not exists crm_tasks_contact_idx
  on public.crm_tasks (contact_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS — sirf OWNER (JWT email = sherazgaming81@gmail.com), baqi sab band
-- (crm-upgrade.sql / crm-phase2.sql wala hi pattern)
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.crm_tasks enable row level security;

drop policy if exists "crm_tasks owner all" on public.crm_tasks;
create policy "crm_tasks owner all" on public.crm_tasks
  for all
  using      ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'sherazgaming81@gmail.com');

-- Realtime: HQ page ko tasks ke live updates milein.
-- (publication me pehle se ho to duplicate_object exception ignore ho jata hai)
do $$
begin
  begin
    alter publication supabase_realtime add table public.crm_tasks;
  exception when duplicate_object then null;
  end;
end $$;

-- Ho gaya. App (lib/tasks.ts) table ke na hone par bhi crash nahi karti —
-- Tasks tab khaali rehta hai aur ek note ajata hai ke ye SQL baqi hai.
