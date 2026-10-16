"use client";
// Sticker picker — WhatsApp style: icon categories + vertical grid, ek-ek karke.
import { useState } from "react";
import {
  Search, Smile, Heart, Frown, Laugh, Cake,
  ThumbsUp, Sunrise, MoonStar, PartyPopper, Moon,
} from "lucide-react";
import { getLocalStickers, searchLocalStickers, STICKER_CATEGORIES, type LocalItem } from "@/lib/localLibrary";

const CAT_ICONS: Record<string, React.ReactNode> = {
  happy: <Smile size={20} />,
  love: <Heart size={20} />,
  sad: <Frown size={20} />,
  funny: <Laugh size={20} />,
  birthday: <Cake size={20} />,
  thankyou: <ThumbsUp size={20} />,
  goodmorning: <Sunrise size={20} />,
  goodnight: <MoonStar size={20} />,
  congrats: <PartyPopper size={20} />,
  islamic: <Moon size={20} />,
};

const CAT_LABELS: Record<string, string> = {
  happy: "Happy", love: "Love", sad: "Sad", funny: "Funny",
  birthday: "Birthday", thankyou: "Thanks", goodmorning: "Good Morning",
  goodnight: "Good Night", congrats: "Congrats", islamic: "Islamic",
};

export default function StickerPicker({ onPick }: { onPick: (url: string) => void }) {
  const [cat, setCat] = useState(STICKER_CATEGORIES[0] || "happy");
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const items: LocalItem[] = query ? searchLocalStickers(query) : getLocalStickers(cat);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* WhatsApp-style icon categories */}
      {!query && (
        <div className="thin-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b border-black/10 px-2 py-2">
          {STICKER_CATEGORIES.map((c) => {
            const active = cat === c;
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                title={CAT_LABELS[c] || c}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
                  active
                    ? "bg-[#5865f2] text-white"
                    : "text-[#80848e] hover:bg-black/5"
                }`}
              >
                {CAT_ICONS[c] || <Smile size={20} />}
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
      </div>

      {/* Vertical grid — ek-ek sticker, WhatsApp jesa */}
      <div className="thin-scroll grid min-h-0 flex-1 grid-cols-4 content-start gap-3 overflow-y-auto p-3">
        {items.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.url)}
            title={CAT_LABELS[cat] || ""}
            className="flex aspect-square items-center justify-center rounded-xl p-1.5 transition hover:bg-black/5 active:scale-90"
          >
            <img
              src={s.preview}
              alt=""
              loading="lazy"
              draggable={false}
              className="max-h-full max-w-full object-contain drop-shadow-sm"
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
    </div>
  );
}
