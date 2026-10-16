// Self-hosted GIF + Sticker library — GitHub repo + jsDelivr CDN.
// Koi API nahi, koi rate limit nahi, hamesha chalega!
const CDN = "https://cdn.jsdelivr.net/gh/sherazgaming81-ui/gif-library@main";

export interface LocalItem {
  id: string;
  title: string;
  url: string;
  preview: string;
}

// category -> file count
const GIF_CATS: Record<string, number> = {
  funny: 50, reactions: 50, sad: 50, love: 50, happy: 50,
  thankyou: 50, goodmorning: 50, goodnight: 50, birthday: 50,
  congrats: 50, wow: 50, lol: 50, omg: 50, facepalm: 50, shrug: 50,
};

const STICKER_CATS: Record<string, number> = {
  happy: 50, love: 50, sad: 50, funny: 50, birthday: 50,
  thankyou: 50, goodmorning: 50, goodnight: 50, congrats: 50, islamic: 50,
};

export const GIF_CATEGORIES = Object.keys(GIF_CATS);
export const STICKER_CATEGORIES = Object.keys(STICKER_CATS);
// Backward compat
export const LOCAL_CATEGORIES = GIF_CATEGORIES;

function buildItems(kind: "gifs" | "stickers", cats: Record<string, number>): LocalItem[] {
  const out: LocalItem[] = [];
  for (const [cat, count] of Object.entries(cats)) {
    for (let i = 1; i <= count; i++) {
      const n = String(i).padStart(3, "0");
      const url = `${CDN}/${kind}/${cat}/${cat}_${n}.gif`;
      out.push({ id: `${kind}-${cat}-${n}`, title: `${cat} ${n}`, url, preview: url });
    }
  }
  return out;
}

const ALL_GIFS = buildItems("gifs", GIF_CATS);
const ALL_STICKERS = buildItems("stickers", STICKER_CATS);

export function getLocalGifs(category: string): LocalItem[] {
  const count = GIF_CATS[category];
  if (!count) return [];
  const items: LocalItem[] = [];
  for (let i = 1; i <= count; i++) {
    const n = String(i).padStart(3, "0");
    const url = `${CDN}/gifs/${category}/${category}_${n}.gif`;
    items.push({ id: `gif-${category}-${n}`, title: `${category} ${n}`, url, preview: url });
  }
  return items;
}

export function getLocalStickers(category: string): LocalItem[] {
  const count = STICKER_CATS[category];
  if (!count) return [];
  const items: LocalItem[] = [];
  for (let i = 1; i <= count; i++) {
    const n = String(i).padStart(3, "0");
    const url = `${CDN}/stickers/${category}/${category}_${n}.gif`;
    items.push({ id: `sticker-${category}-${n}`, title: `${category} ${n}`, url, preview: url });
  }
  return items;
}

export function hasLocalCategory(category: string): boolean {
  return category in GIF_CATS;
}

export function searchLocalGifs(query: string): LocalItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return ALL_GIFS.filter((g) => g.title.toLowerCase().includes(q)).slice(0, 60);
}

export function searchLocalStickers(query: string): LocalItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return ALL_STICKERS.filter((s) => s.title.toLowerCase().includes(q)).slice(0, 60);
}

export const GIF_COUNT = ALL_GIFS.length;
export const STICKER_COUNT = ALL_STICKERS.length;
