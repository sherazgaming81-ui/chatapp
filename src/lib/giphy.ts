"use client";
// GIPHY live API client — public client-side key (GIPHY keys are public by design).
// rating=g on every request = family-safe content only.

export const GIPHY_API_KEY = "gOJtDcFabYgak7kMh1VTcXMpNz2VcEw7";

const BASE = "https://api.giphy.com/v1";

export interface GiphyItem {
  id: string;
  title: string;
  /** small preview for grids */
  preview: string;
  /** full-size url */
  url: string;
  /** original width/height for aspect-ratio rendering */
  w?: number;
  h?: number;
}

interface GiphyResponse {
  data: Array<{
    id: string;
    title: string;
    images: {
      fixed_width: { url: string; width: string; height: string };
      original: { url: string; width: string; height: string };
      fixed_width_small?: { url: string };
    };
  }>;
  pagination: { total_count: number; count: number; offset: number };
  meta: { status: number };
}

function toItem(g: GiphyResponse["data"][number]): GiphyItem {
  const fw = g.images.fixed_width;
  const orig = g.images.original;
  return {
    id: g.id,
    title: g.title || "GIF",
    preview: fw?.url || orig?.url || "",
    url: orig?.url || fw?.url || "",
    w: fw ? parseInt(fw.width, 10) || undefined : undefined,
    h: fw ? parseInt(fw.height, 10) || undefined : undefined,
  };
}

async function fetchGiphy(
  endpoint: string,
  params: Record<string, string | number>
): Promise<{ items: GiphyItem[]; total: number }> {
  const q = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    rating: "g",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  const res = await fetch(`${BASE}${endpoint}?${q.toString()}`);
  if (!res.ok) throw new Error(`GIPHY ${res.status}`);
  const json = (await res.json()) as GiphyResponse;
  if (json.meta?.status !== 200) throw new Error(`GIPHY meta ${json.meta?.status}`);
  return {
    items: (json.data || []).map(toItem).filter((i) => i.preview),
    total: json.pagination?.total_count ?? 0,
  };
}

export const PAGE_SIZE = 24;

/** Trending GIFs */
export function trendingGifs(offset = 0, limit = PAGE_SIZE) {
  return fetchGiphy("/gifs/trending", { limit, offset, bundle: "messaging_non_clips" });
}

/** Search GIFs */
export function searchGifs(query: string, offset = 0, limit = PAGE_SIZE) {
  return fetchGiphy("/gifs/search", { q: query, limit, offset, lang: "en", bundle: "messaging_non_clips" });
}

/** Trending stickers */
export function trendingStickers(offset = 0, limit = PAGE_SIZE) {
  return fetchGiphy("/stickers/trending", { limit, offset });
}

/** Search stickers */
export function searchStickers(query: string, offset = 0, limit = PAGE_SIZE) {
  return fetchGiphy("/stickers/search", { q: query, limit, offset, lang: "en" });
}
