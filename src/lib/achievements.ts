"use client";
// Phase 6 — F6 Achievement Badges (Minecraft-style).
// Real actions par hi unlock — koi fake nahi. localStorage me track.

export interface BadgeDef {
  id: string;
  icon: string;
  title: string;
  desc: string;
}

export const BADGES: BadgeDef[] = [
  { id: "pehla-salam", icon: "👋", title: "Pehla Salam", desc: "Apna pehla message bheja" },
  { id: "quran-khawan", icon: "📖", title: "Quran Khawan", desc: "Quran-e-Pak khola" },
  { id: "naam-yaad", icon: "✨", title: "Naam Yaad", desc: "Asma-ul-Husna quiz me 10/10" },
  { id: "sathi", icon: "🤝", title: "Sathi", desc: "7 din active rahe" },
  { id: "mehfil", icon: "💬", title: "Mehfil", desc: "100 messages bheje" },
];

const KEY = "chatsapp:badges";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}

/** Popup ke liye event emitter (AchievementToasts subscribe karta hai). SSR-safe: useState+useEffect. */
type Cb = (b: BadgeDef) => void;
const subs = new Set<Cb>();
export function onBadgeUnlock(cb: Cb): () => void {
  subs.add(cb);
  return () => { subs.delete(cb); };
}

export function hasBadge(id: string): boolean {
  return read().includes(id);
}

export function getBadges(): string[] {
  return read();
}

/** Real action par call karo. Pehli dafa hi popup ayega. */
export function unlockBadge(id: string): boolean {
  const def = BADGES.find((b) => b.id === id);
  if (!def) return false;
  const cur = read();
  if (cur.includes(id)) return false;
  try { localStorage.setItem(KEY, JSON.stringify([...cur, id])); } catch { /* ignore */ }
  subs.forEach((cb) => { try { cb(def); } catch { /* ignore */ } });
  return true;
}

/* ───────── Sathi badge — active days tracking ───────── */
const DAYS_KEY = "chatsapp:activedays";
/** Aaj ka din record karo. 7 distinct days par "sathi" unlock. */
export function trackActiveDay(): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(DAYS_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    if (!arr.includes(today)) {
      const next = [...arr, today].slice(-30);
      localStorage.setItem(DAYS_KEY, JSON.stringify(next));
      if (next.length >= 7) unlockBadge("sathi");
    }
  } catch { /* ignore */ }
}
