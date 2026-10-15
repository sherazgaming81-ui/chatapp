// ───────── ChatsApp seed — REAL backend edition ─────────
// NO fake users, NO fake messages. The store starts empty;
// src/data/supabase.ts loadRealData() populates it from Supabase.
// UI defaults (theme, onboarding, owner settings) live here.
import type { State } from "./types";
import { BUILTIN_PACKS } from "./assets";

const now = Date.now();
const dayKey = new Date().toDateString();

export const GROUP_ID = "madrasa";
export const SITE_URL = "https://chatapp0071.vercel.app";

export function createSeed(): State {
  return {
    v: 1,
    me: "",
    members: [],
    messages: [],
    chats: [],
    settings: {
      theme: "dark", compact: false, wallpaper: "noor", wallDim: 0.35, chatTheme: "zumurrud",
      nightSchedule: { on: false, from: "18:30", to: "05:45" }, disappearing: 0, mute: { on: false, until: null },
      privacy: { lastSeen: "everyone", photo: "everyone", about: "members", online: "everyone" },
      appLock: { on: false, pin: "" }, dnd: { on: false, from: "23:00", to: "06:00" }, quality: "auto",
      autoDl: { photos: { wifi: true, mobile: false }, videos: { wifi: true, mobile: false }, docs: { wifi: false, mobile: false } },
      haptics: true,
      dhikr: [{ id: "d1", time: "07:00", label: "Subah ke azkaar", on: true }, { id: "d2", time: "17:30", label: "Shaam ke azkaar", on: true }, { id: "d3", time: "22:00", label: "Sone se pehle dhikr", on: false }],
      ramadan: { mode: "auto", start: new Date(now - 20 * 864e5).toISOString().slice(0, 10) }, eid: false,
      nickname: "", notif: false, tones: {}, groupMute: false,
    },
    drafts: {},
    scheduled: [],
    lastRead: "",
    blocked: [],
    archived: false,
    stickerPacks: [{ id: "mine", name: "Meray Stickers", icon: BUILTIN_PACKS[0].icon, stickers: [], custom: true }],
    recentEmoji: ["😂", "🤲", "👍", "❤️", "🕌", "😎"],
    recentStickers: [],
    onboarding: {
      done: false, tourSeen: false, videoSeen: false, gestureDone: false, voiceTutorialDone: false, darkPrompted: false,
      checklist: { name: false, photo: false, notif: false, theme: false, about: false }, hints: {}, markers: {}, confettiDone: false, welcomed: false,
    },
    achievements: {},
    owner: {
      slow: { on: false, sec: 10 },
      autoMod: { on: true, words: ["gaali", "spam", "fraud", "badtameez"] },
      commands: [
        { id: "c1", name: "namaz", desc: "Aaj ke namaz ke auqaat", reply: "🕌 Aaj ({tarikh}) ke namaz ke waqt:\n{namaz}", uses: 0 },
        { id: "c2", name: "jummah", desc: "Jummah ki yaad dahani", reply: "Jummah Mubarak! Ghusl karein, itr lagayein aur Surah Kahf padhein. — {user}", uses: 0 },
      ],
      cmdLog: [],
      invites: [],
      audit: [],
      alerts: [],
      rules: "1. Sab se adab aur pyaar se baat karein.\n2. Gaali, ghaibat aur fuzool spam mana hai.\n3. Namaz ke waqt message kam karein.\n4. Faltu forward na bhejein — pehle tasdeeq karein.\n5. Kisi ki taswir bina ijazat share na karein.",
      branding: { name: "Madrasa Group", desc: "Madrasa ke dost, deen aur dunya ki baatein", accent: "#2ccf8a" },
      perms: {
        owner: { delete: true, ban: true, mute: true, pin: true, announce: true, invite: true, roles: true, slow: true },
        admin: { delete: true, ban: true, mute: true, pin: true, announce: true, invite: true, roles: false, slow: true },
        mod: { delete: true, ban: false, mute: true, pin: true, announce: false, invite: false, roles: false, slow: false },
        member: { delete: false, ban: false, mute: false, pin: false, announce: false, invite: false, roles: false, slow: false },
      },
      jobs: [], history: [],
      currentVersion: "3.0.0", available: null, rollout: null, lastChangelogSeen: "3.0.0", announceDraft: "",
    },
    rooms: [],
    tasbeeh: { total: 0, today: 0, day: dayKey },
    bookmarks: [],
    quranCache: {},
    storage: { media: 0, docs: 0, voice: 0, cache: 0 },
    backup: { last: null, size: 0 },
    devices: [],
    data: { wifi: [0, 0, 0, 0, 0, 0, 0], mobile: [0, 0, 0, 0, 0, 0, 0] },
    stats: { streak: 0, lastDay: dayKey },
    scores: { quiz: 0, ttt: 0, paheli: 0 },
    ui: { toasts: [], typing: [], azaan: null, achievement: null, offline: false, confetti: 0, remoteOverlay: null, changelog: false, syncing: false, slowUntil: 0, sttNonce: 0, activeChatId: null },
    nav: { tab: "chat", stack: [] },
  };
}

// kept for api.ts compat (voice message waveform peaks)
export function mkPeaks(seed: number, n = 44) {
  let s = seed * 9301 + 49297;
  return Array.from({ length: n }, (_, i) => {
    s = (s * 9301 + 49297) % 233280;
    return Math.round((0.2 + (s / 233280) * 0.8 * (0.6 + 0.4 * Math.sin(i / 5))) * 100) / 100;
  });
}
