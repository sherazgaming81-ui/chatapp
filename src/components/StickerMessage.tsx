"use client";
// B10 — Sticker message: WhatsApp-style bubble-LESS render (transparent, sirf sticker)
import { getSticker, STICKERS } from "@/lib/games";
import type { Message } from "@/lib/types";

export default function StickerMessage({ m }: { m: Message }) {
  const url = m.src || m.text;
  // URL sticker (image) — bubble-less, transparent
  if (url && /^https?:\/\//i.test(url)) {
    return (
      <img
        src={url}
        alt="Sticker"
        draggable={false}
        className="mt-1 max-h-44 w-auto max-w-[180px] select-none object-contain transition hover:scale-[1.04] active:scale-95"
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.18))" }}
        loading="lazy"
      />
    );
  }
  // Emoji sticker — bubble-less, bada emoji
  const st = getSticker(m.text);
  if (!st) return <p className="text-sm italic text-[#80848e]">Sticker load nahi hua</p>;
  return (
    <div
      className="mt-1 inline-flex select-none flex-col items-center text-center transition hover:scale-[1.04] active:scale-95"
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.18))" }}
    >
      <span className="text-7xl leading-none">{st.emoji}</span>
      {st.text && <span className="mt-1 text-[13px] font-bold leading-tight text-[#2f3035]">{st.text}</span>}
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
