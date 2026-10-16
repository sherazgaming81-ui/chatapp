// Self-hosted GIF/Sticker library — GitHub + jsDelivr CDN
// Koi API key nahi, koi rate limit nahi, hamesha chalega!

const CDN = "https://cdn.jsdelivr.net/gh/sherazgaming81-ui/gif-library@main";

export interface LocalItem {
  id: string;
  title: string;
  url: string;
  preview: string;
}

// Har category ke files — build time par generate hota hai
// Format: { category: [file1, file2, ...] }
const LIBRARY: Record<string, string[]> = {
  funny: Array.from({ length: 24 }, (_, i) => `funny_${String(i + 1).padStart(3, "0")}.gif`),
  reactions: Array.from({ length: 24 }, (_, i) => `reactions_${String(i + 1).padStart(3, "0")}.gif`),
  sad: Array.from({ length: 24 }, (_, i) => `sad_${String(i + 1).padStart(3, "0")}.gif`),
};

export function getLocalGifs(category: string): LocalItem[] {
  const files = LIBRARY[category];
  if (!files) return [];
  return files.map((f, i) => ({
    id: `local_${category}_${i}`,
    title: f.replace(".gif", "").replace(/_/g, " "),
    url: `${CDN}/gifs/${category}/${f}`,
    preview: `${CDN}/gifs/${category}/${f}`,
  }));
}

export function hasLocalCategory(category: string): boolean {
  return category in LIBRARY;
}

export function searchLocalGifs(query: string): LocalItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: LocalItem[] = [];
  for (const [cat, files] of Object.entries(LIBRARY)) {
    // Category name match ya file me query
    if (cat.includes(q) || q.includes(cat)) {
      results.push(...getLocalGifs(cat));
    }
  }
  return results.slice(0, 48);
}

export const LOCAL_CATEGORIES = Object.keys(LIBRARY);
