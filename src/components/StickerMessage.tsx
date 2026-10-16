"use client";
// B10 — Sticker message: CSS-based sticker render
import { getSticker, STICKERS } from "@/lib/games";
import type { Message } from "@/lib/types";

export default function StickerMessage({ m }: { m: Message }) {
  const st = getSticker(m.text);
  if (!st) return <p className="text-sm italic text-[#80848e]">Sticker load nahi hua</p>;
  return (
    <div
      className="mt-1 inline-flex max-w-[220px] flex-col items-center rounded-2xl px-5 py-4 text-center soft-shadow transition hover:scale-[1.03] active:scale-95"
      style={{ background: st.bg }}
    >
      <span className="text-5xl leading-none drop-shadow">{st.emoji}</span>
      <span className="mt-2 text-[15px] font-extrabold leading-tight" style={{ color: st.fg }}>{st.text}</span>
    </div>
  );
}

/** Sticker picker grid (EmojiPicker me tab) */
export function StickerGrid({ onPick }: { onPick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {STICKERS.map((st) => (
        <button
          key={st.id}
          onClick={() => onPick(st.id)}
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition hover:brightness-95 active:scale-95"
          style={{ background: st.bg }}
        >
          <span className="text-2xl leading-none">{st.emoji}</span>
          <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold" style={{ color: st.fg }}>{st.text}</span>
        </button>
      ))}
    </div>
  );
}
