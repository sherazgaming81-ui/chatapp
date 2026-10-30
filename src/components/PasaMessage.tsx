"use client";
// Fun — Pasa Race (Ludo style): 2–4 players join, host start, bari bari pasa — 58 tak race
// Board: asal 15x15 Ludo board (4 rang ke ghar, patri, home columns, center) — reference wali classic mapping
import { Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { parsePasa, PASA_COLORS, PASA_SAFE_CELLS, pasaCell } from "@/lib/games";
import { joinPasa, startPasa, rollPasa } from "@/lib/db";
import type { Message } from "@/lib/types";

interface PPlayer { id: string; pos: number; host?: boolean }

// 52-cell patri: global cell index -> [row, col] (15x15 board, 0-indexed)
const PATH: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];
// [row, col] -> global cell lookup
const CELL_OF_RC = new Map<string, number>();
PATH.forEach(([r, c], i) => CELL_OF_RC.set(`${r},${c}`, i));

// har player ki home-stretch: progress 53..57 -> 5 rang-dar cells
const HOME_CELLS: [number, number][][] = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],       // 🔴 red — left arm ki darmiyani row
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],       // 🟢 green — top arm ki darmiyani column
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],   // 🟡 yellow — right arm ki darmiyani row
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],   // 🔵 blue — bottom arm ki darmiyani column
];
const HOME_RC = new Map<string, number>();
HOME_CELLS.forEach((cells, idx) => cells.forEach(([r, c]) => HOME_RC.set(`${r},${c}`, idx)));

const HEX = ["#e63329", "#00a651", "#f5a800", "#1e6fd9"]; // red, green, yellow, blue
const YARDS: { r: number; c: number }[] = [
  { r: 0, c: 0 },   // red — top-left
  { r: 0, c: 9 },   // green — top-right
  { r: 9, c: 9 },   // yellow — bottom-right
  { r: 9, c: 0 },   // blue — bottom-left
];

function TokenDot({ idx, small, pulse }: { idx: number; small?: boolean; pulse?: boolean }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)] ${pulse ? "animate-pulse" : ""}`}
      style={{
        backgroundColor: HEX[idx],
        width: small ? "72%" : "82%",
        height: small ? "72%" : "82%",
      }}
    />
  );
}

function LudoBoard({ players, turnId, running }: { players: PPlayer[]; turnId: string | null; running: boolean }) {
  // kis cell par kaun se players hain
  const tokensAt = new Map<string, number[]>();
  const inBase = new Set<number>();
  const finishedIdx: number[] = [];
  const put = (r: number, c: number, idx: number) => {
    const k = `${r},${c}`;
    const arr = tokensAt.get(k) || [];
    arr.push(idx);
    tokensAt.set(k, arr);
  };
  players.forEach((p, idx) => {
    if (p.pos >= 58) finishedIdx.push(idx);
    else if (p.pos >= 53) { const rc = HOME_CELLS[idx][p.pos - 53]; if (rc) put(rc[0], rc[1], idx); }
    else if (p.pos >= 1) {
      const cell = pasaCell(idx, p.pos);
      const rc = cell !== null ? PATH[cell] : null;
      if (rc) put(rc[0], rc[1], idx);
    } else inBase.add(idx);
  });
  const turnIdx = turnId ? players.findIndex((p) => p.id === turnId) : -1;

  const cellBg = (r: number, c: number): string => {
    // yards (6x6 kone)
    if (r < 6 && c < 6) return HEX[0];
    if (r < 6 && c > 8) return HEX[1];
    if (r > 8 && c > 8) return HEX[2];
    if (r > 8 && c < 6) return HEX[3];
    // center overlay se dhaka hai
    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return "#ffffff";
    // home-stretch cells
    const h = HOME_RC.get(`${r},${c}`);
    if (h !== undefined) return HEX[h];
    // start cells (har player ka pehla cell usi ke rang ka)
    const cell = CELL_OF_RC.get(`${r},${c}`);
    if (cell !== undefined && cell % 13 === 0) return HEX[cell / 13];
    return "#ffffff";
  };

  return (
    <div className="relative mx-auto mt-2.5 w-full max-w-[336px] select-none">
      <div className="grid overflow-hidden rounded-md border-2 border-black/50" style={{ gridTemplateColumns: "repeat(15, minmax(0,1fr))" }}>
        {Array.from({ length: 225 }).map((_, i) => {
          const r = Math.floor(i / 15), c = i % 15;
          const k = `${r},${c}`;
          const cell = CELL_OF_RC.get(k);
          const isSafe = cell !== undefined && (PASA_SAFE_CELLS as number[]).includes(cell);
          const toks = tokensAt.get(k) || [];
          return (
            <div key={i} className="relative flex aspect-square items-center justify-center border-[0.5px] border-black/25" style={{ backgroundColor: cellBg(r, c) }}>
              {isSafe && toks.length === 0 && <span className="text-[9px] leading-none text-black/45">★</span>}
              {toks.length > 0 && (
                <span className={`flex flex-wrap items-center justify-center ${toks.length > 1 ? "h-full w-full p-[1px]" : "h-full w-full"}`}>
                  {toks.map((idx) => (
                    <span key={idx} className={`flex items-center justify-center ${toks.length > 1 ? "h-1/2 w-1/2" : "h-full w-full"}`}>
                      <TokenDot idx={idx} small={toks.length > 1} pulse={running && idx === turnIdx} />
                    </span>
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* yards ke andar safed box + 4 circles (classic look) */}
      {YARDS.map((y, idx) => (
        <div key={idx} className="absolute" style={{ left: `${(y.c / 15) * 100}%`, top: `${(y.r / 15) * 100}%`, width: "40%", height: "40%" }}>
          <div className="absolute rounded-[18%] bg-white" style={{ left: "16%", top: "16%", width: "68%", height: "68%" }}>
            <div className="grid h-full w-full grid-cols-2 place-items-center p-[8%]">
              {[0, 1, 2, 3].map((slot) => {
                // token center ke sab se qareeb wale circle me: red=bottom-right(3), green=bottom-left(2), yellow=top-left(0), blue=top-right(1)
                const tokenSlot = [3, 2, 0, 1][idx];
                return (
                  <span key={slot} className="flex aspect-square w-[72%] items-center justify-center rounded-full border-[2.5px] bg-white" style={{ borderColor: HEX[idx] }}>
                    {inBase.has(idx) && slot === tokenSlot && <TokenDot idx={idx} pulse={running && idx === turnIdx} />}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {/* center — 4 triangles (upar green, right yellow, neeche blue, left red) */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: "40%", top: "40%", width: "20%", height: "20%",
          background: "conic-gradient(from 45deg, #f5a800 0deg 90deg, #1e6fd9 90deg 180deg, #e63329 180deg 270deg, #00a651 270deg 360deg)",
        }}
      >
        {finishedIdx.length > 0 && (
          <span className="flex gap-0.5 rounded-full bg-white/85 p-0.5">
            {finishedIdx.map((idx) => (
              <span key={idx} className="flex h-3.5 w-3.5 items-center justify-center"><TokenDot idx={idx} /></span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

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

      {/* asal Ludo board */}
      <LudoBoard players={players} turnId={turnId} running={!!st.started && !st.done} />

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
