// Quran data layer — ALL Arabic text comes from the AlQuran Cloud API (Tanzil/Uthmani source).
// NEVER hardcode Quranic Arabic in this codebase. Cache in localStorage for offline use.
const API = "https://api.alquran.cloud/v1";

export interface SurahMeta {
  number: number;
  name: string; // Arabic name (from API)
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string; // "Meccan" | "Medinan"
}

export interface Ayah {
  numberInSurah: number;
  arabic: string; // Uthmani (from API)
  urdu: string; // Jalandhry translation (from API)
}

// Bismillah — exact Uthmani string VERIFIED from API: GET /v1/surah/1/quran-uthmani (ayah 1)
const BISMILLAH_RAW = "﻿بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";
export const BISMILLAH = BISMILLAH_RAW.replace(/^﻿/, "").trim();
// Bismillah ka Urdu tarjuma (Jalandhry) — VERIFIED from API: GET /v1/ayah/1:1/editions/ur.jalandhry
export const BISMILLAH_URDU = "شروع الله کا نام لے کر جو بڑا مہربان نہایت رحم والا ہے";

// Cache version — badhao jab Quran data format badle (purana cache auto-clear)
const QURAN_CACHE_V = "v2";

// Juz → starting surah. VERIFIED against API: GET /v1/juz/{1,14,30}/quran-uthmani
// (1→1:1, 14→15:1, 30→78:1 all matched). Standard Medina mushaf mapping.
export const JUZ_STARTS: { juz: number; surah: number; ayah: number }[] = [
  { juz: 1, surah: 1, ayah: 1 }, { juz: 2, surah: 2, ayah: 142 }, { juz: 3, surah: 2, ayah: 253 },
  { juz: 4, surah: 3, ayah: 93 }, { juz: 5, surah: 4, ayah: 24 }, { juz: 6, surah: 5, ayah: 83 },
  { juz: 7, surah: 6, ayah: 111 }, { juz: 8, surah: 7, ayah: 88 }, { juz: 9, surah: 8, ayah: 41 },
  { juz: 10, surah: 9, ayah: 93 }, { juz: 11, surah: 11, ayah: 6 }, { juz: 12, surah: 12, ayah: 53 },
  { juz: 13, surah: 13, ayah: 1 }, { juz: 14, surah: 15, ayah: 1 }, { juz: 15, surah: 17, ayah: 1 },
  { juz: 16, surah: 18, ayah: 75 }, { juz: 17, surah: 19, ayah: 1 }, { juz: 18, surah: 25, ayah: 21 },
  { juz: 19, surah: 27, ayah: 56 }, { juz: 20, surah: 29, ayah: 46 }, { juz: 21, surah: 33, ayah: 31 },
  { juz: 22, surah: 36, ayah: 28 }, { juz: 23, surah: 39, ayah: 32 }, { juz: 24, surah: 41, ayah: 47 },
  { juz: 25, surah: 45, ayah: 1 }, { juz: 26, surah: 46, ayah: 1 }, { juz: 27, surah: 51, ayah: 31 },
  { juz: 28, surah: 58, ayah: 9 }, { juz: 29, surah: 67, ayah: 1 }, { juz: 30, surah: 78, ayah: 1 },
];

function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
function cacheSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

export async function fetchSurahList(): Promise<SurahMeta[]> {
  const cached = cacheGet<SurahMeta[]>("chatsapp:quran:surahs:" + QURAN_CACHE_V);
  if (cached && cached.length === 114) return cached;
  const r = await fetch(`${API}/surah`);
  if (!r.ok) throw new Error("net");
  const d = await r.json();
  const list: SurahMeta[] = d.data.map((s: any) => ({
    number: s.number, name: s.name, englishName: s.englishName,
    englishNameTranslation: s.englishNameTranslation,
    numberOfAyahs: s.numberOfAyahs, revelationType: s.revelationType,
  }));
  cacheSet("chatsapp:quran:surahs:" + QURAN_CACHE_V, list);
  return list;
}

export async function fetchSurah(n: number): Promise<{ meta: SurahMeta; ayahs: Ayah[] }> {
  const cached = cacheGet<{ meta: SurahMeta; ayahs: Ayah[] }>(`chatsapp:quran:surah:${n}:${QURAN_CACHE_V}`);
  if (cached && cached.ayahs.length > 0) return cached;
  const r = await fetch(`${API}/surah/${n}/editions/quran-uthmani,ur.jalandhry`);
  if (!r.ok) throw new Error("net");
  const d = await r.json();
  const [ar, ur] = d.data;
  const meta: SurahMeta = {
    number: ar.number, name: ar.name, englishName: ar.englishName,
    englishNameTranslation: ar.englishNameTranslation,
    numberOfAyahs: ar.numberOfAyahs, revelationType: ar.revelationType,
  };
  let ayahs: Ayah[] = ar.ayahs.map((a: any, i: number) => ({
    numberInSurah: a.numberInSurah,
    arabic: (a.text as string).replace(/^﻿/, ""),
    urdu: ur.ayahs[i]?.text ?? "",
  }));
  // Surah 1: ayah 1 IS the Bismillah (keep). Surah 9: none. Others: strip Bismillah prefix from ayah 1.
  if (n !== 1 && n !== 9 && ayahs[0]) {
    const t = ayahs[0].arabic;
    if (t.startsWith(BISMILLAH)) {
      const stripped = t.slice(BISMILLAH.length).trim();
      if (stripped.length > 0) ayahs[0] = { ...ayahs[0], arabic: stripped };
    }
  }
  const out = { meta, ayahs };
  cacheSet(`chatsapp:quran:surah:${n}:${QURAN_CACHE_V}`, out);
  return out;
}

export interface DailyAyahData { arabic: string; urdu: string; surahName: string; ref: string }

// 30 famous ayah references — Arabic ALWAYS fetched from API, never typed.
export const DAILY_AYAHS: { s: number; a: number }[] = [
  { s: 2, a: 152 }, { s: 2, a: 286 }, { s: 13, a: 28 }, { s: 94, a: 6 }, { s: 39, a: 53 },
  { s: 3, a: 139 }, { s: 2, a: 153 }, { s: 65, a: 3 }, { s: 8, a: 2 }, { s: 20, a: 114 },
  { s: 55, a: 13 }, { s: 2, a: 261 }, { s: 3, a: 160 }, { s: 14, a: 7 }, { s: 40, a: 60 },
  { s: 29, a: 69 }, { s: 47, a: 7 }, { s: 2, a: 255 }, { s: 112, a: 1 }, { s: 36, a: 58 },
  { s: 25, a: 63 }, { s: 17, a: 23 }, { s: 31, a: 14 }, { s: 4, a: 36 }, { s: 16, a: 97 },
  { s: 24, a: 26 }, { s: 49, a: 13 }, { s: 59, a: 9 }, { s: 76, a: 8 }, { s: 2, a: 201 },
];

export function dailyIndex(len: number, offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start.getTime()) / 864e5);
  return (day + offset) % len;
}

export async function fetchDailyAyah(): Promise<DailyAyahData> {
  const idx = dailyIndex(DAILY_AYAHS.length);
  const { s, a } = DAILY_AYAHS[idx];
  const key = `chatsapp:quran:ayah:${s}:${a}`;
  const cached = cacheGet<DailyAyahData>(key);
  if (cached) return cached;
  const r = await fetch(`${API}/ayah/${s}:${a}/editions/quran-uthmani,ur.jalandhry`);
  if (!r.ok) throw new Error("net");
  const d = await r.json();
  const [ar, ur] = d.data;
  const out: DailyAyahData = {
    arabic: (ar.text as string).replace(/^﻿/, ""),
    urdu: ur.text,
    surahName: ar.surah.englishName,
    ref: `Surah ${ar.surah.englishName} ${s}:${a}`,
  };
  cacheSet(key, out);
  return out;
}

// ── bookmarks + last read (localStorage) ──
export interface Bookmark { surah: number; ayah: number; surahName: string; at: number }
export function getBookmarks(): Bookmark[] {
  return cacheGet<Bookmark[]>("chatsapp:quran:bookmarks") ?? [];
}
export function toggleBookmark(b: Bookmark): Bookmark[] {
  const list = getBookmarks();
  const i = list.findIndex((x) => x.surah === b.surah && x.ayah === b.ayah);
  if (i >= 0) list.splice(i, 1); else list.unshift({ ...b, at: Date.now() });
  cacheSet("chatsapp:quran:bookmarks", list);
  return list;
}
export function isBookmarked(surah: number, ayah: number) {
  return getBookmarks().some((x) => x.surah === surah && x.ayah === ayah);
}
export function saveLastRead(surah: number, ayah: number, surahName: string) {
  const all = cacheGet<Record<number, { ayah: number; surahName: string; at: number }>>("chatsapp:quran:lastread") ?? {};
  all[surah] = { ayah, surahName, at: Date.now() };
  cacheSet("chatsapp:quran:lastread", all);
}
export function getLastRead(surah: number) {
  const all = cacheGet<Record<number, { ayah: number; surahName: string; at: number }>>("chatsapp:quran:lastread") ?? {};
  return all[surah] ?? null;
}
export function getAllLastRead() {
  const all = cacheGet<Record<number, { ayah: number; surahName: string; at: number }>>("chatsapp:quran:lastread") ?? {};
  return Object.entries(all)
    .map(([s, v]) => ({ surah: parseInt(s, 10), ...v }))
    .sort((a, b) => b.at - a.at);
}
