"use client";
// GIF picker — WhatsApp style: icon categories + vertical scroll grid.
import { useState } from "react";
import {
  Search, Laugh, Drama, Frown, Heart, Smile, ThumbsUp,
  Sunrise, MoonStar, Cake, PartyPopper, Sparkles,
  Zap, Hand, CircleHelp,
} from "lucide-react";
import { getLocalGifs, searchLocalGifs, GIF_CATEGORIES, type LocalItem } from "@/lib/localLibrary";
import type { GifItem } from "@/lib/gifs";

const CAT_ICONS: Record<string, React.ReactNode> = {
  funny: <Laugh size={20} />,
  reactions: <Drama size={20} />,
  sad: <Frown size={20} />,
  love: <Heart size={20} />,
  happy: <Smile size={20} />,
  thankyou: <ThumbsUp size={20} />,
  goodmorning: <Sunrise size={20} />,
  goodnight: <MoonStar size={20} />,
  birthday: <Cake size={20} />,
  congrats: <PartyPopper size={20} />,
  wow: <Sparkles size={20} />,
  lol: <Laugh size={20} />,
  omg: <Zap size={20} />,
  facepalm: <Hand size={20} />,
  shrug: <CircleHelp size={20} />,
};

const CAT_LABELS: Record<string, string> = {
  funny: "Funny", reactions: "Reactions", sad: "Sad", love: "Love",
  happy: "Happy", thankyou: "Thanks", goodmorning: "Good Morning",
  goodnight: "Good Night", birthday: "Birthday", congrats: "Congrats",
  wow: "Wow", lol: "LOL", omg: "OMG", facepalm: "Facepalm", shrug: "Shrug",
};

export default function GifPicker({ onPick }: { onPick: (g: GifItem) => void }) {
  const [cat, setCat] = useState(GIF_CATEGORIES[0] || "funny");
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const items: LocalItem[] = query ? searchLocalGifs(query) : getLocalGifs(cat);

  const handlePick = (item: LocalItem) => {
    onPick({ id: item.id, title: item.title, url: item.url, preview: item.preview } as GifItem);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* WhatsApp-style icon categories */}
      {!query && (
        <div className="thin-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b border-black/10 px-2 py-2">
          {GIF_CATEGORIES.map((c) => {
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
                {CAT_ICONS[c] || <Sparkles size={20} />}
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
          placeholder="GIF dhoondo…"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#2f3035] outline-none placeholder:text-[#80848e]"
        />
      </div>

      {/* Vertical scrolling masonry grid */}
      <div className="thin-scroll columns-2 gap-2 overflow-y-auto p-2 [&>*]:mb-2">
        {items.map((g) => (
          <button
            key={g.id}
            onClick={() => handlePick(g)}
            className="relative block w-full break-inside-avoid overflow-hidden rounded-xl bg-black/5 transition hover:brightness-95 active:scale-95"
          >
            <img
              src={g.preview}
              alt=""
              loading="lazy"
              draggable={false}
              className="block h-auto w-full"
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
    </div>
  );
}
