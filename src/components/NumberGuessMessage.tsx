"use client";
// Fun — Number Guess: 1–100 me chhupa number, chat me guess karo — up/down hints
import { Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { parseNumGuess } from "@/lib/games";
import type { Message } from "@/lib/types";

export default function NumberGuessMessage({ m }: { m: Message }) {
  const st: any = parseNumGuess(m.caption);
  const members = useStore((s) => s.members);

  if (!st) return <p className="text-sm italic text-[#80848e]">Game load nahi hua</p>;

  const nameOf = (id: string | null | undefined) => members.find((x) => x.id === id)?.name || "Member";
  const idOf = (v: any): string | null =>
    typeof v === "string" ? v : v && typeof v === "object" ? (v.by || v.id || v.winner || null) : null;

  const list: any[] = Array.isArray(st.guesses) ? st.guesses : Array.isArray(st.list) ? st.list : [];
  const shown = list.slice(-8);
  const winnerId = idOf(st.winner);
  const target = typeof st.target === "number" ? st.target : null;

  return (
    <div className="mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        🎯 Number Guess
        <span className="ml-auto rounded-full bg-[#5865f2]/10 px-2 py-0.5 text-[10px] font-extrabold normal-case tracking-normal text-[#5865f2]">
          {list.length} guesses
        </span>
      </p>

      {!st.done && (
        <p className="text-sm text-[#5c5e66]">
          1–100 me ek number chhupa hai — chat me number likh kar guess karo
        </p>
      )}

      {shown.length > 0 && (
        <div className="mt-2 space-y-1">
          {shown.map((g: any, i: number) => {
            const n = g && typeof g === "object" ? (g.n ?? g.num ?? g.v) : g;
            const byId = g && typeof g === "object" ? idOf(g) : null;
            const h = g && typeof g === "object" ? (g.h || g.hint || "") : "";
            return (
              <p key={i} className="flex items-center gap-1.5 text-[13px] text-[#2f3035]">
                <b className="tabular-nums">{n}</b>
                <span className="text-[#80848e]">— {byId ? nameOf(byId) : "Member"}</span>
                <span className="font-semibold text-[#5c5e66]">
                  {h === "up" ? "🔼 bara hai" : h === "down" ? "🔽 chhota hai" : "🎯 SAHI!"}
                </span>
              </p>
            );
          })}
        </div>
      )}

      {st.done && (
        <div className="mt-3 rounded-lg bg-[#f5a623]/10 px-3 py-2.5 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-extrabold text-[#2f3035]">
            <Trophy size={15} className="text-[#f5a623]" />
            {winnerId ? nameOf(winnerId) : "Koi"} ne {target ?? "?"} guess kar liya — kul {list.length} guesses
          </p>
        </div>
      )}
    </div>
  );
}
