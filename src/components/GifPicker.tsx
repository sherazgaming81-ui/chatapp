"use client";
// GIF picker — KLIPY trending/search/categories.
// Cursor (`next`) pagination + seen-ID dedup: "Aur dekho" kabhi repeat nahi dikhata.
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { GIF_CATEGORIES, type GifItem, type GifCategory } from "@/lib/gifs";
import { searchKlipy, trendingKlipy, type KlipyItem } from "@/lib/klipy";
import { getLocalGifs, hasLocalCategory, searchLocalGifs } from "@/lib/localLibrary";

const LIMIT = 24;

type Mode = { kind: "search"; query: string } | { kind: "cat"; cat: GifCategory };

export default function GifPicker({ onPick }: { onPick: (g: GifItem) => void }) {
  const [cat, setCat] = useState<GifCategory>(GIF_CATEGORIES[0]);
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<KlipyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // KLIPY opaque cursor for the next page ("" = first page / no more)
  const nextRef = useRef<string>("");
  // Seen IDs — dedup across pages AND within a page
  const seenRef = useRef<Set<string>>(new Set());
  // Mode used for the current list (load-more must match it)
  const modeRef = useRef<Mode>({ kind: "cat", cat: GIF_CATEGORIES[0] });
  // Stale-response guard for fresh loads
  const reqIdRef = useRef(0);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMode = useCallback(async (mode: Mode, pos: string) => {
    // SELF-HOSTED FIRST: agar local library me hai to KLIPY ko touch mat karo!
    if (mode.kind === "cat" && hasLocalCategory(mode.cat.id)) {
      const local = getLocalGifs(mode.cat.id);
      return { items: local, next: "" }; // no pagination needed — sab local hai
    }
    if (mode.kind === "search") {
      const local = searchLocalGifs(mode.query);
      if (local.length > 0) return { items: local, next: "" };
    }
    // FALLBACK: KLIPY (jab local me na ho)
    if (mode.kind === "search") return searchKlipy(mode.query, LIMIT, pos, false);
    if (mode.cat.id === "trending") return trendingKlipy(LIMIT, pos, false);
    return searchKlipy(mode.cat.query, LIMIT, pos, false);
  }, []);

  /** Filter out already-seen IDs (page-internal + cross-page dupes). */
  const unique = useCallback((items: KlipyItem[]): KlipyItem[] => {
    const seen = seenRef.current;
    const out: KlipyItem[] = [];
    for (const it of items) {
      if (!it || !it.id || seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
    return out;
  }, []);

  /** Fresh load: cursor + seen reset, first page. */
  const freshLoad = useCallback(
    async (mode: Mode) => {
      const req = ++reqIdRef.current;
      modeRef.current = mode;
      nextRef.current = "";
      seenRef.current = new Set();
      setHasMore(false);
      setLoading(true);
      setError("");
      try {
        const page = await fetchMode(mode, "");
        if (req !== reqIdRef.current) return; // stale — newer load started
        setGifs(unique(page.items));
        nextRef.current = page.next || "";
        setHasMore(!!page.next);
      } catch {
        if (req !== reqIdRef.current) return;
        setError("GIFs nahi aye — dobara try karo");
        setGifs([]);
      } finally {
        if (req === reqIdRef.current) setLoading(false);
      }
    },
    [fetchMode, unique]
  );

  /** Next page via KLIPY `next` cursor. */
  const loadMore = useCallback(async () => {
    const pos = nextRef.current;
    if (!pos || loadingMore) return;
    const mode = modeRef.current;
    setLoadingMore(true);
    try {
      const page = await fetchMode(mode, pos);
      if (modeRef.current !== mode) return; // mode changed mid-flight — discard
      const fresh = unique(page.items);
      if (fresh.length) setGifs((prev) => [...prev, ...fresh]);
      nextRef.current = page.next || "";
      setHasMore(!!page.next);
    } catch {
      // list as-is rehne do; user button se retry kar sakta hai
    } finally {
      setLoadingMore(false);
    }
  }, [fetchMode, unique, loadingMore]);

  // Initial load (once)
  useEffect(() => {
    freshLoad({ kind: "cat", cat: GIF_CATEGORIES[0] });
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickCat = (c: GifCategory) => {
    if (c.id === cat.id && !searching) return; // already on it
    if (debounce.current) clearTimeout(debounce.current);
    setCat(c);
    setQ("");
    setSearching(false);
    freshLoad({ kind: "cat", cat: c });
  };

  const onSearch = (v: string) => {
    setQ(v);
    if (debounce.current) clearTimeout(debounce.current);
    if (!v.trim()) {
      setSearching(false);
      freshLoad({ kind: "cat", cat });
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(() => {
      freshLoad({ kind: "search", query: v.trim() });
    }, 500);
  };

  const retry = () => freshLoad(modeRef.current);

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
              onClick={() => pickCat(c)}
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
              onClick={retry}
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
        {/* Load more — sirf jab KLIPY `next` cursor ho */}
        {!loading && !error && hasMore && gifs.length > 0 && (
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
