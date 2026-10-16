"use client";
// Sticker picker — GIPHY Stickers API, real-time (WhatsApp style).
// Trending grid + search bar + category chips. No static packs.
import { useCallback, useEffect, useState } from "react";
import { Search, RotateCcw } from "lucide-react";

const API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || "dc6zaTOxFJmzC";
const LIMIT = 24;

interface GiphySticker {
  id: string;
  title: string;
  url: string; // grid thumbnail (fixed_width)
  fullUrl: string; // message render (original)
}

const CATS = [
  { id: "trending", name: "Trending", icon: "🔥", q: "" },
  { id: "funny", name: "Funny", icon: "😂", q: "funny" },
  { id: "love", name: "Love", icon: "❤️", q: "love" },
  { id: "islamic", name: "Islamic", icon: "🕌", q: "islamic" },
  { id: "reactions", name: "Reactions", icon: "👍", q: "reaction" },
];

async function fetchStickers(query: string): Promise<GiphySticker[]> {
  const url = query.trim()
    ? `https://api.giphy.com/v1/stickers/search?api_key=${API_KEY}&q=${encodeURIComponent(
        query.trim()
      )}&limit=${LIMIT}&rating=g`
    : `https://api.giphy.com/v1/stickers/trending?api_key=${API_KEY}&limit=${LIMIT}&rating=g`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("giphy fetch failed");
  const json = await res.json();
  return ((json.data ?? []) as any[])
    .map((d) => ({
      id: String(d.id ?? ""),
      title: String(d.title ?? ""),
      url: String(d.images?.fixed_width?.url ?? d.images?.original?.url ?? ""),
      fullUrl: String(d.images?.original?.url ?? d.images?.fixed_width?.url ?? ""),
    }))
    .filter((s) => s.id && s.url);
}

export default function StickerPicker({ onPick }: { onPick: (url: string) => void }) {
  const [cat, setCat] = useState("trending");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<GiphySticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError(false);
    try {
      setItems(await fetchStickers(query));
    } catch {
      setError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Category change → immediate load
  const pickCat = (id: string) => {
    setCat(id);
    setQ("");
    const c = CATS.find((x) => x.id === id);
    load(c?.q ?? "");
  };

  // Search → debounce 500ms
  useEffect(() => {
    const query = q.trim();
    if (!query) return;
    const t = setTimeout(() => load(query), 500);
    return () => clearTimeout(t);
  }, [q, load]);

  // Initial: trending
  useEffect(() => {
    load("");
  }, [load]);

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
            onClick={() => {
              setQ("");
              pickCat("trending");
            }}
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
              onClick={() => load(searching ? q : CATS.find((x) => x.id === cat)?.q ?? "")}
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
      </div>
    </div>
  );
}
