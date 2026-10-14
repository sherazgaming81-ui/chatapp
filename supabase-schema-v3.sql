-- v3 Schema — ChatsApp. v2 schema ke BAAD run karein.
-- Nayi tables + columns. Sab IF NOT EXISTS / safe.

-- 0) Purani type CHECK constraint hatao (warna 'poll'/'contact'/'location'/'file' insert fail hoga)
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'messages_type_check' and conrelid = 'public.messages'::regclass
  ) then
    alter table messages drop constraint messages_type_check;
  end if;
end $$;

-- 1) Devices (device manager) ------------------------------------------
create table if not exists devices (
  id text primary key,
  user_id text not null,
  name text not null default 'Unknown device',
  last_active bigint not null default 0,
  created_at bigint not null default 0
);
create index if not exists idx_devices_user on devices(user_id);
alter table devices enable row level security;
drop policy if exists "devices own" on devices;
create policy "devices own" on devices for all to authenticated
  using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);

-- 2) Chat keys (E2E encryption — har chat ki AES-GCM key) --------------
create table if not exists chat_keys (
  chat_id text primary key,
  key_b64 text not null,
  created_at bigint not null default 0
);
alter table chat_keys enable row level security;
drop policy if exists "chatkeys members" on chat_keys;
create policy "chatkeys members" on chat_keys for all to authenticated
  using (
    exists (
      select 1 from chat_participants cp
      where cp.chat_id = chat_keys.chat_id and cp.user_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from chat_participants cp
      where cp.chat_id = chat_keys.chat_id and cp.user_id = auth.uid()::text
    )
  );

-- 3) Messages: WhatsApp-style delete + forward count + delivery --------
alter table messages add column if not exists deleted_for text[] not null default '{}';
alter table messages add column if not exists deleted_everyone boolean not null default false;
alter table messages add column if not exists forward_count integer not null default 0;
alter table messages add column if not exists delivered_at bigint;

-- 4) Profiles: forward tag chhupane ki setting --------------------------
alter table profiles add column if not exists hide_forward_tag boolean not null default false;

-- 5) Auto-archive flag (per-user, per-chat) ------------------------------
alter table user_chat_settings add column if not exists archived boolean not null default false;

-- 6) Realtime publication ------------------------------------------------
-- messages/profiles pehle se published hain; devices realtime me nahi chahiye.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;
