// Recents system — GIF/sticker send history, localStorage me.
// Koi server nahi, sab device par. Max 30 items, smart-sort by sent count.

export interface RecentItem {
  id: string;
  url: string;
  preview: string;
  title: string;
  type: "gif" | "sticker";
  sentCount: number;
  lastSent: number; // epoch ms
}

const KEY = "chatsapp_recents";
const MAX_ITEMS = 30;

function isValid(x: unknown): x is RecentItem {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.url === "string" &&
    (r.type === "gif" || r.type === "sticker")
  );
}

function loadAll(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // normalize + drop corrupt entries
    return arr.filter(isValid).map((r) => ({
      id: r.id,
      url: r.url,
      preview: typeof r.preview === "string" && r.preview ? r.preview : r.url,
      title: typeof r.title === "string" ? r.title : "",
      type: r.type,
      sentCount: typeof r.sentCount === "number" && r.sentCount > 0 ? Math.floor(r.sentCount) : 1,
      lastSent: typeof r.lastSent === "number" ? r.lastSent : 0,
    }));
  } catch {
    return [];
  }
}

function saveAll(items: RecentItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // quota full ya private mode — silently ignore
  }
}

/**
 * Track a sent GIF/sticker.
 * - Pehle se hai → sentCount+1, lastSent=abhi
 * - Naya hai → add (sentCount=1)
 * - 30 se zyada → sab se purana (lastSent) bahar (FIFO)
 */
export function trackRecent(item: {
  id: string;
  url: string;
  preview?: string;
  title?: string;
  type: "gif" | "sticker";
}): RecentItem[] {
  const all = loadAll();
  const now = Date.now();
  const existing = all.find((r) => r.id === item.id && r.type === item.type);
  if (existing) {
    existing.sentCount += 1;
    existing.lastSent = now;
    existing.url = item.url;
    existing.preview = item.preview || item.url;
    if (item.title) existing.title = item.title;
  } else {
    all.push({
      id: item.id,
      url: item.url,
      preview: item.preview || item.url,
      title: item.title || "",
      type: item.type,
      sentCount: 1,
      lastSent: now,
    });
  }
  // FIFO eviction: sab se purane sent wale bahar
  all.sort((a, b) => b.lastSent - a.lastSent);
  const trimmed = all.slice(0, MAX_ITEMS);
  saveAll(trimmed);
  return trimmed;
}

/**
 * Recents list — smart sort: sab se zyada bheje gaye pehle,
 * barabar ho to sab se recent pehle.
 */
export function getRecents(type: "gif" | "sticker"): RecentItem[] {
  return loadAll()
    .filter((r) => r.type === type)
    .sort((a, b) => b.sentCount - a.sentCount || b.lastSent - a.lastSent);
}

/** Top-N most-sent items of a type. */
export function getTop(type: "gif" | "sticker", n = 8): RecentItem[] {
  return getRecents(type).slice(0, Math.max(1, n));
}

/** Ek type ke recents saaf karo (ya sab, agar type na do). */
export function clearRecents(type?: "gif" | "sticker"): void {
  if (!type) {
    saveAll([]);
    return;
  }
  saveAll(loadAll().filter((r) => r.type !== type));
}

/** Ek type me kitne recents hain. */
export function recentCount(type: "gif" | "sticker"): number {
  return loadAll().filter((r) => r.type === type).length;
}

export const MAX_RECENTS = MAX_ITEMS;
