"use client";
// Sticker picker — 100% SELF-HOSTED. Koi API nahi!
// Stickers apne server se ayenge (abhi download ho rahe hain).
import { useState } from "react";
import { Search } from "lucide-react";

// Jab stickers download ho jayenge, yahan categories ayengi
const STICKER_CATS: string[] = [];

export default function StickerPicker({ onPick }: { onPick: (url: string) => void }) {
  const [q, setQ] = useState("");
  void onPick;
  void q;
  void setQ;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-black/10 px-3 py-2">
        <Search size={15} className="shrink-0 text-[#80848e]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sticker dhoondo…"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#2f3035] outline-none placeholder:text-[#80848e]"
        />
      </div>

      {STICKER_CATS.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="text-5xl">🎨</span>
          <p className="text-sm font-bold text-[#2f3035]">Stickers aa rahe hain!</p>
          <p className="max-w-[220px] text-xs text-[#80848e]">
            Apni sticker library tayar ho rahi hai. Thori der me yahan dher sare stickers honge!
          </p>
          <p className="text-[10px] text-[#80848e]">🏠 100% apni — koi limit nahi!</p>
        </div>
      ) : (
        <div className="thin-scroll grid min-h-0 flex-1 grid-cols-4 gap-2 overflow-y-auto p-3">
          {/* Stickers yahan ayenge */}
        </div>
      )}
    </div>
  );
}
