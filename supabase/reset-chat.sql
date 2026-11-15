-- ═══════════════════════════════════════════════════════════════════════════
-- ChatsApp — SAARI CHAT RESET (owner order, 2026-11-15)
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ KHABARDAR: ye file chalane se poori chat history KHATAM ho jayegi —
-- saare messages, saare DM/group chats, un ke settings — sab saaf.
-- Wapas nahi aayega. Chalane se pehle soch lo, phir chalao.
--
-- Ye file sirf BANAYI gayi hai — abhi RUN nahi hui. Round 2 me owner ke
-- kehne par (valid token ke sath) chalegi.
--
-- Kya DELETE/TRUNCATE hoga (chat data):
--   messages           — saare messages (group + DM + purani status rows)
--   chat_participants  — kis chat me kaun hai (main group dobara seed hoga)
--   chats              — DM chats saare; MAIN GROUP ki row BHI delete hogi
--                        lekin neeche usi ko dobara bana diya gaya hai
--                        (app load() par is_main_group=true wali row dhundti
--                        hai — wo na mili to app khud bhi bana leti hai,
--                        phir bhi seed rakhna mehfooz hai)
--   group_settings     — pinned messages, rules, descriptions, themes
--   mutes / bans / warns — moderation records (fresh start)
--   user_chat_settings — per-user chat settings (agar table mojood ho)
--
-- Kya NAHI chhuega (bacha rahega):
--   profiles           — saare members ke accounts/profiles mehfooz
--   user_roles         — owner/admin/mod roles mehfooz (warna owner lock-out!)
--   auth.users         — login accounts mehfooz (Supabase Auth, haath nahi)
--   crm_* tables       — naya business data is reset se alag hai, mehfooz
--
-- Table ke naam src/lib/db.ts + src/lib/groups.ts + src/lib/owner.ts me
-- istemal hone wali asal tables se liye gaye hain.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- Pehle woh tables jo messages/chats par depend karti hain
truncate table public.messages restart identity cascade;
truncate table public.chat_participants restart identity cascade;
truncate table public.group_settings restart identity cascade;
truncate table public.mutes restart identity cascade;
truncate table public.bans restart identity cascade;
truncate table public.warns restart identity cascade;

-- per-user chat settings — table ho tab hi saaf karo (na ho to error na aye)
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'user_chat_settings') then
    execute 'truncate table public.user_chat_settings restart identity cascade';
  end if;
end $$;

-- Ab saare chats (DMs + groups) — main group neeche dobara seed hoga
truncate table public.chats restart identity cascade;

-- ── Main group dobara seed: "Madrasa Group" ────────────────────────────────
-- App (src/lib/db.ts load()) chats me is_main_group=true wali row ko main
-- group manti hai. Owner ka profile pehle se profiles me hai (reset se
-- mehfooz), is liye participants dobara jorne ki zaroorat nahi — members
-- pehli login/load par app khud main group join karwa leti hai
-- (db.ts: chat_participants insert on load).
insert into public.chats (type, name, is_main_group)
values ('group', 'Madrasa Group', true);

commit;

-- Ho gaya: app ab bilkul fresh khulegi — khaali Madrasa Group, koi purana
-- message nahi. Profiles aur roles waisay ke waisay.
