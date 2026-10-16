"use client";
// Sticker picker — 100% SELF-HOSTED. Koi API nahi!
// Sab stickers apne server (GitHub + jsDelivr CDN) se ate hain.
import { useState } from "react";
import { Search } from "lucide-react";
import { getLocalStickers, searchLocalStickers, STICKER_CATEGORIES, type LocalItem } from "@/lib/localLibrary";

const CAT_META: Record<string, { emoji: string; label: string }> = {
  happy: { emoji: "😊", label: "Happy" },
  love: { emoji: "❤️", label: "Love" },
  sad: { emoji: "😢", label: "Sad" },
  funny: { emoji: "😂", label: "Funny" },
  birthday: { emoji: "🎂", label: "Birthday" },
  thankyou: { emoji: "🙏", label: "Thanks" },
  goodmorning: { emoji: "🌅", label: "Good Morning" },
  goodnight: { emoji: "🌙", label: "Good Night" },
  congrats: { emoji: "🎉", label: "Congrats" },
  islamic: { emoji: "🕌", label: "Islamic" },
};

export default function StickerPicker({ onPick }: { onPick: (url: string) => void }) {
  const [cat, setCat] = useState(STICKER_CATEGORIES[0] || "happy");
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const items: LocalItem[] = query ? searchLocalStickers(query) : getLocalStickers(cat);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Search */}
      <div className="flex shrink-0 items-center gap-2 border-b border-black/10 px-3 py-2">
        <Search size={15} className="shrink-0 text-[#80848e]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sticker dhoondo…"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#2f3035] outline-none placeholder:text-[#80848e]"
        />
      </div>

      {/* Categories */}
      {!query && (
        <div className="thin-scroll flex shrink-0 gap-1.5 overflow-x-auto border-b border-black/10 px-2 py-1.5">
          {STICKER_CATEGORIES.map((c) => {
            const meta = CAT_META[c] || { emoji: "🎨", label: c };
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

      {/* Grid — stickers transparent hote hain, is liye contain */}
      <div className="thin-scroll grid min-h-0 flex-1 grid-cols-4 gap-2 overflow-y-auto p-3">
        {items.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.url)}
            className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-black/5 p-1 transition hover:bg-black/10 active:scale-95"
            title={s.title}
          >
            <img
              src={s.preview}
              alt={s.title}
              loading="lazy"
              draggable={false}
              className="max-h-full max-w-full object-contain"
            />
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-[#80848e]">
            {query ? "Kuch nahi mila — aur likho!" : "Stickers aa rahe hain…"}
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
