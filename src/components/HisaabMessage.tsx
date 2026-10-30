"use client";
// Fun — Hisaab Race: tez hisaab, pehla sahi jawab chat me — 10 points
import { Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { parseHisaab } from "@/lib/games";
import type { Message } from "@/lib/types";

export default function HisaabMessage({ m }: { m: Message }) {
  const st: any = parseHisaab(m.caption);
  const members = useStore((s) => s.members);

  if (!st) return <p className="text-sm italic text-[#80848e]">Game load nahi hua</p>;

  const nameOf = (id: string | null | undefined) => members.find((x) => x.id === id)?.name || "Member";
  const shortName = (id: string) => nameOf(id).split(" ")[0];
  const idOf = (v: any): string | null =>
    typeof v === "string" ? v : v && typeof v === "object" ? (v.by || v.id || v.winner || null) : null;

  const scores: [string, number][] = st.scores && typeof st.scores === "object"
    ? Object.entries(st.scores as Record<string, number>).sort((a, b) => b[1] - a[1])
    : [];
  const lastWinId = idOf(st.lastWin);
  const winnerId = idOf(st.winner);

  return (
    <div className="mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        🔢 Hisaab Race
        <span className="ml-auto rounded-full bg-[#5865f2]/10 px-2 py-0.5 text-[10px] font-extrabold normal-case tracking-normal text-[#5865f2]">
          Round {st.round}/{st.total}
        </span>
      </p>

      <p className="py-1 text-center text-2xl font-extrabold text-[#2f3035]">{st.q} = ?</p>

      <p className="mt-1 text-center text-xs text-[#80848e]">
        💬 Jawab chat me number likh kar bhejo — pehle sahi jawab par 10 points
      </p>

      {lastWinId && (
        <p className="mt-2 text-center text-xs font-semibold text-[#5c5e66]">
          ⚡ Pichla sawal {nameOf(lastWinId)} ne jeeta
        </p>
      )}

      {scores.length > 0 && (
        <p className="mt-2.5 text-xs font-semibold text-[#5c5e66]">
          🏆 {scores.map(([id, pts]) => `${shortName(id)}: ${pts}`).join(" · ")}
        </p>
      )}

      {st.done && winnerId && (
        <div className="mt-3 rounded-lg bg-[#f5a623]/10 px-3 py-2.5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-extrabold text-[#2f3035]">
            <Trophy size={15} className="text-[#f5a623]" /> {nameOf(winnerId)} jeet gaya!
          </p>
        </div>
      )}
    </div>
  );
}
