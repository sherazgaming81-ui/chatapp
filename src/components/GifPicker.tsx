"use client";
// GIF picker — 100% SELF-HOSTED. Koi API nahi, koi rate limit nahi!
// Sab GIFs apne server (GitHub + jsDelivr CDN) se ate hain.
import { useState } from "react";
import { Search } from "lucide-react";
import { getLocalGifs, searchLocalGifs, LOCAL_CATEGORIES, type LocalItem } from "@/lib/localLibrary";
import type { GifItem } from "@/lib/gifs";

const CAT_META: Record<string, { emoji: string; label: string }> = {
  funny: { emoji: "😂", label: "Funny" },
  reactions: { emoji: "🎭", label: "Reactions" },
  sad: { emoji: "😢", label: "Sad" },
};

export default function GifPicker({ onPick }: { onPick: (g: GifItem) => void }) {
  const [cat, setCat] = useState(LOCAL_CATEGORIES[0] || "funny");
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const items: LocalItem[] = query ? searchLocalGifs(query) : getLocalGifs(cat);

  const handlePick = (item: LocalItem) => {
    onPick({ id: item.id, title: item.title, url: item.url, preview: item.preview } as GifItem);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Search */}
      <div className="flex shrink-0 items-center gap-2 border-b border-black/10 px-3 py-2">
        <Search size={15} className="shrink-0 text-[#80848e]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="GIF dhoondo…"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#2f3035] outline-none placeholder:text-[#80848e]"
        />
      </div>

      {/* Categories — sirf local wali */}
      {!query && (
        <div className="thin-scroll flex shrink-0 gap-1.5 overflow-x-auto border-b border-black/10 px-2 py-1.5">
          {LOCAL_CATEGORIES.map((c) => {
            const meta = CAT_META[c] || { emoji: "🎬", label: c };
            const active = cat === c;
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold transition ${
                  active ? "bg-[#5865f2] text-white" : "bg-black/5 text-[#2f3035] hover:bg-black/10"
                }`}
              >
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      <div className="thin-scroll grid min-h-0 flex-1 grid-cols-3 gap-1.5 overflow-y-auto p-2">
        {items.map((g) => (
          <button
            key={g.id}
            onClick={() => handlePick(g)}
            className="relative aspect-square overflow-hidden rounded-lg bg-black/5 transition hover:brightness-95 active:scale-95"
            title={g.title}
          >
            <img
              src={g.preview}
              alt={g.title}
              loading="lazy"
              draggable={false}
              className="h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-[#80848e]">
            {query ? "Kuch nahi mila — aur likho!" : "GIFs aa rahe hain…"}
          </p>
        </div>
      )}

      {/* Footer note */}
      <div className="shrink-0 border-t border-black/5 px-3 py-1.5 text-center">
        <p className="text-[10px] text-[#80848e]">🏠 Apni library — hamesha chalegi!</p>
      </div>
    </div>
  );
}
