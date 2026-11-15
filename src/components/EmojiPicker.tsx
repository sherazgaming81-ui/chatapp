"use client";
// Emoji picker — sirf emoji (GIF/Sticker tabs business cleanup me remove ho gaye)
import { useMemo, useState } from "react";
import {
  Search, Clock, Smile, Pizza, Car, Lightbulb, Heart, Trophy, PawPrint,
} from "lucide-react";
import { EMOJI_CATS, searchEmojis, getRecentEmojis, pushRecentEmoji } from "@/lib/emoji";

interface CatDef { id: string; name: string; icon: React.ReactNode; emojis: string[] }

const smileys = EMOJI_CATS.find((c) => c.id === "smileys")?.emojis ?? [];
const people = EMOJI_CATS.find((c) => c.id === "people")?.emojis ?? [];

const CATS: CatDef[] = [
  { id: "smileys", name: "Smileys & People", icon: <Smile size={20} />, emojis: [...smileys, ...people] },
  { id: "nature", name: "Animals & Nature", icon: <PawPrint size={20} />, emojis: EMOJI_CATS.find((c) => c.id === "nature")?.emojis ?? [] },
  { id: "food", name: "Food & Drink", icon: <Pizza size={20} />, emojis: EMOJI_CATS.find((c) => c.id === "food")?.emojis ?? [] },
  { id: "activity", name: "Activity", icon: <Trophy size={20} />, emojis: EMOJI_CATS.find((c) => c.id === "activity")?.emojis ?? [] },
  { id: "travel", name: "Travel & Places", icon: <Car size={20} />, emojis: EMOJI_CATS.find((c) => c.id === "travel")?.emojis ?? [] },
  { id: "objects", name: "Objects", icon: <Lightbulb size={20} />, emojis: EMOJI_CATS.find((c) => c.id === "objects")?.emojis ?? [] },
  { id: "symbols", name: "Symbols", icon: <Heart size={20} />, emojis: EMOJI_CATS.find((c) => c.id === "symbols")?.emojis ?? [] },
];

export default function EmojiPicker({
  onPick,
  onClose,
  onlyEmoji = false,
  fill = false,
}: {
  onPick: (e: string) => void;
  onClose: () => void;
  /** reactions ke liye istemal — layout waisa hi rehta hai */
  onlyEmoji?: boolean;
  /** parent fixed-size box me poora bharo (absolute inset-0) */
  fill?: boolean;
}) {
  void onlyEmoji;
  void onClose;
  const [cat, setCat] = useState("recent");
  const [q, setQ] = useState("");
  const recent = useMemo(() => getRecentEmojis(), [cat]);

  const catDef = CATS.find((c) => c.id === cat);
  const list = useMemo(() => {
    if (q.trim()) return searchEmojis(q);
    if (cat === "recent") return recent;
    return catDef?.emojis ?? [];
  }, [q, cat, recent, catDef]);

  const pick = (e: string) => {
    pushRecentEmoji(e);
    onPick(e);
  };

  const catBtn = (active: boolean) =>
    `shrink-0 rounded-full p-2 transition ${active ? "bg-[#4f8cff]/15 text-[#8dbcff]" : "text-[#8a8d94] hover:bg-white/[0.06] hover:text-[#b6bcc7]"}`;

  return (
    <div className={`pop-in ${fill ? "absolute inset-0" : "absolute bottom-full left-0"} z-40 mb-2 flex h-[440px] max-h-[70vh] w-[380px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111114] shadow-2xl`}>
      <div className="shrink-0 px-3 pt-3">
        <div className="flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-2">
          <Search size={16} className="shrink-0 text-[#8b93a1]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search emoji"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-[14px] text-[#f4f6f8] outline-none placeholder:text-[#8b93a1]"
          />
        </div>
      </div>

      <div className="thin-scroll-x flex shrink-0 items-center gap-0.5 overflow-x-auto px-2.5 py-2">
        <button onClick={() => { setCat("recent"); setQ(""); }} title="Recent" className={catBtn(cat === "recent" && !q)}>
          <Clock size={20} />
        </button>
        {CATS.map((c) => (
          <button key={c.id} onClick={() => { setCat(c.id); setQ(""); }} title={c.name} className={catBtn(cat === c.id && !q)}>
            {c.icon}
          </button>
        ))}
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {list.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-[#8b93a1]">
            {q.trim() ? "Kuch nahi mila" : "Abhi koi recent emoji nahi — koi emoji bhejo!"}
          </p>
        ) : (
          <>
            <p className="sticky top-0 bg-[#111114] px-2 py-1.5 text-[13px] font-semibold text-[#b6bcc7]">
              {q.trim() ? "Search results" : cat === "recent" ? "Recently used" : catDef?.name}
            </p>
            <div className="grid grid-cols-9 gap-0.5">
              {list.map((e, i) => (
                <button
                  key={`${e}-${i}`}
                  onClick={() => pick(e)}
                  className="rounded-lg p-1 text-[26px] leading-[1.4] hover:bg-white/[0.06] active:scale-90"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
