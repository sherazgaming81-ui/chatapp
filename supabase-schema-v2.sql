-- v2 Schema — ChatsApp. v1 schema ke BAAD run karein.
-- Nayi tables + columns. Sab IF NOT EXISTS / safe.

-- 1) Drafts -----------------------------------------------------------
create table if not exists message_drafts (
  user_id text not null,
  chat_id text not null,
  text text not null default '',
  updated_at bigint not null default 0,
  primary key (user_id, chat_id)
);
alter table message_drafts enable row level security;
drop policy if exists "drafts own" on message_drafts;
create policy "drafts own" on message_drafts for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- 2) Blocked users ----------------------------------------------------
create table if not exists blocked_users (
  user_id text not null,
  blocked_id text not null,
  blocked_at bigint not null default 0,
  primary key (user_id, blocked_id)
);
alter table blocked_users enable row level security;
drop policy if exists "blocks own" on blocked_users;
create policy "blocks own" on blocked_users for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- 3) Invite links -----------------------------------------------------
create table if not exists invite_links (
  code text primary key,
  chat_id text not null,
  created_by text not null,
  created_at bigint not null default 0,
  expires_at bigint,
  max_uses int,
  uses int not null default 0
);
alter table invite_links enable row level security;
drop policy if exists "invites members" on invite_links;
create policy "invites members" on invite_links for all to authenticated
  using (true) with check (true);

-- 4) Join requests ----------------------------------------------------
create table if not exists join_requests (
  id text primary key,
  chat_id text not null,
  user_id text not null,
  status text not null default 'pending',
  created_at bigint not null default 0
);
alter table join_requests enable row level security;
drop policy if exists "joinreq all" on join_requests;
create policy "joinreq all" on join_requests for all to authenticated
  using (true) with check (true);

-- 5) Locked chats (per-user) ------------------------------------------
create table if not exists locked_chats (
  user_id text not null,
  chat_id text not null,
  locked_at bigint not null default 0,
  primary key (user_id, chat_id)
);
alter table locked_chats enable row level security;
drop policy if exists "locked own" on locked_chats;
create policy "locked own" on locked_chats for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- 6) Per-chat notification tone ---------------------------------------
alter table user_chat_settings add column if not exists tone text not null default 'default';

-- 7) Poll deadline ----------------------------------------------------
alter table messages add column if not exists poll_deadline bigint;

-- 8) Self-destruct ----------------------------------------------------
alter table messages add column if not exists self_destruct_at bigint;

-- 9) Message type extensions (contact, live location) -----------------
-- type column already text; 'contact' aur 'location' naye types honge.
-- contact_data JSON, location fields:
alter table messages add column if not exists contact_data jsonb;
alter table messages add column if not exists lat double precision;
alter table messages add column if not exists lng double precision;
alter table messages add column if not exists location_expires_at bigint;

-- 10) Chat backup metadata --------------------------------------------
create table if not exists chat_backups (
  id text primary key,
  user_id text not null,
  created_at bigint not null default 0,
  message_count int not null default 0
);
alter table chat_backups enable row level security;
drop policy if exists "backups own" on chat_backups;
create policy "backups own" on chat_backups for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- 11) Realtime publication --------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'message_drafts'
  ) then
    alter publication supabase_realtime add table message_drafts;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'join_requests'
  ) then
    alter publication supabase_realtime add table join_requests;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'invite_links'
  ) then
    alter publication supabase_realtime add table invite_links;
  end if;
end $$;
