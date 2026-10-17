"use client";
// WhatsApp-style emoji picker: search top, category icons, big grid, bottom tabs (Emoji | GIF | Sticker)
import { useMemo, useState } from "react";
import {
  Search, Clock, Smile, Pizza, Car, Lightbulb, Heart, Trophy, PawPrint, Sticker, Film,
} from "lucide-react";
import { EMOJI_CATS, searchEmojis, getRecentEmojis, pushRecentEmoji } from "@/lib/emoji";
import StickerPicker from "@/components/StickerPicker";
import GifPicker from "@/components/GifPicker";
import type { GiphyItem } from "@/lib/giphy";

type Tab = "emoji" | "gif" | "sticker";

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
  onSticker,
  onGif,
  onClose,
  onlyEmoji = false,
  fill = false,
}: {
  onPick: (e: string) => void;
  onSticker?: (id: string) => void;
  onGif?: (g: GiphyItem) => void;
  onClose: () => void;
  /** sirf emoji tab (reactions ke liye) — GIF/Sticker tabs chhupao */
  onlyEmoji?: boolean;
  /** parent fixed-size box me poora bharo (absolute inset-0) */
  fill?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("emoji");
  const [cat, setCat] = useState("recent");
  const [q, setQ] = useState("");
  const recent = useMemo(() => getRecentEmojis(), [cat, tab]);

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
    `shrink-0 rounded-full p-2 transition ${active ? "bg-[#5865f2]/15 text-[#5865f2]" : "text-[#8a8d94] hover:bg-black/5 hover:text-[#5c5e66]"}`;

  return (
    <div className={`pop-in ${fill ? "absolute inset-0" : "absolute bottom-full left-0"} z-40 mb-2 flex h-[440px] max-h-[70vh] w-[380px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl`}>
      {/* Search (emoji tab only — GIF/Sticker tabs have their own search) */}
      {tab === "emoji" && (
      <div className="shrink-0 px-3 pt-3">
        <div className="flex items-center gap-2 rounded-full bg-black/5 px-3.5 py-2">
          <Search size={16} className="shrink-0 text-[#80848e]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search emoji"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-[14px] text-[#2f3035] outline-none placeholder:text-[#9a9ca3]"
          />
        </div>
      </div>
      )}

      {/* Category icons row (emoji tab only) */}
      {tab === "emoji" && (
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
      )}

      {/* Content */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {tab === "sticker" ? (
          <StickerPicker onPick={(url) => onSticker?.(url)} />
        ) : tab === "gif" ? (
          <GifPicker onPick={(g) => onGif?.(g)} />
        ) : list.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-[#80848e]">
            {q.trim() ? "Kuch nahi mila" : "Abhi koi recent emoji nahi — koi emoji bhejo!"}
          </p>
        ) : (
          <>
            <p className="sticky top-0 bg-white px-2 py-1.5 text-[13px] font-semibold text-[#5c5e66]">
              {q.trim() ? "Search results" : cat === "recent" ? "Recently used" : catDef?.name}
            </p>
            <div className="grid grid-cols-9 gap-0.5">
              {list.map((e, i) => (
                <button
                  key={`${e}-${i}`}
                  onClick={() => pick(e)}
                  className="rounded-lg p-1 text-[26px] leading-[1.4] hover:bg-black/5 active:scale-90"
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom tabs: Emoji | GIF | Sticker (onlyEmoji par chhupao) */}
      {!onlyEmoji && (
      <div className="flex shrink-0 border-t border-black/10">
        {(
          [
            { id: "emoji" as Tab, label: "Emoji", icon: <Smile size={19} /> },
            { id: "gif" as Tab, label: "GIF", icon: <Film size={19} /> },
            { id: "sticker" as Tab, label: "Sticker", icon: <Sticker size={19} /> },
          ]
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setQ(""); }}
            className={`relative flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium transition ${
              tab === t.id ? "text-[#5865f2]" : "text-[#8a8d94] hover:text-[#5c5e66]"
            }`}
          >
            {t.icon}
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 h-0.5 w-10 rounded-full bg-[#5865f2]" />}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}

