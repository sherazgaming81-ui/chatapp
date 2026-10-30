"use client";
// Fun — Pasa Race (Ludo style): 2–4 players join, host start, bari bari pasa — 58 tak race
import { Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { parsePasa, PASA_COLORS, PASA_SAFE_CELLS, pasaCell } from "@/lib/games";
import { joinPasa, startPasa, rollPasa } from "@/lib/db";
import type { Message } from "@/lib/types";

interface PPlayer { id: string; pos: number; host?: boolean }

export default function PasaMessage({ m }: { m: Message }) {
  const st: any = parsePasa(m.caption);
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.me);

  if (!st) return <p className="text-sm italic text-[#80848e]">Game load nahi hua</p>;

  const nameOf = (id: string | null | undefined) => members.find((x) => x.id === id)?.name || "Member";
  const idOf = (v: any): string | null =>
    typeof v === "string" ? v : v && typeof v === "object" ? (v.by || v.id || v.winner || null) : null;

  // players normalize: string[] + pos record/array, ya { id, pos }[]
  const posOfRaw = (id: string, idx: number, p: any): number => {
    if (p && typeof p === "object" && typeof (p.pos ?? p.position) === "number") return p.pos ?? p.position;
    const rec: any = st.pos && typeof st.pos === "object" ? st.pos : st.positions && typeof st.positions === "object" ? st.positions : null;
    if (Array.isArray(rec) && typeof rec[idx] === "number") return rec[idx];
    if (rec && typeof rec[id] === "number") return rec[id];
    return 0;
  };
  const players: PPlayer[] = Array.isArray(st.players)
    ? st.players.map((p: any, idx: number) => {
        const id = typeof p === "string" ? p : (p?.id || p?.by || "");
        return { id, pos: posOfRaw(id, idx, p), host: !!(p && typeof p === "object" && p.host) };
      }).filter((p: PPlayer) => !!p.id)
    : [];

  const hostId: string | null = typeof st.host === "string" ? st.host : players.find((p) => p.host)?.id || null;
  const isHost = (p: PPlayer) => p.host || (hostId !== null && p.id === hostId);
  const joined = players.some((p) => p.id === me);
  const iAmHost = hostId !== null ? me === hostId : players[0]?.id === me;

  const turnId: string | null = typeof st.turn === "number" ? players[st.turn]?.id || null : idOf(st.turn) || (typeof st.turn === "string" ? st.turn : null);
  const winnerId = idOf(st.winner);

  const lr: any = st.lastRoll && typeof st.lastRoll === "object" ? st.lastRoll : null;
  const lrById = lr ? idOf(lr) : null;
  const lrVal = lr ? (lr.v ?? lr.roll ?? lr.value ?? lr.n) : null;

  const logLines: string[] = Array.isArray(st.log) ? st.log.filter((x: unknown) => typeof x === "string").slice(-4) : [];

  const isSafe = (cell: number): boolean => {
    try {
      if (Array.isArray(PASA_SAFE_CELLS)) return PASA_SAFE_CELLS.includes(cell);
      if (PASA_SAFE_CELLS && typeof (PASA_SAFE_CELLS as any).has === "function") return (PASA_SAFE_CELLS as any).has(cell);
    } catch { /* ignore */ }
    return false;
  };
  const cellContent = (cell: number): string => {
    for (let idx = 0; idx < players.length; idx++) {
      const p = players[idx];
      if (p.pos >= 1 && p.pos <= 52) {
        try { if (pasaCell(idx, p.pos) === cell) return PASA_COLORS[idx] || "🔵"; } catch { /* ignore */ }
      }
    }
    return isSafe(cell) ? "⭐" : "⬜";
  };

  return (
    <div className="mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        🎲 Pasa Race — Ludo
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-extrabold normal-case tracking-normal ${st.done ? "bg-black/[0.06] text-[#80848e]" : st.started ? "bg-[#23a55a]/15 text-[#178a4c]" : "bg-[#f5a623]/15 text-[#9a6a00]"}`}>
          {st.started ? (st.done ? "Khatam" : "🟢 Chal raha hai") : "Players ka intezar"}
        </span>
      </p>

      {/* players */}
      <div className="space-y-1">
        {players.map((p, idx) => (
          <p key={p.id} className={`flex items-center gap-1.5 text-[13px] ${turnId === p.id && st.started && !st.done ? "font-extrabold text-[#2f3035]" : "font-semibold text-[#5c5e66]"}`}>
            <span>{PASA_COLORS[idx] || "🔵"}</span>
            <span className="min-w-0 flex-1 truncate">
              {nameOf(p.id)}{isHost(p) ? " (host)" : ""}
            </span>
            <span className="shrink-0 text-xs tabular-nums">
              {p.pos >= 58 ? "🏁 Finish" : p.pos >= 1 ? `🏃 ${p.pos}/58` : "🏠 Base"}
            </span>
          </p>
        ))}
        {players.length === 0 && <p className="text-sm italic text-[#80848e]">Abhi koi player nahi — pehle join karo!</p>}
      </div>

      {/* track strip — 52 cells, 4 rows x 13 */}
      <div className="mt-2.5 flex flex-wrap leading-tight">
        {Array.from({ length: 52 }).map((_, cell) => (
          <span key={cell} className="w-[calc(100%/13)] text-center text-[13px] leading-tight">
            {cellContent(cell)}
          </span>
        ))}
      </div>

      {st.started && !st.done && turnId && (
        <p className={`mt-2.5 text-center text-sm ${turnId === me ? "rounded-lg bg-[#5865f2]/10 px-2 py-1.5 font-extrabold text-[#5865f2]" : "font-semibold text-[#5c5e66]"}`}>
          🎯 {nameOf(turnId)} ki bari hai{turnId === me ? " — tumhari!" : ""}
        </p>
      )}

      {lr && lrById && lrVal !== null && lrVal !== undefined && (
        <p className="mt-1.5 text-center text-xs font-semibold text-[#5c5e66]">
          🎲 {nameOf(lrById)} ko {lrVal} aaya
        </p>
      )}

      {logLines.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {logLines.map((line, i) => (
            <p key={i} className="truncate text-[11px] text-[#80848e]">{line}</p>
          ))}
        </div>
      )}

      {!st.started && (
        <div className="mt-3 space-y-1.5">
          {!joined && players.length < 4 && (
            <button onClick={() => joinPasa(m.id)} className="btn btn-blurple w-full py-2.5 text-sm">➕ Join karo</button>
          )}
          {iAmHost && players.length >= 2 && (
            <button onClick={() => startPasa(m.id)} className="w-full rounded-lg bg-[#23a55a] px-3 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98]">▶️ Game shuru karo</button>
          )}
          {players.length < 2 && (
            <p className="text-center text-xs text-[#80848e]">Kam se kam 2 players chahiye</p>
          )}
        </div>
      )}

      {st.started && !st.done && turnId === me && (
        <button onClick={() => rollPasa(m.id)} className="btn btn-blurple mt-3 w-full py-3 text-[15px]">🎲 Pasa phenko</button>
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
