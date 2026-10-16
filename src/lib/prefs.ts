"use client";
// Phase 5 — Settings & Privacy: prefs layer (localStorage-first, Supabase best-effort).
import { useSyncExternalStore } from "react";
import type { Member, PrivacyAudience, PrivacySettings } from "./types";
import { DEFAULT_PRIVACY } from "./types";

const LS = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

/* ───────── reactive prefs snapshot (compact + wallpaper + dark update live) ───────── */
interface PrefsSnap { compact: boolean; wallpaper: string; wallpaperCustom: string | null; dark: boolean; sound: boolean; wallpaperBlur: number; }
let snap: PrefsSnap = { compact: false, wallpaper: "default", wallpaperCustom: null, dark: false, sound: true, wallpaperBlur: 0 };
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => { try { l(); } catch { /* ignore */ } }); }
/* 4 — dark mode: <html> par .dark class lagao */
function applyDark(d: boolean) {
  try {
    if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", d);
  } catch { /* ignore */ }
}
function readSnap(): PrefsSnap {
  const blurRaw = parseInt(LS.get("chatsapp:wallpaperblur") || "0", 10);
  return {
    compact: LS.get("chatsapp:compact") === "1",
    wallpaper: LS.get("chatsapp:wallpaper") || "default",
    wallpaperCustom: LS.get("chatsapp:wallpaper:custom"),
    dark: LS.get("chatsapp:dark") === "1",
    sound: LS.get("chatsapp:sound") !== "0",
    wallpaperBlur: isNaN(blurRaw) ? 0 : Math.min(20, Math.max(0, blurRaw)),
  };
}
function refresh() { snap = readSnap(); applyDark(snap.dark); emit(); }
if (typeof window !== "undefined") { snap = readSnap(); applyDark(snap.dark); }
// SSR/prerender ke liye server snapshot (client hydration par real snap ayega)
const serverSnap: PrefsSnap = { ...snap };
export function usePrefs(): PrefsSnap {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => snap,
    () => serverSnap,
  );
}

/* ───────── E1 — privacy ───────── */
export function getPrivacy(uid: string): PrivacySettings {
  try {
    const raw = LS.get(`chatsapp:privacy:${uid}`);
    if (raw) return { ...DEFAULT_PRIVACY, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_PRIVACY };
}
export function setPrivacy(uid: string, patch: Partial<PrivacySettings>): PrivacySettings {
  const next = { ...getPrivacy(uid), ...patch };
  LS.set(`chatsapp:privacy:${uid}`, JSON.stringify(next));
  return next;
}
/** Doosre user ki setting respect karo. "contacts" = is app me sab members hi contacts hain. */
export function canSee(viewerId: string | null | undefined, target: Member | undefined, field: keyof PrivacySettings): boolean {
  if (!target) return true;
  if (viewerId && viewerId === target.id) return true; // khud ko sab dikhe
  const aud: PrivacyAudience = target.privacy?.[field] || "everyone";
  if (aud === "everyone") return true;
  if (aud === "contacts") return true; // single madrasa group — sab contacts
  return false; // nobody
}
export const visibleOnline = (viewerId: string | undefined, m: Member) => canSee(viewerId, m, "online") ? m.online : false;
export const visibleAvatar = (viewerId: string | undefined, m: Member) => canSee(viewerId, m, "photo") ? m.avatar : undefined;
export const visibleAbout = (viewerId: string | undefined, m: Member) => canSee(viewerId, m, "about") ? m.about : "";
export const visibleLastSeen = (viewerId: string | undefined, m: Member) => canSee(viewerId, m, "lastSeen") ? m.lastSeen : 0;

/* ───────── A18 — compact mode ───────── */
export const getCompact = () => LS.get("chatsapp:compact") === "1";
export function setCompact(v: boolean) {
  LS.set("chatsapp:compact", v ? "1" : "0");
  refresh();
}

/* ───────── 4 — dark mode toggle 🌙 ───────── */
export const getDark = () => LS.get("chatsapp:dark") === "1";
export function setDark(v: boolean) {
  LS.set("chatsapp:dark", v ? "1" : "0");
  refresh();
}

/* ───────── A13 — wallpapers (CSS only — koi external image nahi) ───────── */
export interface WallpaperDef { id: string; name: string; css: string; dark?: boolean }
export const WALLPAPERS: WallpaperDef[] = [
  { id: "default", name: "Default", css: "transparent" },
  { id: "blurple", name: "Blurple Haze", css: "linear-gradient(135deg, #5865f210 0%, #9b7bff14 50%, #5865f20d 100%)" },
  { id: "mint", name: "Mint Fresh", css: "linear-gradient(135deg, #23a55a10 0%, #57f28712 100%)" },
  { id: "sunset", name: "Sunset", css: "linear-gradient(160deg, #f5a6230f 0%, #ed42450d 55%, #9b7bff0d 100%)" },
  { id: "ocean", name: "Ocean", css: "linear-gradient(135deg, #00a8fc12 0%, #5865f20e 100%)" },
  { id: "dots", name: "Dots", css: "radial-gradient(#5865f214 1.5px, transparent 1.5px)", dark: false },
  { id: "grid", name: "Grid", css: "linear-gradient(#5865f20d 1px, transparent 1px), linear-gradient(90deg, #5865f20d 1px, transparent 1px)", dark: false },
  { id: "night", name: "Night Sky", css: "linear-gradient(180deg, #2b2d3112 0%, #1e1f2214 100%)" },
  { id: "doodle", name: "Doodle 🎨", css: "doodle" },
];
export function getWallpaper(): string { return LS.get("chatsapp:wallpaper") || "default"; }
export function setWallpaper(id: string) { LS.set("chatsapp:wallpaper", id); refresh(); }
export function getWallpaperCustom(): string | null { return LS.get("chatsapp:wallpaper:custom"); }
export function setWallpaperCustom(dataUrl: string | null) {
  if (dataUrl) LS.set("chatsapp:wallpaper:custom", dataUrl); else LS.del("chatsapp:wallpaper:custom");
  refresh();
}
export function wallpaperStyle(wallpaper: string, custom: string | null): React.CSSProperties {
  if (wallpaper === "custom" && custom) {
    return { backgroundImage: `url(${custom})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" };
  }
  const def = WALLPAPERS.find((w) => w.id === wallpaper);
  if (!def || def.id === "default" || def.id === "doodle") return {};
  const style: React.CSSProperties = { backgroundImage: def.css };
  if (def.id === "dots" || def.id === "grid") style.backgroundSize = "22px 22px";
  return style;
}
/* 7 — doodle wallpaper active hai ya nahi (ChatView class lagata hai) */
export function isDoodleWallpaper(wallpaper: string): boolean {
  return wallpaper === "doodle";
}

/* ───────── 15 — chat wallpaper blur slider (0–20px) ───────── */
export const getWallpaperBlur = (): number => {
  const v = parseInt(LS.get("chatsapp:wallpaperblur") || "0", 10);
  return isNaN(v) ? 0 : Math.min(20, Math.max(0, v));
};
export function setWallpaperBlur(px: number) {
  LS.set("chatsapp:wallpaperblur", String(Math.min(20, Math.max(0, Math.round(px)))));
  refresh();
}

/* ───────── 1 — notification sound on/off 🔊 ───────── */
export const getSound = () => LS.get("chatsapp:sound") !== "0";
export function setSound(v: boolean) {
  LS.set("chatsapp:sound", v ? "1" : "0");
  refresh();
}

/* ───────── 4 — per-chat mute (notification sound band) + pin ───────── */
const strArr = (k: string): string[] => {
  try { const a = JSON.parse(LS.get(k) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
};
export const getMutedChats = (): string[] => strArr("chatsapp:mutedchats");
export function toggleMuteChat(id: string): boolean {
  const cur = getMutedChats();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  LS.set("chatsapp:mutedchats", JSON.stringify(next));
  return next.includes(id);
}
export const isChatMuted = (id: string) => getMutedChats().includes(id);
export const getPinnedChats = (): string[] => strArr("chatsapp:pinnedchats");
export function togglePinChat(id: string): boolean {
  const cur = getPinnedChats();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  LS.set("chatsapp:pinnedchats", JSON.stringify(next));
  return next.includes(id);
}
export const isChatPinned = (id: string) => getPinnedChats().includes(id);
/** Pinned chats upar, baqi lastAt ke hisab se */
export function sortChats<T extends { id: string; lastAt?: number }>(chats: T[]): T[] {
  const pinned = getPinnedChats();
  return [...chats].sort((a, b) => {
    const pa = pinned.includes(a.id) ? 0 : 1;
    const pb = pinned.includes(b.id) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (b.lastAt || 0) - (a.lastAt || 0);
  });
}
/* ───────── E6 — app lock PIN (hashed, kabhi plain nahi) ───────── */
const PIN_KEY = "chatsapp:pin";
async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`chatsapp-pin:${s}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const hasPin = () => !!LS.get(PIN_KEY);
export async function setPin(pin: string): Promise<void> {
  LS.set(PIN_KEY, await sha256(pin));
}
export async function verifyPin(pin: string): Promise<boolean> {
  const h = LS.get(PIN_KEY);
  if (!h) return true;
  return (await sha256(pin)) === h;
}
export function clearPin() { LS.del(PIN_KEY); }

/* ───────── E8 — chat backup ───────── */
const BACKUP_KEY = "chatsapp:lastBackup";
export const getLastBackup = (): number => { const v = LS.get(BACKUP_KEY); return v ? parseInt(v, 10) || 0 : 0; };
export function markBackupDone() { LS.set(BACKUP_KEY, String(Date.now())); }
