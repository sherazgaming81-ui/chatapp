"use client";
// I3 — Daily Paheli message card
import { Puzzle, CheckCircle2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { parseRiddle } from "@/lib/games";
import type { Message } from "@/lib/types";

export default function RiddleMessage({ m }: { m: Message }) {
  const caption = useStore((s) => s.messages.find((x) => x.id === m.id)?.caption || "");
  const members = useStore((s) => s.members);
  const st = parseRiddle(caption);
  if (!st) return <p className="text-sm italic text-[#80848e]">Paheli load nahi hui</p>;
  const winnerName = st.winner ? members.find((x) => x.id === st.winner)?.name || "Kisi ne" : null;

  return (
    <div className="mt-1.5 w-full max-w-sm rounded-xl border border-[#d4af37]/40 bg-gradient-to-br from-[#d4af37]/[0.12] to-white p-3.5 soft-shadow">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#9a7b1e]">
        <Puzzle size={13} /> Aaj ki Paheli 🧩
      </p>
      <p className="text-[15px] font-bold leading-snug text-[#2f3035]">{st.q}</p>
      {st.solved ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#23a55a]/[0.1] px-2.5 py-2 text-[13px] font-bold text-[#1a7a55]">
          <CheckCircle2 size={15} /> {winnerName} ne solve kar li! 🎉
        </p>
      ) : (
        <p className="mt-2 text-[12px] font-semibold text-[#80848e]">Pehle sahi jawab bhejo — winner yahin announce hoga! 💬</p>
      )}
    </div>
  );
}
