"use client";
// KLIPY API client — WhatsApp/Discord wala platform!
// Docs: https://klipy.com | Har call par contentfilter=high + client-side
// keyword safety net (dono mil kar 18+ block karte hain).
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

/** Ek page ka result + agle page ka cursor. */
export interface KlipyPage {
  items: KlipyItem[];
  /** KLIPY ka opaque cursor; khaali ho to aur pages nahi */
  next: string;
}

function toItem(r: any): KlipyItem | null {
  const id = String(r?.id || "");
  if (!id) return null;
  // Client-side safety net: KLIPY contentfilter=high acha hai par perfect nahi
  // (2026-10-16 ko "Dancing Phallic Character Sticker" slip ho gaya tha).
  // Title/description/tags me explicit words hon to item reject karo.
  if (!isClean(r)) return null;
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

/** 18+ safety net — explicit words title/desc/tags me hon to item reject.
 * KLIPY ka contentfilter=high acha hai par perfect nahi. */
const NSFW_RE =
  /\b(phallic|porn|xxx|hentai|nude|naked|dick|penis|boobs?|tits|pussy|vagina|orgasm|masturbat|erotic|fetish|bdsm|stripper|escort|onlyfans|blowjob|handjob|camgirl|sexdoll|sex\s*doll|intercourse)\b/i;
function isClean(r: any): boolean {
  const tags = Array.isArray(r?.tags) ? r.tags.join(" ") : "";
  const text = [r?.title, r?.content_description, tags].filter(Boolean).join(" ");
  return !NSFW_RE.test(text);
}

async function klipyFetch(path: string): Promise<KlipyPage> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(`${BASE}${path}`, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error("klipy " + r.status);
    const d = await r.json();
    const arr = Array.isArray(d?.results) ? d.results : [];
    return {
      items: arr.map(toItem).filter(Boolean) as KlipyItem[],
      next: String(d?.next || ""),
    };
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

/**
 * Search GIFs or stickers. sticker=true for stickers.
 * `pos` is KLIPY's opaque cursor (from the previous page's `next`), NOT a number.
 */
export async function searchKlipy(query: string, limit = 24, pos = "", sticker = false): Promise<KlipyPage> {
  const q = encodeURIComponent(query.trim());
  const sf = sticker ? "&searchfilter=sticker" : "";
  const p = pos ? `&pos=${encodeURIComponent(pos)}` : "";
  return klipyFetch(`/search?q=${q}&key=${KLIPY_KEY}&limit=${limit}${p}&contentfilter=high${sf}`);
}

/** Trending GIFs or stickers. `pos` is the opaque cursor from the previous page. */
export async function trendingKlipy(limit = 24, pos = "", sticker = false): Promise<KlipyPage> {
  const sf = sticker ? "&searchfilter=sticker" : "";
  const p = pos ? `&pos=${encodeURIComponent(pos)}` : "";
  return klipyFetch(`/featured?key=${KLIPY_KEY}&limit=${limit}${p}&contentfilter=high${sf}`);
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
