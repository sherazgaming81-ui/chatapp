# ChatsApp Discord — MASTER BUILD PLAN (v2, 161 features)

Source: `~/workspace/CHATSAPP_FRONTEND_MASTER_PROMPT.md` (v2)
Design: Discord light app theme (user-approved, "i like it") — NOT the prompt's dark/green philosophy.
Backend: Real Supabase (not mocks). DMs enabled (user uses them).
Base: `~/workspace/discord-frontend/` on `discord` branch. Preview: https://chat-git-discord-sherazgaming81-2859s-projects.vercel.app/
Production (v8) untouched on chatsapp0/chatapp0071 until user approves.

## Already built ✅
Auth (Google), loading (3s), server rail, sidebar, cozy messages, composer (text/image/voice),
reply, reactions, delete, pins + 📌 bar, typing, presence, member list, profile modal,
owner panel (mute/ban/warn), announcements, commands (/), profile settings, Deen page
(namaz+countdown, tasbeeh, qibla, duas, hijri), toasts, DMs, realtime.

## Phase 1 — Core Chat Polish (DOING NOW)
- A5 in-chat search (highlight + up/down nav)
- A8 sticky date headers
- A9 unread divider pill ("X unread messages", tap → jump)
- A11 animated ticks (sent → delivered → read, scale/pop)
- A17 seen-by list (message info panel)
- A19 message drafts (per chat, localStorage)
- A3 swipe-to-reply (mobile touch) + B17 reply preview bar
- B16 edit message (15 min window, "edited" label)
- B15 delete animation (shrink + fade)

## Phase 2 — Media & Expression
- A7 full-screen media viewer (zoom, swipe between media)
- B8 custom emoji picker (categories, recent, search)
- B13 starred messages + starred list page
- B18 link preview cards (OpenGraph via microrink/jina)
- B5 polls (create, vote, animated results, change vote)
- B6 location share card, B7 contact share card

## Phase 3 — Deen Complete
- C7 Quran reader (surah list → Arabic + Urdu, bookmarks in localStorage)
- C10 zakat calculator (cash/gold/silver/debts)
- C2/C3 Eid/Ramadan celebration effects + Ramadan night theme
- C8 azaan notification UI (at prayer time, dismiss/snooze)
- C14 moon phase widget

## Phase 4 — Group & Discovery
- D1 group info page (photo, desc, counts, media preview)
- D5 group media gallery (photos/videos/docs grid + filters)
- D11 group insights (messages/day chart, active hours, top contributors) — REAL data only
- D12 group rules card (owner-editable)
- I15 global search (messages + members)
- I13 file manager (shared files by type)

## Phase 5 — Settings & Privacy
- E1 privacy dashboard (last seen / photo / about / online audience)
- E6 app lock (PIN on web, beautiful lock UI)
- A18 compact/comfortable mode toggle
- A13 wallpaper gallery (6+ designed + custom upload)
- E8 chat backup UI (export JSON download)

## Phase 6 — Onboarding
- F1 welcome splash, F5 setup checklist (name → photo → notifications)
- F6 achievement badges (Minecraft-style popup + gallery)
- F9 auto welcome message on member join
- F12 profile setup wizard (first login)

## Phase 7 — Games & Fun
- I1 deen quiz (in-chat, scoreboard, timer)
- I2 tic-tac-toe (2-player in chat)
- I3 daily paheli (riddle, winner)
- B10 stickers (1 Hinglish pack, working)

## Phase 8 — Owner Superpowers
- H2 analytics graphs (real data), H3 broadcast composer + H4 scheduled announcements
- H5 pin manager, H9 slow mode, H14 role manager, H15 auto-mod word list, H16 audit log
- G-series: remote reload/push completion (G2 wipe, G5 targeting, G7 tracker, G10 changelog, G14 history)

## Explicitly SKIPPED (prompt §8)
Font size controls, translator, ghost mode, voice changer, fancy text formatting,
scheduled version pushes, rollback button, force-update, chat export, etc.

## Rules for every phase
- Hinglish UI only. Light Discord theme (Blurple #5865f2, glass, 8px radius).
- Real Supabase data — zero fake numbers/users/messages.
- `npm run build` + `npx tsc --noEmit` clean before handoff.
- Mobile-first; test both layouts mentally.
- Commit per phase on `discord` branch. No deploy without parent review.
