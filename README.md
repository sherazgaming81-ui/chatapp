# ChatsApp — Frontend (Next.js + Tailwind)

Madrasa dostoun ke liye private group chat. **UI poori Roman Urdu / Hinglish me hai.** Ye sirf FRONTEND hai — saara data mock hai, lekin data layer UI se bilkul alag rakha gaya hai taake backend developer Supabase calls bina UI chhue laga sake.

## Chalane ka tareeqa
```bash
npm install
npm run dev      # ya: npm run build && npm start
```
App client-side render hoti hai (`src/components/ClientRoot.tsx`). Pehle 3-second ki branded loading animation chalti hai (`Loader.tsx`), phir first-time users ko onboarding milti hai.

## Project structure
```
src/
  data/                     ← ★ DATA LAYER (backend developer yahan kaam kare)
    types.ts                  Saare data contracts (Member, Message, Poll, State …) ≈ DB tables
    api.ts                    ★ Har read/write function: sendMessage(), getMessages(), getOnlineUsers(),
                              banMember()/banUser(), muteMember(), warnMember(), pushVersion(),
                              reloadUsers(), advanceRollout(), createPoll(), votePoll(), scheduleMessage() …
    store.ts                  Mock store (in-memory + localStorage). useStore(selector) hook
    engine.ts                 Mock realtime: presence, typing, incoming messages, ticks,
                              schedulers, azaan/dhikr reminders, update detector
                              → Supabase Realtime (presence + postgres_changes) se badlein
    seed.ts                   Mock members/messages
    assets.ts                 Wallpapers (SVG), stickers, GIFs (animated SVG), emoji, themes, badges
    deen.ts                   Namaz times calc, qibla, hijri, moon, Quran (offline short suratein), duas, quiz
  components/               ← UI (data layer ko sirf `@/data/api` + `useStore` se chhoota hai)
    Shell.tsx                 Nav (mobile bottom bar / desktop rail), pages stack, toasts, azaan alert,
                              lock screen, ban screen, remote reload overlay, changelog
    pages.tsx                 Page registry (route-name → component)
    chat/                     Chat, Message (bubbles, swipe, long-press, hover menu), Composer,
                              Pickers (emoji/GIF/sticker), Attach (poll/location/contact), Media (camera/editor/viewer), Voice
    deen/  group/  settings/  profile/  owner/  extras/  onboarding/
public/  sw.js (tiny service worker), manifest.webmanifest, icon.svg
```

## Backend swap guide
1. `src/data/api.ts` ke har function ki **signature wahi rakhein**, sirf body ko Supabase call se badlein
   (e.g. `sendMessage` → `supabase.from('messages').insert(...)`).
2. `src/data/store.ts` ko Supabase subscriptions se feed karein (ya React-Query/zustand ke saath replace karein) —
   UI sirf `useStore(selector)` padhta hai.
3. `src/data/engine.ts` ko Supabase Realtime (presence, typing broadcast, postgres_changes) se badlein.
4. Remote control (Owner): `reloadUsers`, `pushVersion`, `advanceRollout` ek `remote_commands` table / broadcast channel par likhein; har client
   `remoteChannel()` ki jagah us channel ko sunta hai aur `wipeDeviceAndReload()` chalata hai (service worker + localStorage + Cache Storage + IndexedDB saaf).
   Mute / ban / warn bhi isi tarah realtime row-update se **bina reload** lagu hote hain (UI already store se reactive hai).
5. Auth: Google login ke baad member row banayein (`addMember` / `welcomeMember`).

## Platform-specific behaviour
- **Message menu**: mobile = long-press bottom sheet (WhatsApp); desktop = hover toolbar + ⋯ menu (Discord) — `chat/Message.tsx`.
- **Attachment menu**: mobile = bottom sheet; desktop = popover near button — `chat/Attach.tsx`.
- **Camera**: in-app camera (`getUserMedia`) with filters; fallback = file picker.
- **App lock**: touch devices = fingerprint (simulated) + PIN; desktop = PIN.

## Demo / testing
`Mera → Demo controls`: role badlo (Owner/Admin/Mod/Member), khud ko mute/ban/warn karo, offline mode, azaan alert, naya version simulate, confetti.
`Mera → Help → App tour / Explainer video` se onboarding ke hisse dobara dekhe ja sakte hain.
Owner dashboard `Owner` tab me hai (Owner/Admin ke liye): Home, Elaan, Moderation, Remote, Commands, Roles/Invite, Logs.

## Notes
- Quran: Al-Fatiha, Asr, Kawthar, Kafirun, Nasr, Ikhlas, Falaq, Nas offline bundled; baaqi suratein `api.alquran.cloud` se load hoti hain (internet par).
- GIFs/stickers/wallpapers sab generated SVG hain — koi external request nahi.
- Masjid map aur link previews demo data hain; asli provider ke liye `getLinkPreview()` aur `Masjids` component swap karein.
