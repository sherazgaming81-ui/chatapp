"use client";
// ─── Theme meta: favorites ⭐ + recents 🕐 (localStorage, reactive) ───
import { useSyncExternalStore } from "react";
import { getTheme } from "@/lib/themes";

const FAV_KEY = "chatsapp:theme_favs"; // string[] theme ids
const REC_KEY = "chatsapp:theme_recents"; // string[] theme ids, max 5
const REC_MAX = 5;

/* ── reactive version ── */
let tick = 0;
const listeners = new Set<() => void>();
function emit() { tick++; listeners.forEach((cb) => { try { cb(); } catch { /* ignore */ } }); }
export function useThemeMetaVersion(): number {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => tick,
    () => 0,
  );
}

function readArr(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && getTheme(x)) : [];
  } catch { return []; }
}
function writeArr(key: string, arr: string[]) {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch { /* ignore */ }
  emit();
}

/* ── ⭐ Favorites ── */
export function getFavThemes(): string[] { return readArr(FAV_KEY); }
export function isFavTheme(id: string): boolean { return getFavThemes().includes(id); }
/** Toggle — returns new fav list */
export function toggleFavTheme(id: string): string[] {
  const cur = getFavThemes();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  writeArr(FAV_KEY, next);
  return next;
}

/* ── 🕐 Recents (last 5, most-recent first) ── */
export function getRecentThemes(): string[] { return readArr(REC_KEY); }
export function pushRecentTheme(id: string) {
  if (!getTheme(id)) return;
  const cur = getRecentThemes().filter((x) => x !== id);
  writeArr(REC_KEY, [id, ...cur].slice(0, REC_MAX));
}
export function clearRecentThemes() { writeArr(REC_KEY, []); }
