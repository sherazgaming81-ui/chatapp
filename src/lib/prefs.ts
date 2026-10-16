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

/* ───────── reactive prefs snapshot (compact + wallpaper update live) ───────── */
interface PrefsSnap { compact: boolean; wallpaper: string; wallpaperCustom: string | null; }
let snap: PrefsSnap = { compact: false, wallpaper: "default", wallpaperCustom: null };
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => { try { l(); } catch { /* ignore */ } }); }
function readSnap(): PrefsSnap {
  return {
    compact: LS.get("chatsapp:compact") === "1",
    wallpaper: LS.get("chatsapp:wallpaper") || "default",
    wallpaperCustom: LS.get("chatsapp:wallpaper:custom"),
  };
}
function refresh() { snap = readSnap(); emit(); }
if (typeof window !== "undefined") snap = readSnap();
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
  if (!def || def.id === "default") return {};
  const style: React.CSSProperties = { backgroundImage: def.css };
  if (def.id === "dots" || def.id === "grid") style.backgroundSize = "22px 22px";
  return style;
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
