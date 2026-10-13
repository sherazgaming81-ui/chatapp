-- ============================================================
-- Chat app — Supabase schema
-- Isko Supabase dashboard → SQL Editor me paste karke Run karein
-- ============================================================

-- 1) Tables ----------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'User',
  email text not null default '',
  photo_url text not null default '',
  about text not null default 'Hey there! I am using Chat.',
  online boolean not null default false,
  last_seen bigint not null default 0
);

create table if not exists chats (
  id text primary key default gen_random_uuid()::text,
  type text not null default 'direct' check (type in ('direct', 'group')),
  name text not null default '',
  photo_url text not null default '',
  admin_ids text[] not null default '{}',
  last_message jsonb,
  updated_at bigint not null default 0,
  typing jsonb not null default '{}'::jsonb
);

create table if not exists chat_participants (
  chat_id text not null references chats(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  primary key (chat_id, user_id)
);

create table if not exists messages (
  id text primary key default gen_random_uuid()::text,
  chat_id text not null references chats(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  sender_name text not null default 'User',
  type text not null default 'text' check (type in ('text', 'image', 'audio')),
  text text not null default '',
  media_url text,
  file_name text,
  duration integer,
  reply_to jsonb,
  created_at bigint not null default 0,
  read_by text[] not null default '{}',
  deleted_for text[] not null default '{}'
);

create index if not exists idx_participants_user on chat_participants(user_id);
create index if not exists idx_messages_chat on messages(chat_id, created_at);

-- 2) Realtime on karein -----------------------------------------

alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table chats;
alter publication supabase_realtime add table chat_participants;
alter publication supabase_realtime add table messages;

-- 3) Storage bucket (photos / voice notes) ----------------------

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

-- 4) Row Level Security ------------------------------------------

alter table profiles enable row level security;
alter table chats enable row level security;
alter table chat_participants enable row level security;
alter table messages enable row level security;

-- profiles: sab login users dekh sakte hain, apni khud update kar sakte hain
drop policy if exists "profiles read" on profiles;
create policy "profiles read" on profiles for select to authenticated using (true);
drop policy if exists "profiles self update" on profiles;
create policy "profiles self update" on profiles for update to authenticated using (auth.uid() = id);
drop policy if exists "profiles self insert" on profiles;
create policy "profiles self insert" on profiles for insert to authenticated with check (auth.uid() = id);

-- chat_participants: apni membership dekh sakte hain
drop policy if exists "participants read" on chat_participants;
create policy "participants read" on chat_participants for select to authenticated using (true);
drop policy if exists "participants insert" on chat_participants;
create policy "participants insert" on chat_participants for insert to authenticated with check (true);

-- chats: sirf members parh / bana / update kar sakte hain
drop policy if exists "chats read" on chats;
create policy "chats read" on chats for select to authenticated using (
  exists (select 1 from chat_participants cp where cp.chat_id = chats.id and cp.user_id = auth.uid())
);
drop policy if exists "chats insert" on chats;
create policy "chats insert" on chats for insert to authenticated with check (true);
drop policy if exists "chats update" on chats;
create policy "chats update" on chats for update to authenticated using (
  exists (select 1 from chat_participants cp where cp.chat_id = chats.id and cp.user_id = auth.uid())
);

-- messages: sirf chat members
drop policy if exists "messages read" on messages;
create policy "messages read" on messages for select to authenticated using (
  exists (select 1 from chat_participants cp where cp.chat_id = messages.chat_id and cp.user_id = auth.uid())
);
drop policy if exists "messages insert" on messages;
create policy "messages insert" on messages for insert to authenticated with check (
  exists (select 1 from chat_participants cp where cp.chat_id = messages.chat_id and cp.user_id = auth.uid())
);
drop policy if exists "messages update" on messages;
create policy "messages update" on messages for update to authenticated using (
  exists (select 1 from chat_participants cp where cp.chat_id = messages.chat_id and cp.user_id = auth.uid())
);
drop policy if exists "messages delete" on messages;
create policy "messages delete" on messages for delete to authenticated using (
  exists (select 1 from chat_participants cp where cp.chat_id = messages.chat_id and cp.user_id = auth.uid())
);

-- storage: login users upload / dekh sakte hain
drop policy if exists "media read" on storage.objects;
create policy "media read" on storage.objects for select to authenticated using (bucket_id = 'chat-media');
drop policy if exists "media upload" on storage.objects;
create policy "media upload" on storage.objects for insert to authenticated with check (bucket_id = 'chat-media');
drop policy if exists "media update" on storage.objects;
create policy "media update" on storage.objects for update to authenticated using (bucket_id = 'chat-media');
drop policy if exists "media delete" on storage.objects;
create policy "media delete" on storage.objects for delete to authenticated using (bucket_id = 'chat-media');
