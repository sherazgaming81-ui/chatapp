"use client";
// B8 — custom emoji picker (NOT the OS keyboard): categories, Recent, search
import { useMemo, useState } from "react";
import { Search, Clock } from "lucide-react";
import { EMOJI_CATS, searchEmojis, getRecentEmojis, pushRecentEmoji } from "@/lib/emoji";

export default function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const [cat, setCat] = useState("recent");
  const [q, setQ] = useState("");
  const recent = useMemo(() => getRecentEmojis(), [cat]);

  const list = useMemo(() => {
    if (q.trim()) return searchEmojis(q);
    if (cat === "recent") return recent;
    return EMOJI_CATS.find((c) => c.id === cat)?.emojis || [];
  }, [q, cat, recent]);

  const pick = (e: string) => {
    pushRecentEmoji(e);
    onPick(e);
  };

  return (
    <div className="pop-in glass-strong absolute bottom-full left-0 z-40 mb-2 flex h-80 w-[320px] max-w-[86vw] flex-col overflow-hidden rounded-xl">
      <div className="flex shrink-0 items-center gap-2 border-b border-black/10 px-3 py-2">
        <Search size={15} className="shrink-0 text-[#80848e]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Emoji dhoondo…"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#2f3035] outline-none placeholder:text-[#80848e]"
        />
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {list.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-[#80848e]">
            {q.trim() ? "Kuch nahi mila" : "Abhi koi recent emoji nahi — koi emoji bhejo!"}
          </p>
        ) : (
          <div className="grid grid-cols-8 gap-0.5">
            {list.map((e, i) => (
              <button key={`${e}-${i}`} onClick={() => pick(e)} className="rounded-lg p-1.5 text-2xl leading-none hover:bg-black/5 active:scale-90">
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-1 overflow-x-auto border-t border-black/10 px-2 py-1.5">
        <button
          onClick={() => { setCat("recent"); setQ(""); }}
          title="Recent"
          className={`rounded-lg p-2 text-xl ${cat === "recent" && !q ? "bg-[#5865f2]/15" : "hover:bg-black/5"}`}
        >
          <Clock size={18} className="text-[#5c5e66]" />
        </button>
        {EMOJI_CATS.map((c) => (
          <button
            key={c.id}
            onClick={() => { setCat(c.id); setQ(""); }}
            title={c.name}
            className={`rounded-lg px-2 py-1.5 text-xl leading-none ${cat === c.id && !q ? "bg-[#5865f2]/15" : "hover:bg-black/5"}`}
          >
            {c.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
