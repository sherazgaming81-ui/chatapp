"use client";
// Sticker picker — LIVE GIPHY stickers fetching. WhatsApp style: icon categories + grid.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search, Smile, Heart, Frown, Laugh, Cake,
  ThumbsUp, Sunrise, MoonStar, PartyPopper, Moon,
  Sparkles, Loader2, ChevronDown,
} from "lucide-react";
import { trendingStickers, searchStickers, PAGE_SIZE, type GiphyItem } from "@/lib/giphy";

interface Cat {
  id: string;
  query: string;
  icon: React.ReactNode;
  label: string;
}

const CATS: Cat[] = [
  { id: "trending", query: "", icon: <Sparkles size={20} />, label: "Trending" },
  { id: "happy", query: "happy", icon: <Smile size={20} />, label: "Happy" },
  { id: "love", query: "love", icon: <Heart size={20} />, label: "Love" },
  { id: "sad", query: "sad", icon: <Frown size={20} />, label: "Sad" },
  { id: "funny", query: "funny", icon: <Laugh size={20} />, label: "Funny" },
  { id: "birthday", query: "happy birthday", icon: <Cake size={20} />, label: "Birthday" },
  { id: "thankyou", query: "thank you", icon: <ThumbsUp size={20} />, label: "Thanks" },
  { id: "goodmorning", query: "good morning", icon: <Sunrise size={20} />, label: "Good Morning" },
  { id: "goodnight", query: "good night", icon: <MoonStar size={20} />, label: "Good Night" },
  { id: "congrats", query: "congratulations", icon: <PartyPopper size={20} />, label: "Congrats" },
  { id: "islamic", query: "ramadan eid mubarak", icon: <Moon size={20} />, label: "Islamic" },
];

export default function StickerPicker({ onPick }: { onPick: (url: string) => void }) {
  const [cat, setCat] = useState(CATS[0]);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<GiphyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const reqId = useRef(0);

  const debouncedQ = useDebounce(q, 500);

  const load = useCallback(
    async (offset: number, append: boolean) => {
      const my = ++reqId.current;
      if (!append) {
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
      }
      try {
        const query = debouncedQ.trim();
        const res = query
          ? await searchStickers(query, offset)
          : cat.id === "trending"
            ? await trendingStickers(offset)
            : await searchStickers(cat.query, offset);
        if (my !== reqId.current) return; // stale request
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setHasMore(offset + res.items.length < res.total && res.items.length === PAGE_SIZE);
      } catch {
        if (my !== reqId.current) return;
        if (!append) setError("Stickers load nahi hue — dobara try karo!");
      } finally {
        if (my !== reqId.current) return;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [cat, debouncedQ]
  );

  // Reset + load on category/search change
  useEffect(() => {
    setItems([]);
    setHasMore(true);
    load(0, false);
  }, [load]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    load(items.length, true);
  };

  const searching = debouncedQ.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* WhatsApp-style icon categories */}
      {!searching && (
        <div className="thin-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b border-black/10 px-2 py-2">
          {CATS.map((c) => {
            const active = cat.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c)}
                title={c.label}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
                  active
                    ? "bg-[#5865f2] text-white"
                    : "text-[#80848e] hover:bg-black/5"
                }`}
              >
                {c.icon}
              </button>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="flex shrink-0 items-center gap-2 border-b border-black/10 px-3 py-2">
        <Search size={15} className="shrink-0 text-[#80848e]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sticker dhoondo…"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#2f3035] outline-none placeholder:text-[#80848e]"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="shrink-0 text-xs font-bold text-[#5865f2]"
          >
            Saaf
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#5865f2]" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-[#80848e]">{error}</p>
          <button
            onClick={() => load(0, false)}
            className="rounded-full bg-[#5865f2] px-5 py-2 text-sm font-bold text-white active:scale-95"
          >
            Dobara try karo
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-[#80848e]">
            {searching ? "Kuch nahi mila — aur likho!" : "Koi sticker nahi mila."}
          </p>
        </div>
      ) : (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3">
          {/* Vertical grid — ek-ek sticker, WhatsApp jesa */}
          <div className="grid grid-cols-4 content-start gap-3">
            {items.map((s) => (
              <button
                key={s.id}
                onClick={() => onPick(s.url)}
                title={s.title}
                className="flex aspect-square items-center justify-center rounded-xl p-1.5 transition hover:bg-black/5 active:scale-90"
              >
                <img
                  src={s.preview}
                  alt={s.title}
                  loading="lazy"
                  draggable={false}
                  className="max-h-full max-w-full object-contain drop-shadow-sm"
                />
              </button>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center py-4">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 rounded-full bg-[#5865f2] px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-[#4752c4] active:scale-95 disabled:opacity-60"
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Load ho raha…
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    Aur dikhao
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function useDebounce(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
