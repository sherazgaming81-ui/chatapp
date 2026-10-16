"use client";
// GIF picker — GIPHY trending/search/categories grid
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { GIF_CATEGORIES, GifItem, fetchCategoryGifs, searchGifs, type GifCategory } from "@/lib/gifs";

export default function GifPicker({ onPick }: { onPick: (g: GifItem) => void }) {
  const [cat, setCat] = useState<GifCategory>(GIF_CATEGORIES[0]);
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (c: GifCategory) => {
    setLoading(true);
    setError("");
    try {
      setGifs(await fetchCategoryGifs(c));
    } catch {
      setError("GIFs nahi aye — dobara try karo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(cat);
  }, [cat, load]);

  const onSearch = (v: string) => {
    setQ(v);
    if (debounce.current) clearTimeout(debounce.current);
    if (!v.trim()) {
      setSearching(false);
      load(cat);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        setGifs(await searchGifs(v.trim()));
      } catch {
        setError("GIFs nahi aye — dobara try karo");
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-black/10 px-3 py-2">
        <Search size={15} className="shrink-0 text-[#80848e]" />
        <input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="GIF dhoondo…"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#2f3035] outline-none placeholder:text-[#80848e]"
        />
        {loading && <Loader2 size={14} className="animate-spin text-[#80848e]" />}
      </div>
      {!searching && (
        <div className="thin-scroll flex shrink-0 gap-1.5 overflow-x-auto border-b border-black/10 px-2 py-1.5">
          {GIF_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                cat.id === c.id ? "bg-[#5865f2] text-white" : "bg-black/5 text-[#5c5e66] hover:bg-black/10"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-lg bg-black/10" />
            ))}
          </div>
        ) : error ? (
          <div className="px-2 py-8 text-center">
            <p className="text-sm text-[#80848e]">{error}</p>
            <button
              onClick={() => (searching && q.trim() ? onSearch(q) : load(cat))}
              className="mt-3 rounded-full bg-[#5865f2] px-4 py-1.5 text-sm font-medium text-white"
            >
              Dobara try karo
            </button>
          </div>
        ) : gifs.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-[#80848e]">Kuch nahi mila</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {gifs.map((g) => (
              <button
                key={g.id}
                onClick={() => onPick(g)}
                title={g.title}
                className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-black/5 active:scale-95"
              >
                <img
                  src={g.preview}
                  alt={g.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:brightness-90"
                />
                <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/50 px-1 text-[9px] font-bold text-white">
                  GIF
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
