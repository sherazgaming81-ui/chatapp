-- ============================================================
-- Chat app — v1 migration
-- Supabase dashboard → SQL Editor me paste karke Run karein
-- (pehle supabase-schema.sql run ho chuka hona chahiye)
-- ============================================================

-- 1) messages: naye columns --------------------------------------
alter table messages add column if not exists edited_at bigint;
alter table messages add column if not exists reactions jsonb not null default '{}'::jsonb;
alter table messages add column if not exists is_pinned boolean not null default false;
alter table messages add column if not exists poll jsonb;
alter table messages add column if not exists forwarded boolean not null default false;
alter table messages add column if not exists read_at jsonb not null default '{}'::jsonb;
alter table messages add column if not exists file_size bigint;

create index if not exists idx_messages_pinned on messages(chat_id) where is_pinned = true;

-- 2) chats: naye columns ------------------------------------------
alter table chats add column if not exists description text not null default '';
alter table chats add column if not exists slow_mode_sec integer not null default 0;
alter table chats add column if not exists is_main_group boolean not null default false;

-- 3) profiles: naye columns ----------------------------------------
alter table profiles add column if not exists cover_url text not null default '';
alter table profiles add column if not exists privacy jsonb not null default '{"lastSeen":"everyone","photo":"everyone","online":"everyone"}'::jsonb;
alter table profiles add column if not exists pinned_chats text[] not null default '{}';
alter table profiles add column if not exists disappearing_after integer not null default 0;

-- 4) starred messages (per-user) -----------------------------------
create table if not exists user_stars (
  user_id uuid not null references profiles(id) on delete cascade,
  message_id text not null references messages(id) on delete cascade,
  created_at bigint not null default 0,
  primary key (user_id, message_id)
);

-- 5) scheduled messages --------------------------------------------
create table if not exists scheduled_messages (
  id text primary key default gen_random_uuid()::text,
  chat_id text not null references chats(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  input jsonb not null,
  send_at bigint not null,
  created_at bigint not null default 0
);
create index if not exists idx_scheduled_due on scheduled_messages(send_at);

-- 6) per-chat notification settings ---------------------------------
create table if not exists user_chat_settings (
  chat_id text not null references chats(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  muted boolean not null default false,
  sound text,
  primary key (chat_id, user_id)
);

-- 7) push subscriptions ----------------------------------------------
create table if not exists push_subscriptions (
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,
  keys jsonb not null,
  created_at bigint not null default 0,
  primary key (user_id, endpoint)
);

-- 8) realtime ---------------------------------------------------------
alter publication supabase_realtime add table user_stars;
alter publication supabase_realtime add table scheduled_messages;
alter publication supabase_realtime add table user_chat_settings;

-- 9) RLS ---------------------------------------------------------------
alter table user_stars enable row level security;
alter table scheduled_messages enable row level security;
alter table user_chat_settings enable row level security;
alter table push_subscriptions enable row level security;

drop policy if exists "stars own" on user_stars;
create policy "stars own" on user_stars for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "scheduled own" on scheduled_messages;
create policy "scheduled own" on scheduled_messages for all to authenticated
  using (auth.uid() = sender_id) with check (auth.uid() = sender_id);

drop policy if exists "chatsettings own" on user_chat_settings;
create policy "chatsettings own" on user_chat_settings for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "pushsubs own" on push_subscriptions;
create policy "pushsubs own" on push_subscriptions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- push bhejne ke liye: jo log mere saath kisi chat me hain, unki subscriptions parh sakta hoon
drop policy if exists "pushsubs members read" on push_subscriptions;
create policy "pushsubs members read" on push_subscriptions for select to authenticated using (
  exists (
    select 1 from chat_participants cp1
    join chat_participants cp2 on cp1.chat_id = cp2.chat_id
    where cp1.user_id = auth.uid() and cp2.user_id = push_subscriptions.user_id
  )
);
