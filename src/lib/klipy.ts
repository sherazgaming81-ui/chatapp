"use client";
// KLIPY API client — WhatsApp/Discord wala platform!
// Docs: https://klipy.com | contentfilter=high blocks 18+ completely
const KLIPY_KEY = process.env.NEXT_PUBLIC_KLIPY_API_KEY || "W7TL0oKHC4zZkMlYyHqRzbfn1XJO4UokEfB88vwNq405K7f1D44VvhNJPm4xKys2";
const BASE = "https://api.klipy.com/v2";

export interface KlipyItem {
  id: string;
  title: string;
  /** small preview for grids */
  preview: string;
  /** full-size gif/sticker */
  url: string;
}

function toItem(r: any): KlipyItem | null {
  const id = String(r?.id || "");
  if (!id) return null;
  const mf = r?.media_formats || {};
  // preview: animated tiny gif (GIPHY jaisa — chalta hua!)
  const preview = mf.tinygif?.url || mf.nanogif?.url || mf.gif?.url || "";
  // full: medium gif (good quality, reasonable size)
  const url = mf.mediumgif?.url || mf.gif?.url || "";
  if (!preview || !url) return null;
  return {
    id,
    title: String(r?.title || r?.content_description || "GIF"),
    preview,
    url,
  };
}

async function klipyFetch(path: string): Promise<KlipyItem[]> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(`${BASE}${path}`, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error("klipy " + r.status);
    const d = await r.json();
    const arr = Array.isArray(d?.results) ? d.results : [];
    return arr.map(toItem).filter(Boolean) as KlipyItem[];
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

/** Search GIFs or stickers. sticker=true for stickers. */
export async function searchKlipy(query: string, limit = 24, offset = 0, sticker = false): Promise<KlipyItem[]> {
  const q = encodeURIComponent(query.trim());
  const sf = sticker ? "&searchfilter=sticker" : "";
  return klipyFetch(`/search?q=${q}&key=${KLIPY_KEY}&limit=${limit}&pos=${offset}&contentfilter=high${sf}`);
}

/** Trending GIFs or stickers. */
export async function trendingKlipy(limit = 24, offset = 0, sticker = false): Promise<KlipyItem[]> {
  const sf = sticker ? "&searchfilter=sticker" : "";
  return klipyFetch(`/featured?key=${KLIPY_KEY}&limit=${limit}&pos=${offset}&contentfilter=high${sf}`);
}

/** KLIPY categories (55+). */
export async function klipyCategories(): Promise<{ name: string; query: string }[]> {
  try {
    const r = await fetch(`${BASE}/categories?key=${KLIPY_KEY}&contentfilter=high`);
    if (!r.ok) return [];
    const d = await r.json();
    const tags = Array.isArray(d?.tags) ? d.tags : [];
    return tags.map((t: any) => ({
      name: String(t?.name || "").replace(/^#/, ""),
      query: String(t?.searchterm || t?.name || "").replace(/^#/, ""),
    })).filter((c: any) => c.name && c.query);
  } catch {
    return [];
  }
}
