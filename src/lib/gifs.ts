"use client";
// GIF library — KLIPY live API (WhatsApp/Discord wala platform!)
// contentfilter=high blocks 18+ completely. Curated fallback for offline.
import { searchKlipy, trendingKlipy, type KlipyItem } from "@/lib/klipy";

export interface GifItem {
  id: string;
  title: string;
  /** small preview for grids */
  preview: string;
  /** full-size gif */
  url: string;
}

export interface GifCategory {
  id: string;
  label: string;
  /** keywords used for KLIPY search */
  query: string;
}

export const GIF_CATEGORIES: GifCategory[] = [
  { id: "trending", label: "🔥 Trending", query: "" },
  { id: "funny", label: "😂 Funny", query: "funny" },
  { id: "love", label: "❤️ Love", query: "love" },
  { id: "reaction", label: "🎭 Reactions", query: "reaction" },
  { id: "happy", label: "😊 Happy", query: "happy" },
  { id: "sad", label: "😢 Sad", query: "sad" },
  { id: "wow", label: "😲 Wow", query: "wow shocked" },
  { id: "hello", label: "👋 Hello", query: "hello hi" },
  { id: "good-morning", label: "🌅 Good Morning", query: "good morning" },
  { id: "good-night", label: "🌙 Good Night", query: "good night" },
  { id: "party", label: "🎉 Party", query: "party celebration" },
  { id: "thank-you", label: "🙏 Thank You", query: "thank you" },
  { id: "congratulations", label: "🎊 Congrats", query: "congratulations" },
  { id: "sorry", label: "😔 Sorry", query: "sorry" },
  { id: "dance", label: "💃 Dance", query: "dance" },
  { id: "cat", label: "🐱 Cats", query: "cat" },
  { id: "cricket", label: "🏏 Cricket", query: "cricket" },
  { id: "islamic", label: "🕌 Islamic", query: "ramadan eid mubarak" },
];

// ---- live KLIPY (skipped forever once it fails) ----
let klipyDead = false;
function toGifItem(k: KlipyItem): GifItem {
  return { id: k.id, title: k.title, preview: k.preview, url: k.url };
}
async function klipyFetchLive(query: string, limit: number, offset: number, trending: boolean): Promise<GifItem[] | null> {
  if (klipyDead) return null;
  try {
    const items = trending
      ? await trendingKlipy(limit, offset, false)
      : await searchKlipy(query, limit, offset, false);
    return items.length ? items.map(toGifItem) : null;
  } catch {
    klipyDead = true;
    return null;
  }
}

// ---- curated fallback ----
// ---- simple in-memory cache ----
const cache = new Map<string, GifItem[]>();
function cached(key: string, make: () => GifItem[]): GifItem[] {
  const hit = cache.get(key);
  if (hit) return hit;
  const v = make();
  cache.set(key, v);
  if (cache.size > 60) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return v;
}

/** Live KLIPY search. Supports offset for pagination. */
export async function searchGifs(query: string, limit = 24, offset = 0): Promise<GifItem[]> {
  const q = query.trim();
  if (!q) return trendingGifs(limit, offset);
  // Don't use cache for paginated requests
  if (offset > 0) {
    const live = await klipyFetchLive(q, limit, offset, false);
    return live ?? [];
  }
  const key = "s:" + q.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit.slice(0, limit);
  const live = await klipyFetchLive(q, limit, 0, false);
  const res = live ?? [];
  cache.set(key, res);
  return res.slice(0, limit);
}

/** Live KLIPY trending. Supports offset for pagination. */
export async function trendingGifs(limit = 24, offset = 0): Promise<GifItem[]> {
  if (offset > 0) {
    const live = await klipyFetchLive("", limit, offset, true);
    return live ?? [];
  }
  const hit = cache.get("trending");
  if (hit) return hit.slice(0, limit);
  const live = await klipyFetchLive("", limit, 0, true);
  const res = live ?? [];
  cache.set("trending", res);
  return res.slice(0, limit);
}

/** Category GIFs. "trending" → trendingGifs. Supports offset for pagination. */
export async function categoryGifs(cat: string, limit = 24, offset = 0): Promise<GifItem[]> {
  if (cat === "trending") return trendingGifs(limit, offset);
  const meta = GIF_CATEGORIES.find((c) => c.id === cat);
  if (!meta?.query) return [];
  if (offset > 0) {
    const live = await klipyFetchLive(meta.query, limit, offset, false);
    return live ?? [];
  }
  const key = "c:" + cat;
  const hit = cache.get(key);
  if (hit) return hit.slice(0, limit);
  const live = await klipyFetchLive(meta.query, limit, 0, false);
  const res = live ?? [];
  cache.set(key, res);
  return res.slice(0, limit);
}

// ---- recent GIFs (localStorage) ----
const RECENT_KEY = "chatsapp_recent_gifs";
const RECENT_MAX = 24;

export function getRecentGifs(): GifItem[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((g: any) => g?.url) : [];
  } catch {
    return [];
  }
}

export function addRecentGif(g: GifItem): void {
  try {
    if (typeof window === "undefined") return;
    const cur = getRecentGifs().filter((x) => x.id !== g.id);
    cur.unshift(g);
    localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, RECENT_MAX)));
  } catch {}
}

export function clearRecentGifs(): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(RECENT_KEY);
  } catch {}
}

// Auto-generated curated GIF library (GIPHY CDN, verified working)
// Format per category: [gifId, title]
/**
 * UI-friendly wrapper used by GifPicker — accepts a full GifCategory object
 * or a plain category id string. Supports offset for pagination.
 */
export async function fetchCategoryGifs(c: GifCategory | string, limit = 24, offset = 0): Promise<GifItem[]> {
  const id = typeof c === "string" ? c : c.id;
  return categoryGifs(id, limit, offset);
}
