"use client";
// Sticker picker — KLIPY Stickers API (WhatsApp/Discord wala platform!)
// Trending grid + search bar + category chips.
// Pagination: KLIPY opaque `next` cursor (numeric offset NAHI).
// Deduplication: seen IDs track hote hain, duplicates kabhi nahi dikhenge.
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, RotateCcw } from "lucide-react";
import { searchKlipy, trendingKlipy } from "@/lib/klipy";

const LIMIT = 24;

interface KlipySticker {
  id: string;
  title: string;
  url: string;
  fullUrl: string;
}

const CATS = [
  { id: "trending", name: "Trending", icon: "🔥", q: "" },
  { id: "funny", name: "Funny", icon: "😂", q: "funny" },
  { id: "love", name: "Love", icon: "❤️", q: "love" },
  { id: "islamic", name: "Islamic", icon: "🕌", q: "islamic" },
  { id: "reactions", name: "Reactions", icon: "👍", q: "reaction" },
  { id: "happy", name: "Happy", icon: "😊", q: "happy" },
  { id: "sad", name: "Sad", icon: "😢", q: "sad" },
  { id: "angry", name: "Angry", icon: "😡", q: "angry" },
  { id: "wow", name: "Wow", icon: "😲", q: "wow shocked" },
  { id: "hello", name: "Hello", icon: "👋", q: "hello hi" },
  { id: "goodmorning", name: "Good Morning", icon: "🌅", q: "good morning" },
  { id: "goodnight", name: "Good Night", icon: "🌙", q: "good night" },
  { id: "thanks", name: "Thanks", icon: "🙏", q: "thank you" },
  { id: "congrats", name: "Congrats", icon: "🎉", q: "congratulations party" },
  { id: "sorry", name: "Sorry", icon: "😔", q: "sorry" },
  { id: "cute", name: "Cute", icon: "🥰", q: "cute kawaii" },
  { id: "animals", name: "Animals", icon: "🐱", q: "cute animals" },
  { id: "eid", name: "Eid", icon: "🌙", q: "eid mubarak" },
  { id: "ramadan", name: "Ramadan", icon: "🕌", q: "ramadan kareem" },
  { id: "birthday", name: "Birthday", icon: "🎂", q: "happy birthday" },
];

export default function StickerPicker({ onPick }: { onPick: (url: string) => void }) {
  const [cat, setCat] = useState("trending");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<KlipySticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Cursor + dedup refs (state nahi — re-render trigger nahi karna)
  const nextRef = useRef("");
  const seenRef = useRef<Set<string>>(new Set());
  const reqIdRef = useRef(0);

  const fetchPage = useCallback(async (query: string, pos: string): Promise<{ stickers: KlipySticker[]; next: string }> => {
    const page = query.trim()
      ? await searchKlipy(query.trim(), LIMIT, pos, true)
      : await trendingKlipy(LIMIT, pos, true);
    // Deduplicate: sirf naye IDs rakho
    const fresh: KlipySticker[] = [];
    for (const s of page.items) {
      if (seenRef.current.has(s.id)) continue;
      seenRef.current.add(s.id);
      fresh.push({ id: s.id, title: s.title, url: s.preview, fullUrl: s.url });
    }
    return { stickers: fresh, next: page.next };
  }, []);

  /** Fresh load: cursor + seen reset, phir page 1 */
  const loadFresh = useCallback(async (query: string) => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(false);
    setHasMore(false);
    nextRef.current = "";
    seenRef.current = new Set();
    try {
      const { stickers, next } = await fetchPage(query, "");
      if (reqId !== reqIdRef.current) return; // purani request — ignore
      setItems(stickers);
      nextRef.current = next;
      setHasMore(next.length > 0);
    } catch {
      if (reqId !== reqIdRef.current) return;
      setError(true);
      setItems([]);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [fetchPage]);

  /** Load more: cursor se agla page, dedup ke saath append */
  const loadMore = useCallback(async () => {
    const query = q.trim() ? q.trim() : (CATS.find((x) => x.id === cat)?.q ?? "");
    const pos = nextRef.current;
    if (!pos || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const { stickers, next } = await fetchPage(query, pos);
      nextRef.current = next;
      setHasMore(next.length > 0);
      if (stickers.length > 0) {
        setItems((prev) => [...prev, ...stickers]);
      } else if (!next) {
        // Kuch naya nahi aur cursor bhi khatam — bas hasMore false
        setHasMore(false);
      }
    } catch {
      // silent — user dobara try kar sakta hai
    } finally {
      setLoadingMore(false);
    }
  }, [q, cat, loading, loadingMore, fetchPage]);

  // Category change → fresh load with reset
  const pickCat = useCallback((id: string) => {
    setCat(id);
    setQ("");
    const c = CATS.find((x) => x.id === id);
    loadFresh(c?.q ?? "");
  }, [loadFresh]);

  // Search → debounce 500ms → fresh load (cursor reset)
  useEffect(() => {
    const query = q.trim();
    if (!query) return;
    const t = setTimeout(() => loadFresh(query), 500);
    return () => clearTimeout(t);
  }, [q, loadFresh]);

  // Initial: trending
  useEffect(() => {
    loadFresh("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searching = q.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* Search */}
      <div className="flex shrink-0 items-center gap-2 rounded-xl bg-black/5 px-3 py-2">
        <Search size={15} className="shrink-0 text-[#80848e]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sticker dhoondo…"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#2f3035] outline-none placeholder:text-[#80848e]"
        />
        {searching && (
          <button
            onClick={() => pickCat("trending")}
            title="Clear"
            className="text-[#80848e] hover:text-[#2f3035]"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {/* Category chips */}
      <div className="thin-scroll -mx-0.5 flex shrink-0 gap-1.5 overflow-x-auto px-0.5 py-2">
        {CATS.map((c) => {
          const active = !searching && cat === c.id;
          return (
            <button
              key={c.id}
              onClick={() => pickCat(c.id)}
              className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                active ? "bg-[#5865f2] text-white" : "bg-black/5 text-[#5c5e66] hover:bg-black/10"
              }`}
            >
              <span className="text-sm leading-none">{c.icon}</span>
              {c.name}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-black/5" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <span className="text-4xl">😕</span>
            <p className="mt-2 text-sm font-bold text-[#2f3035]">Stickers load nahi hue</p>
            <p className="mt-0.5 text-xs text-[#80848e]">Internet check karo aur dobara try karo</p>
            <button
              onClick={() => loadFresh(searching ? q.trim() : CATS.find((x) => x.id === cat)?.q ?? "")}
              className="mt-3 rounded-full bg-[#5865f2] px-4 py-1.5 text-xs font-bold text-white transition active:scale-95"
            >
              Dobara try karo
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <span className="text-4xl">🔍</span>
            <p className="mt-2 text-sm font-bold text-[#2f3035]">Kuch nahi mila</p>
            <p className="mt-0.5 text-xs text-[#80848e]">Kuch aur likh kar dhoondo</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 pb-1">
            {items.map((s) => (
              <button
                key={s.id}
                onClick={() => onPick(s.fullUrl)}
                title={s.title}
                className="aspect-square rounded-xl bg-black/[0.04] p-1.5 transition hover:bg-black/[0.08] hover:scale-[1.04] active:scale-95"
              >
                <img
                  src={s.url}
                  alt={s.title || "sticker"}
                  loading="lazy"
                  draggable={false}
                  className="h-full w-full object-contain"
                />
              </button>
            ))}
          </div>
        )}
        {/* Load more — sirf jab aur results hon */}
        {!loading && !error && hasMore && items.length > 0 && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="mx-auto mt-3 mb-1 flex items-center gap-2 rounded-full bg-black/5 px-5 py-2 text-sm font-medium text-[#5c5e66] transition hover:bg-black/10 active:scale-95 disabled:opacity-50"
          >
            {loadingMore ? "Load ho raha…" : "⬇️ Aur dekho"}
          </button>
        )}
      </div>
    </div>
  );
}
