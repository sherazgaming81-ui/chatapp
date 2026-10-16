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
export interface GifPage {
  gifs: GifItem[];
  /** Opaque KLIPY cursor for the next page ("" = no more). */
  next: string;
}
function toGifItem(k: KlipyItem): GifItem {
  return { id: k.id, title: k.title, preview: k.preview, url: k.url };
}
async function klipyFetchLive(query: string, limit: number, pos: string, trending: boolean): Promise<GifPage | null> {
  if (klipyDead) return null;
  try {
    const page = trending
      ? await trendingKlipy(limit, pos, false)
      : await searchKlipy(query, limit, pos, false);
    return { gifs: page.items.map(toGifItem), next: page.next };
  } catch {
    klipyDead = true;
    return null;
  }
}

// ---- simple in-memory cache (first pages only) ----
const cache = new Map<string, GifPage>();

/** Live KLIPY search. `pos` = opaque cursor from previous page's `next` ("" for first page). */
export async function searchGifs(query: string, limit = 24, pos = ""): Promise<GifPage> {
  const q = query.trim();
  if (!q) return trendingGifs(limit, pos);
  // Don't use cache for paginated requests
  if (pos) {
    const live = await klipyFetchLive(q, limit, pos, false);
    return live ?? { gifs: [], next: "" };
  }
  const key = "s:" + q.toLowerCase();
  const hit = cache.get(key);
  if (hit) return { gifs: hit.gifs.slice(0, limit), next: hit.next };
  const live = await klipyFetchLive(q, limit, "", false);
  const res = live ?? { gifs: [], next: "" };
  cache.set(key, res);
  return { gifs: res.gifs.slice(0, limit), next: res.next };
}

/** Live KLIPY trending. `pos` = opaque cursor ("" for first page). */
export async function trendingGifs(limit = 24, pos = ""): Promise<GifPage> {
  if (pos) {
    const live = await klipyFetchLive("", limit, pos, true);
    return live ?? { gifs: [], next: "" };
  }
  const hit = cache.get("trending");
  if (hit) return { gifs: hit.gifs.slice(0, limit), next: hit.next };
  const live = await klipyFetchLive("", limit, "", true);
  const res = live ?? { gifs: [], next: "" };
  cache.set("trending", res);
  return { gifs: res.gifs.slice(0, limit), next: res.next };
}

/** Category GIFs. "trending" → trendingGifs. `pos` = opaque cursor ("" for first page). */
export async function categoryGifs(cat: string, limit = 24, pos = ""): Promise<GifPage> {
  if (cat === "trending") return trendingGifs(limit, pos);
  const meta = GIF_CATEGORIES.find((c) => c.id === cat);
  if (!meta?.query) return { gifs: [], next: "" };
  if (pos) {
    const live = await klipyFetchLive(meta.query, limit, pos, false);
    return live ?? { gifs: [], next: "" };
  }
  const key = "c:" + cat;
  const hit = cache.get(key);
  if (hit) return { gifs: hit.gifs.slice(0, limit), next: hit.next };
  const live = await klipyFetchLive(meta.query, limit, "", false);
  const res = live ?? { gifs: [], next: "" };
  cache.set(key, res);
  return { gifs: res.gifs.slice(0, limit), next: res.next };
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
 * or a plain category id string. `pos` = opaque cursor ("" for first page).
 */
export async function fetchCategoryGifs(c: GifCategory | string, limit = 24, pos = ""): Promise<GifPage> {
  const id = typeof c === "string" ? c : c.id;
  return categoryGifs(id, limit, pos);
}
