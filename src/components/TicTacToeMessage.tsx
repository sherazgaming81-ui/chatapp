"use client";
// I2 — TicTacToe message: challenge → accept → play
import { useStore } from "@/lib/store";
import { parseTTT } from "@/lib/games";
import { acceptTicTacToe, tttMove } from "@/lib/db";
import type { Message } from "@/lib/types";

export default function TicTacToeMessage({ m }: { m: Message }) {
  const caption = useStore((s) => s.messages.find((x) => x.id === m.id)?.caption || "");
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.me);
  const st = parseTTT(caption);

  if (!st) return <p className="text-sm italic text-[#80848e]">Game load nahi hua</p>;

  const nameOf = (id: string) => members.find((x) => x.id === id)?.name || "Member";
  const isPlayer = me === st.challenger || me === st.opponent;
  const myTurn = st.accepted && !st.winner && st.turn === me;

  // challenge accept nahi hua
  if (!st.accepted) {
    const canAccept = me === st.opponent;
    return (
      <div className="mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 text-center soft-shadow">
        <p className="text-3xl">⭕❌</p>
        <p className="mt-1 text-[15px] font-bold text-[#2f3035]">TicTacToe Challenge!</p>
        <p className="mt-0.5 text-[13px] text-[#5c5e66]">{nameOf(st.challenger)} ne {nameOf(st.opponent)} ko challenge kiya</p>
        {canAccept ? (
          <button onClick={() => acceptTicTacToe(m.id)} className="mt-2.5 rounded-lg bg-[#23a55a] px-5 py-2 text-sm font-extrabold text-white transition active:scale-95">
            Accept karo ✅
          </button>
        ) : (
          <p className="mt-2 text-xs text-[#80848e]">{nameOf(st.opponent)} ke jawab ka intezar…</p>
        )}
      </div>
    );
  }

  const winnerName = st.winner === "draw" ? null : st.winner ? nameOf(st.winner) : null;

  return (
    <div className="mt-1.5 w-full max-w-[280px] rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <div className="mb-2 flex items-center justify-between text-[12px] font-bold">
        <span className={st.challenger === me ? "text-[#5865f2]" : "text-[#5c5e66]"}>
          ❌ {nameOf(st.challenger)}{st.challenger === me ? " (aap)" : ""}
        </span>
        <span className={st.opponent === me ? "text-[#5865f2]" : "text-[#5c5e66]"}>
          ⭕ {nameOf(st.opponent)}{st.opponent === me ? " (aap)" : ""}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {st.board.map((cell, i) => (
          <button
            key={i}
            disabled={!myTurn || !!cell || !!st.winner}
            onClick={() => tttMove(m.id, i)}
            className={`grid h-16 place-items-center rounded-lg text-3xl font-extrabold transition ${
              cell ? "bg-black/[0.04]" : myTurn ? "bg-[#5865f2]/[0.07] hover:bg-[#5865f2]/[0.15] active:scale-95" : "bg-black/[0.04]"
            } ${cell === "X" ? "text-[#5865f2]" : "text-[#e0245e]"}`}
          >
            {cell === "X" ? "❌" : cell === "O" ? "⭕" : ""}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[13px] font-bold text-[#5c5e66]">
        {st.winner === "draw" ? "Draw ho gaya! 🤝" : winnerName ? `🎉 ${winnerName} jeet gaya!` : myTurn ? "Aapki baari hai!" : `${nameOf(st.turn)} ki baari…`}
      </p>
      {!isPlayer && <p className="mt-1 text-center text-[11px] text-[#a0a3ab]">Dekhne wale mode 👀</p>}
    </div>
  );
}
