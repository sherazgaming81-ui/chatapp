"use client";
// Fun — Pasa Race (Ludo FULL): 2–4 players (+ bots), 2/4 gotiyan, teams, 10s timer,
// capture, tournament. Board = asal 15x15 Ludo board, tokens overlay layer me
// SLIDE hokar chalte hain. Board ki SARI styling src/lib/boardSkin.ts se ati hai —
// yahan board visuals ke liye koi hardcoded rang nahi.
import { useEffect, useMemo, useRef, useState } from "react";
import { Trophy, Volume2, VolumeX, X } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  parsePasa,
  parsePasaV2,
  pasaLegalMoves,
  pasaPlayerDone,
  pasaBotName,
  pasaTorActive,
  pasaHasKill,
  PASA_COLORS,
  PASA_SAFE_CELLS,
  pasaCell,
} from "@/lib/games";
import {
  joinPasa,
  leavePasa,
  addBotPasa,
  updatePasaSettings,
  startPasa,
  rollPasaDice,
  movePasaToken,
  autoPlayPasa,
  rematchPasa,
} from "@/lib/db";
import type { Message } from "@/lib/types";
import { BOARD_SKIN } from "@/lib/boardSkin";
import {
  isPasaMuted,
  setPasaMuted,
  playDice,
  playMove,
  playCapture,
  playWin,
  playTurn,
} from "@/lib/pasaSound";
import FxOverlay from "./FxOverlay";
import LudoLeaderboard from "./LudoLeaderboard";
import PawnToken from "./PawnToken";
import PasaDice from "./PasaDice";

/* ───────── board geometry (LAYOUT — skin nahi) ───────── */
// 52-cell patri: global cell index -> [row, col] (15x15 board, 0-indexed)
const PATH: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];
const CELL_OF_RC = new Map<string, number>();
PATH.forEach(([r, c], i) => CELL_OF_RC.set(`${r},${c}`, i));

// har player ki home-stretch: progress 53..57 -> 5 rang-dar cells
const HOME_CELLS: [number, number][][] = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];
const HOME_RC = new Map<string, number>();
HOME_CELLS.forEach((cells, idx) => cells.forEach(([r, c]) => HOME_RC.set(`${r},${c}`, idx)));

const YARDS: { r: number; c: number }[] = [
  { r: 0, c: 0 },   // red — top-left
  { r: 0, c: 9 },   // green — top-right
  { r: 9, c: 9 },   // yellow — bottom-right
  { r: 9, c: 0 },   // blue — bottom-left
];
// yard ke andar ke 4 circles ke centers (continuous cell coords, yard origin se offset)
// inner white box 0.96..5.04 cells par hai; circles us ke 25% / 75% par
const YARD_OFF = [1.98, 4.02];
function yardSlotPos(yardIdx: number, slot: number): { row: number; col: number } {
  const y = YARDS[yardIdx];
  const dr = YARD_OFF[slot >= 2 ? 1 : 0]; // slots: 0=TL 1=TR 2=BL 3=BR
  const dc = YARD_OFF[slot % 2 === 1 ? 1 : 0];
  return { row: y.r + dr, col: y.c + dc };
}

// start cells par asal simt ke arrows: red →, green ↓, yellow ←, blue ↑
const START_ARROWS: Record<number, string> = { 0: "→", 13: "↓", 26: "←", 39: "↑" };
const SAFE_SET = new Set<number>((PASA_SAFE_CELLS as unknown as number[]) || []);
// ek cell par kai tokens — 2x2 mini offsets (cell units)
const STACK_OFF: [number, number][] = [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]];

/* ───────── contract helpers (engine lane ke functions, defensive) ───────── */
type St = any;
function safeLegalMoves(st: St, pid: string, roll: number | null): number[] {
  if (roll === null || roll === undefined) return [];
  try {
    const r: any = (pasaLegalMoves as any)(st, pid, roll);
    if (Array.isArray(r)) return r.filter((x: any) => typeof x === "number");
  } catch { /* fallback neeche */ }
  // fallback: basic legal (0 par 6 chahiye, 58 se agay nahi)
  try {
    const toks: number[] = Array.isArray(st?.tokens?.[pid]) ? st.tokens[pid] : [];
    return toks
      .map((p: number, i: number) => ({ p, i }))
      .filter(({ p }) => (p === 0 ? roll === 6 : p + roll <= 58))
      .map(({ i }) => i);
  } catch { return []; }
}
function safePlayerDone(st: St, pid: string): boolean {
  try {
    const r: any = (pasaPlayerDone as any)(st, pid);
    if (typeof r === "boolean") return r;
  } catch { /* fallback */ }
  const toks: number[] = Array.isArray(st?.tokens?.[pid]) ? st.tokens[pid] : [];
  return toks.length > 0 && toks.every((p: number) => p >= 58);
}
function safeBotName(id: string): string | null {
  try {
    const r: any = (pasaBotName as any)(id);
    if (typeof r === "string" && r) return r;
  } catch { /* ignore */ }
  if (typeof id === "string" && id.startsWith("__bot")) return "🤖 Bot";
  return null;
}
const callDb = (fn: (...a: any[]) => any, ...args: any[]) => {
  try { const r = fn(...args); if (r && typeof r.catch === "function") r.catch(() => {}); } catch { /* ignore */ }
};

/* ───────── LudoBoard — card aur fullscreen modal dono me reuse ───────── */
interface TokenRender {
  key: string; pIdx: number; pid: string; ti: number; prog: number;
  row: number; col: number; stackN: number; stackI: number;
}
function LudoBoard({
  st, interactive, selected, legalMoves, myIdx, dangerSet, destPos, pathDots, captureFlash, glowIdx, onTokenTap, onDestTap,
}: {
  st: St;
  interactive: boolean;
  selected: number | null;
  legalMoves: number[];
  myIdx: number;
  dangerSet: Set<string>;
  destPos: { row: number; col: number } | null;
  /** selected goti ke raste ke darmiyani cells (dots) — manzil wala cell shamil nahi */
  pathDots: { row: number; col: number }[];
  captureFlash: { row: number; col: number; k: number } | null;
  glowIdx: number;
  onTokenTap?: (pIdx: number, ti: number) => void;
  /** destination cell tap = move confirm (sirf jab koi goti selected ho) */
  onDestTap?: () => void;
}) {
  const skin = BOARD_SKIN;
  const players: string[] = Array.isArray(st?.players) ? st.players : [];
  const per: number = st?.settings?.per === 1 ? 1 : st?.settings?.per === 4 ? 4 : 2;

  // tokens ki render list (positions continuous cell coords me)
  // finished (58) tokens overlay me nahi — center ke finish stacks me jate hain (Manus style)
  const renders: TokenRender[] = [];
  const groups = new Map<string, TokenRender[]>();
  const finishedByPlayer = new Map<number, number[]>();
  players.forEach((pid, pIdx) => {
    const toks: number[] = Array.isArray(st?.tokens?.[pid]) ? st.tokens[pid] : [];
    toks.slice(0, per).forEach((prog, ti) => {
      let row = 0, col = 0, gk = "";
      if (prog >= 58) {
        const arr = finishedByPlayer.get(pIdx) || [];
        arr.push(ti);
        finishedByPlayer.set(pIdx, arr);
        return;
      } else if (prog >= 53) {
        const rc = HOME_CELLS[pIdx]?.[prog - 53];
        if (!rc) return;
        row = rc[0] + 0.5; col = rc[1] + 0.5; gk = `c-${rc[0]}-${rc[1]}`;
      } else if (prog >= 1) {
        let cell: number | null = null;
        try { cell = pasaCell(pIdx, prog); } catch { cell = null; }
        const rc = cell !== null && cell !== undefined ? PATH[cell] : null;
        if (!rc) return;
        row = rc[0] + 0.5; col = rc[1] + 0.5; gk = `c-${rc[0]}-${rc[1]}`;
      } else {
        const pos = yardSlotPos(pIdx, ti);
        row = pos.row; col = pos.col; gk = `base-${pIdx}-${ti}`;
      }
      const tr: TokenRender = { key: `${pid}:${ti}`, pIdx, pid, ti, prog, row, col, stackN: 1, stackI: 0 };
      renders.push(tr);
      const arr = groups.get(gk) || [];
      arr.push(tr);
      groups.set(gk, arr);
    });
  });
  groups.forEach((arr) => arr.forEach((tr, i) => { tr.stackN = arr.length; tr.stackI = i; }));
  // kaunsi track cells occupied hain (start arrow chhupane ke liye)
  const occupiedCells = new Set<string>();
  renders.forEach((tr) => {
    if (tr.prog >= 1 && tr.prog <= 57) occupiedCells.add(`${Math.floor(tr.row)},${Math.floor(tr.col)}`);
  });

  const cellBg = (r: number, c: number): string => {
    if (r < 6 && c < 6) return skin.playerColors[0];
    if (r < 6 && c > 8) return skin.playerColors[1];
    if (r > 8 && c > 8) return skin.playerColors[2];
    if (r > 8 && c < 6) return skin.playerColors[3];
    if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return skin.cellBg;
    const h = HOME_RC.get(`${r},${c}`);
    if (h !== undefined) return skin.playerColors[h];
    const cell = CELL_OF_RC.get(`${r},${c}`);
    if (cell !== undefined && cell % 13 === 0) return skin.playerColors[cell / 13];
    // safe cells (start ke ilawa) — Manus board.safe wala halka sunehra background
    if (cell !== undefined && SAFE_SET.has(cell)) return skin.safeCellBg;
    return skin.cellBg;
  };

  const glowShadow = glowIdx >= 0
    ? `0 0 0 3px ${skin.playerColors[glowIdx]}, 0 0 22px 4px ${skin.playerColors[glowIdx]}`
    : undefined;

  return (
    <div
      className="relative mx-auto w-full select-none"
      style={{
        border: skin.frame.border,
        background: skin.frame.background,
        padding: skin.frame.padding,
        borderRadius: skin.frame.borderRadius,
        boxShadow: glowShadow ? `${skin.frame.shadow}, ${glowShadow}` : skin.frame.shadow,
      }}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{ border: skin.boardBorder, borderRadius: skin.boardRadius, background: skin.cellBg }}
      >
        {/* 15x15 cells */}
        <div className="grid" style={{ gridTemplateColumns: "repeat(15, minmax(0,1fr))" }}>
          {Array.from({ length: 225 }).map((_, i) => {
            const r = Math.floor(i / 15), c = i % 15;
            const cell = CELL_OF_RC.get(`${r},${c}`);
            const isSafe = cell !== undefined && SAFE_SET.has(cell);
            const isStart = cell !== undefined && cell % 13 === 0;
            const showArrow = isStart && !occupiedCells.has(`${r},${c}`);
            return (
              <div
                key={i}
                className="relative flex aspect-square items-center justify-center"
                style={{ backgroundColor: cellBg(r, c), boxShadow: `inset 0 0 0 0.5px ${skin.cellBorder}` }}
              >
                {isSafe && <span className="ludo-safe-ring" aria-hidden="true" />}
                {isSafe && <span className="ludo-safe-star" aria-hidden="true">★</span>}
                {showArrow && (
                  <span className="ludo-start-direction" style={{ color: skin.playerShades[(cell as number) / 13]?.dark || skin.arrowColor }} aria-hidden="true">
                    {START_ARROWS[cell as number]}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* overlay layer */}
        <div className="pointer-events-none absolute inset-0">
          {/* yards ke safed box + circles */}
          {YARDS.map((y, idx) => {
            const pid = players[idx];
            const ptoks: number[] = pid && Array.isArray(st?.tokens?.[pid]) ? st.tokens[pid] : [];
            return (
            <div key={`yard-${idx}`}>
              <div
                className="absolute"
                style={{
                  left: `${((y.c + 0.96) / 15) * 100}%`,
                  top: `${((y.r + 0.96) / 15) * 100}%`,
                  width: `${(4.08 / 15) * 100}%`,
                  height: `${(4.08 / 15) * 100}%`,
                  background: skin.yardInnerBg,
                  borderRadius: "16%",
                  border: `2px solid ${skin.playerShades[idx].dark}35`,
                  boxShadow: "inset 0 2px 5px rgba(75,43,27,0.10), 0 2px 5px rgba(75,43,27,0.09)",
                }}
              >
                <span
                  className="ludo-yard-label"
                  style={{
                    position: "absolute", top: "3%", left: 0, right: 0, textAlign: "center",
                    color: skin.playerShades[idx].dark, fontSize: "clamp(5px, 1.45vw, 8px)",
                  }}
                >
                  {skin.playerNames[idx]}
                </span>
              </div>
              {[0, 1, 2, 3].map((slot) => {
                const pos = yardSlotPos(idx, slot);
                const slotMovable = interactive && idx === myIdx && ptoks[slot] === 0 && legalMoves.includes(slot);
                return (
                  <div
                    key={slot}
                    className={`absolute rounded-full ${slotMovable ? "ludo-yard-ring--movable" : ""}`}
                    style={{
                      left: `${(pos.col / 15) * 100}%`,
                      top: `${(pos.row / 15) * 100}%`,
                      width: `${(1.55 / 15) * 100}%`,
                      aspectRatio: "1",
                      transform: "translate(-50%,-50%)",
                      border: `2px solid ${skin.playerColors[idx]}`,
                      background: skin.surfaceBg,
                      boxShadow: "inset 0 2px 5px rgba(75,43,27,0.08)",
                    }}
                  />
                );
              })}
            </div>
            );
          })}

          {/* center — Manus style SVG triangles (upar green, right yellow, neeche blue, left red)
              + finish dot + finished pawns ke stacks apne rang ke kone me */}
          <div
            className="absolute"
            style={{
              left: "40%", top: "40%", width: "20%", height: "20%",
              background: "#FFFFFF",
              boxShadow: `inset 0 0 0 1px ${skin.cellBorder}`,
              overflow: "hidden",
            }}
          >
            <svg className="absolute inset-0 block h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="0,0 100,0 50,50" fill={skin.playerColors[1]} />
              <polygon points="100,0 100,100 50,50" fill={skin.playerColors[2]} />
              <polygon points="100,100 0,100 50,50" fill={skin.playerColors[3]} />
              <polygon points="0,100 0,0 50,50" fill={skin.playerColors[0]} />
              <path d="M0 0L100 100M100 0L0 100" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.9" />
            </svg>
            <span className="ludo-finish-dot" aria-hidden="true" />
            {[0, 1, 2, 3].map((pi) => {
              const list = finishedByPlayer.get(pi);
              if (!list || list.length === 0) return null;
              return (
                <div key={pi} className={`ludo-finish-stack ludo-finish-stack--${pi}`} aria-hidden="true">
                  {list.map((ti) => (
                    <span key={ti} className="block h-full w-full">
                      <PawnToken playerIdx={pi} number={ti + 1} />
                    </span>
                  ))}
                </div>
              );
            })}
            {destPos && destPos.row === 7.5 && destPos.col === 7.5 && myIdx >= 0 && (
              <span className={`ludo-finish-dest ludo-finish-dest--${myIdx}`} aria-hidden="true" />
            )}
          </div>

          {/* destination halo — Manus ring, mover ke rang me (center wali manzil center ke andar dikhti hai) */}
          {destPos && !(destPos.row === 7.5 && destPos.col === 7.5) && (
            <div
              className="ludo-destination-halo"
              style={{
                left: `${(destPos.col / 15) * 100}%`,
                top: `${(destPos.row / 15) * 100}%`,
                width: `${(0.8 / 15) * 100}%`,
                aspectRatio: "1",
                borderColor: skin.playerColors[myIdx] || skin.haloColor,
              }}
            />
          )}

          {/* selected goti ke raste ke dots — aage ka rasta board par hi dikhta hai */}
          {pathDots.map((d, i) => (
            <div
              key={`pd-${i}`}
              className="pointer-events-none absolute"
              style={{
                left: `${(d.col / 15) * 100}%`,
                top: `${(d.row / 15) * 100}%`,
                width: `${(0.3 / 15) * 100}%`,
                aspectRatio: "1",
                transform: "translate(-50%,-50%)",
                borderRadius: "50%",
                background: skin.playerColors[myIdx] || skin.haloColor,
                border: "1.5px solid #FFFFFF",
                opacity: 0.55,
                zIndex: 8,
              }}
            />
          ))}

          {/* destination cell TAP = move confirm (poora cell hit area, pointer-events-auto) */}
          {destPos && onDestTap && (
            <div
              role="button"
              aria-label="Manzil — yahan chalao"
              onClick={(e) => { e.stopPropagation(); onDestTap(); }}
              className="pointer-events-auto absolute cursor-pointer"
              style={{
                left: `${(destPos.col / 15) * 100}%`,
                top: `${(destPos.row / 15) * 100}%`,
                width: `${((destPos.row === 7.5 && destPos.col === 7.5 ? 2.4 : 1.05) / 15) * 100}%`,
                aspectRatio: "1",
                transform: "translate(-50%,-50%)",
                zIndex: 15,
              }}
            />
          )}

          {/* capture flash — Manus capture-pop burst */}
          {captureFlash && (
            <div
              key={captureFlash.k}
              className="ludo-capture-burst"
              style={{
                left: `${(captureFlash.col / 15) * 100}%`,
                top: `${(captureFlash.row / 15) * 100}%`,
                fontSize: "clamp(15px, 4vw, 24px)",
              }}
            >
              💥
            </div>
          )}

          {/* TOKENS — Manus SVG pawns, slide transition ke sath.
              Hitbox poora cell hai aur interactive gotiyon par pointer-events-auto
              lazmi hai — overlay layer pointer-events-none hai, is ke baghair
              goti ke taps kabhi fire nahi hote (purana bug). */}
          {renders.map((tr) => {
            const stacked = tr.stackN > 1;
            const off = stacked ? STACK_OFF[tr.stackI % 4] : [0, 0];
            const row = tr.row + (off[0] as number);
            const col = tr.col + (off[1] as number);
            const hitFrac = stacked ? 0.68 : 1.04; // tap area (cell units) — kam az kam poora cell
            const visFrac = stacked ? 0.52 : 0.74; // visual pawn size (cell units)
            const isLegal = interactive && tr.pIdx === myIdx && legalMoves.includes(tr.ti);
            const isSel = selected !== null && tr.pIdx === myIdx && tr.ti === selected;
            const tappable = isLegal || isSel;
            const isCurrent = glowIdx >= 0 && tr.pIdx === glowIdx;
            const danger = dangerSet.has(`${tr.pid}:${tr.ti}`);
            return (
              <div
                key={tr.key}
                onClick={tappable ? (e) => { e.stopPropagation(); onTokenTap?.(tr.pIdx, tr.ti); } : undefined}
                className={`absolute ${tappable ? "pointer-events-auto cursor-pointer" : "pointer-events-none"}`}
                style={{
                  left: `${(col / 15) * 100}%`,
                  top: `${(row / 15) * 100}%`,
                  width: `${(hitFrac / 15) * 100}%`,
                  aspectRatio: "1",
                  transform: "translate(-50%,-50%)",
                  transition: "left .45s ease, top .45s ease",
                  zIndex: isSel ? 24 : isLegal ? 23 : 20,
                }}
              >
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: `${(visFrac / hitFrac) * 100}%`,
                    aspectRatio: "52 / 68",
                    transform: `translate(-50%,-56%)${isSel ? " scale(1.16)" : ""}`,
                    transition: "transform .18s ease",
                    filter: isSel ? "drop-shadow(0 5px 5px rgba(75,43,27,0.46))" : undefined,
                  }}
                >
                  <div
                    className={isLegal ? "ludo-pawn-bob" : isCurrent ? "ludo-pawn-current" : undefined}
                    style={{ width: "100%", height: "100%", "--token-color": skin.playerColors[tr.pIdx] } as any}
                  >
                    <PawnToken playerIdx={tr.pIdx} number={tr.ti + 1} />
                  </div>
                </div>
                {danger && (
                  <span className="pointer-events-none absolute" style={{ right: -2, top: -3, fontSize: 10, lineHeight: 1, zIndex: 2 }}>⚠️</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Manus frame rim + shine */}
      <div className="ludo-frame__rim" aria-hidden="true" />
      <span className="ludo-frame__shine" aria-hidden="true" />
    </div>
  );
}

/* ───────── main card ───────── */
export default function PasaMessage({ m }: { m: Message }) {
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.me);
  const allMessages = useStore((s) => s.messages);

  // parse: pehle v2, warna v1 fallback
  let st: St = null;
  try { st = (parsePasaV2 as any)(m.caption); } catch { st = null; }
  let v1: any = null;
  if (!st) { try { v1 = parsePasa(m.caption); } catch { v1 = null; } }
  const isV2 = !!st && (st.v === 2 || st.tokens);

  /* hooks — hamesha chalte hain (early return se pehle) */
  const [selected, setSelected] = useState<number | null>(null);
  const [muted, setMutedState] = useState<boolean>(() => isPasaMuted());
  const [showRules, setShowRules] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [lbOpen, setLbOpen] = useState(false);
  const [showFx, setShowFx] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [captureFlash, setCaptureFlash] = useState<{ row: number; col: number; k: number } | null>(null);
  const [diceShown, setDiceShown] = useState<number>(1);
  const [diceRolling, setDiceRolling] = useState(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const prevLogLenRef = useRef<number>(-1);
  const prevTokensRef = useRef<string | null>(null);
  const prevTurnRef = useRef<string | null>(null);
  const prevRollKeyRef = useRef<string | null>(null);
  const fxDoneRef = useRef<boolean>(false);
  const autoGuardRef = useRef<string>("");
  const refMsgRef = useRef<string>("");

  const players: string[] = isV2 && Array.isArray(st.players) ? st.players : [];
  const turnId: string | null = isV2
    ? (typeof st.turn === "number" ? players[st.turn] || null : typeof st.turn === "string" ? st.turn : null)
    : null;
  const turnIdx = turnId ? players.indexOf(turnId) : -1;
  const myIdx = players.indexOf(me);
  const isMyTurn = !!st && st.started && !st.done && turnId === me;
  const rollVal: number | null = isV2 ? (typeof st.roll === "number" ? st.roll : st.lastRoll?.v ?? null) : null;
  const legalMoves = useMemo<number[]>(
    () => (isV2 && isMyTurn && st.phase === "move" ? safeLegalMoves(st, me, st.roll) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isV2, isMyTurn, st?.phase, st?.roll, st?.tokens, me]
  );

  const nameOf = (id: string | null | undefined): string => {
    if (!id) return "Member";
    return members.find((x) => x.id === id)?.name || safeBotName(id) || "Member";
  };

  /* champion 👑 — is chat ki sab se recent done v2 game ka winner */
  const championId = useMemo<string | null>(() => {
    let best: { at: number; winner: string } | null = null;
    try {
      for (const mm of allMessages) {
        if (mm.chatId !== m.chatId || mm.type !== "pasa") continue;
        let g: any = null;
        try { g = (parsePasaV2 as any)(mm.caption); } catch { g = null; }
        if (g && g.done && typeof g.winner === "string") {
          if (!best || mm.at > best.at) best = { at: mm.at, winner: g.winner };
        }
      }
    } catch { /* ignore */ }
    return best ? best.winner : null;
  }, [allMessages, m.chatId]);

  /* khatra ⚠️ — track par ghair-safe token, opponent 1..6 peeche */
  const { dangerTokens, dangerPlayers } = useMemo(() => {
    const dt = new Set<string>();
    const dp = new Set<string>();
    if (isV2 && st.started && !st.done) {
      try {
        const teams: boolean = !!st.settings?.teams;
        const partnerOf = (idx: number) => (idx + 2) % 4;
        players.forEach((pid, idx) => {
          const toks: number[] = Array.isArray(st.tokens?.[pid]) ? st.tokens[pid] : [];
          toks.forEach((prog, ti) => {
            if (prog < 1 || prog > 52) return;
            const g = pasaCell(idx, prog);
            if (g === null || g === undefined || SAFE_SET.has(g)) return;
            players.forEach((opid, oidx) => {
              if (oidx === idx) return;
              if (teams && players.length === 4 && partnerOf(idx) === oidx) return;
              const otoks: number[] = Array.isArray(st.tokens?.[opid]) ? st.tokens[opid] : [];
              otoks.forEach((oprog) => {
                if (oprog < 1 || oprog > 52) return;
                const go = pasaCell(oidx, oprog);
                if (go === null || go === undefined) return;
                const dist = (g - go + 52) % 52;
                if (dist >= 1 && dist <= 6) { dt.add(`${pid}:${ti}`); dp.add(pid); }
              });
            });
          });
        });
      } catch { /* ignore */ }
    }
    return { dangerTokens: dt, dangerPlayers: dp };
  }, [isV2, st, players]);

  /* destination halo — selected token kahan jayega */
  const destPos = useMemo<{ row: number; col: number } | null>(() => {
    if (!isV2 || selected === null || !legalMoves.includes(selected) || typeof st.roll !== "number") return null;
    try {
      const prog: number = st.tokens?.[me]?.[selected] ?? 0;
      const dp2 = prog === 0 ? 1 : prog + st.roll;
      if (dp2 > 58) return null;
      if (dp2 === 58) return { row: 7.5, col: 7.5 };
      if (dp2 >= 53) { const rc = HOME_CELLS[myIdx]?.[dp2 - 53]; return rc ? { row: rc[0] + 0.5, col: rc[1] + 0.5 } : null; }
      const cell = pasaCell(myIdx, dp2);
      const rc = cell !== null && cell !== undefined ? PATH[cell] : null;
      return rc ? { row: rc[0] + 0.5, col: rc[1] + 0.5 } : null;
    } catch { return null; }
  }, [isV2, selected, legalMoves, st, me, myIdx]);

  /* progress -> board center coords (dest/path dots ke liye; LudoBoard ki mapping jesa) */
  const rcForProgress = (pIdx: number, prog: number): { row: number; col: number } | null => {
    if (prog >= 58) return { row: 7.5, col: 7.5 };
    if (prog >= 53) { const rc = HOME_CELLS[pIdx]?.[prog - 53]; return rc ? { row: rc[0] + 0.5, col: rc[1] + 0.5 } : null; }
    if (prog >= 1) {
      let cell: number | null = null;
      try { cell = pasaCell(pIdx, prog); } catch { cell = null; }
      const rc = cell !== null && cell !== undefined ? PATH[cell] : null;
      return rc ? { row: rc[0] + 0.5, col: rc[1] + 0.5 } : null;
    }
    return yardSlotPos(pIdx, 0);
  };

  /* selected goti ke raste ke dots (manzil se pehle wale steps) */
  const pathDots = useMemo<{ row: number; col: number }[]>(() => {
    if (!isV2 || selected === null || !legalMoves.includes(selected) || typeof st.roll !== "number") return [];
    try {
      const from: number = st.tokens?.[me]?.[selected] ?? 0;
      if (from === 0) return []; // base se nikalna — raste ke dots nahi, sirf halo
      const dest = from + st.roll;
      const dots: { row: number; col: number }[] = [];
      for (let p = from + 1; p < dest; p++) {
        const rc = rcForProgress(myIdx, p);
        if (rc) dots.push(rc);
      }
      return dots;
    } catch { return []; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isV2, selected, legalMoves, st?.roll, st?.tokens, me, myIdx]);

  /* selection reset — bari / phase / roll badle to */
  useEffect(() => { setSelected(null); }, [turnId, st?.phase, st?.roll, m.id]);

  /* sounds + vibrate + capture effect — state diffing */
  useEffect(() => {
    if (!isV2) return;
    // naye message par refs reset
    if (refMsgRef.current !== m.id) {
      refMsgRef.current = m.id;
      prevLogLenRef.current = Array.isArray(st.log) ? st.log.length : 0;
      try { prevTokensRef.current = JSON.stringify(st.tokens || {}); } catch { prevTokensRef.current = null; }
      prevTurnRef.current = turnId;
      prevRollKeyRef.current = st.lastRoll ? `${st.lastRoll.by}:${st.lastRoll.v}` : null;
      fxDoneRef.current = !!st.done;
      return;
    }
    // naya roll → dice sound
    const rollKey = st.lastRoll ? `${st.lastRoll.by}:${st.lastRoll.v}` : null;
    if (rollKey && rollKey !== prevRollKeyRef.current) playDice();
    if (rollKey) prevRollKeyRef.current = rollKey;

    // tokens diff → move sound / meri goti mari gayi?
    let myCaptured = false;
    let capPos: { row: number; col: number } | null = null;
    try {
      const prev = prevTokensRef.current ? JSON.parse(prevTokensRef.current) : null;
      const nowT = st.tokens || {};
      if (prev) {
        let anyMove = false;
        players.forEach((pid, pIdx) => {
          const before: number[] = Array.isArray(prev[pid]) ? prev[pid] : [];
          const after: number[] = Array.isArray(nowT[pid]) ? nowT[pid] : [];
          after.forEach((p: number, ti: number) => { if (before[ti] !== undefined && before[ti] !== p) anyMove = true; });
          if (pid === me) {
            after.forEach((p: number, ti: number) => {
              if (typeof before[ti] === "number" && before[ti] > 0 && p === 0) myCaptured = true;
            });
          }
        });
        if (anyMove) playMove();
        if (myCaptured) {
          // capture cell: jo token is update me chala aur track par hai
          players.forEach((pid, pIdx) => {
            if (pid === me) return;
            const before: number[] = Array.isArray(prev[pid]) ? prev[pid] : [];
            const after: number[] = Array.isArray(nowT[pid]) ? nowT[pid] : [];
            after.forEach((p: number, ti: number) => {
              if (!capPos && before[ti] !== p && p >= 1 && p <= 52) {
                const cell = pasaCell(pIdx, p);
                const rc = cell !== null && cell !== undefined ? PATH[cell] : null;
                if (rc) capPos = { row: rc[0] + 0.5, col: rc[1] + 0.5 };
              }
            });
          });
        }
      }
      prevTokensRef.current = JSON.stringify(nowT);
    } catch { /* ignore */ }

    // nayi log entries → capture?
    const logArr: string[] = Array.isArray(st.log) ? st.log : [];
    if (prevLogLenRef.current >= 0 && logArr.length > prevLogLenRef.current) {
      const fresh = logArr.slice(prevLogLenRef.current);
      if (fresh.some((x: string) => typeof x === "string" && x.includes("💥"))) {
        playCapture();
        setShaking(true);
        setCaptureFlash({ row: (capPos as any)?.row ?? 7.5, col: (capPos as any)?.col ?? 7.5, k: Date.now() });
        setTimeout(() => setShaking(false), 450);
        setTimeout(() => setCaptureFlash(null), 850);
        if (myCaptured) { try { navigator.vibrate?.([60, 40, 60]); } catch { /* ignore */ } }
      }
    }
    prevLogLenRef.current = logArr.length;

    // meri bari aye → ding + vibrate
    if (turnId && turnId !== prevTurnRef.current && turnId === me && st.started && !st.done) {
      playTurn();
      try { navigator.vibrate?.(40); } catch { /* ignore */ }
    }
    if (turnId) prevTurnRef.current = turnId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isV2, st, m.id]);

  /* jeet effect — per game sirf ek dafa */
  useEffect(() => {
    if (!isV2 || !st.done || fxDoneRef.current) return;
    fxDoneRef.current = true;
    playWin();
    setShowFx(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isV2, st?.done, m.id]);

  /* dice animation — naya roll aye to faces tez badlo (~600ms) */
  useEffect(() => {
    const v: number | null = st?.lastRoll?.v ?? (typeof st?.roll === "number" ? st.roll : null);
    const by: string | null = st?.lastRoll?.by ?? turnId;
    if (!isV2 || v === null || v === undefined) return;
    const key = `${m.id}:${by}:${v}:${Array.isArray(st.log) ? st.log.length : 0}`;
    if ((diceAnimRef as any).current === key) return;
    (diceAnimRef as any).current = key;
    setDiceRolling(true);
    const iv = setInterval(() => setDiceShown(1 + Math.floor(Math.random() * 6)), 70);
    const to = setTimeout(() => { clearInterval(iv); setDiceShown(v); setDiceRolling(false); }, 600);
    return () => { clearInterval(iv); clearTimeout(to); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isV2, st?.lastRoll?.v, st?.lastRoll?.by, st?.roll]);
  const diceAnimRef = useRef<string>("");

  /* timer tick */
  const timerOn = !!(isV2 && st.settings?.timer && st.started && !st.done && typeof st.turnAt === "number");
  useEffect(() => {
    if (!timerOn) return;
    const iv = setInterval(() => setNowTick(Date.now()), 250);
    return () => clearInterval(iv);
  }, [timerOn, st?.turnAt]);
  const remainS = timerOn ? Math.max(0, 10 - (nowTick - (st.turnAt as number)) / 1000) : null;

  /* timer khatam + meri bari → auto play (ek dafa per turn) */
  useEffect(() => {
    if (!timerOn || remainS === null || remainS > 0) return;
    if (turnId !== me) return;
    const guard = `${m.id}:${st.turnAt}`;
    if (autoGuardRef.current === guard) return;
    autoGuardRef.current = guard;
    callDb(autoPlayPasa as any, m.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerOn, remainS, turnId, me, m.id, st?.turnAt]);

  /* bot lifecycle — host client bot ki bari chalaye */
  useEffect(() => {
    if (!isV2 || !st.started || st.done || !turnId) return;
    const isBotTurn = !!(st.bots && st.bots[turnId]);
    if (!isBotTurn || me !== st.host) return;
    const to = setTimeout(() => callDb(autoPlayPasa as any, m.id), 700);
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isV2, st, turnId, me, m.id]);

  /* ───────── fallbacks ───────── */
  if (!isV2) {
    if (v1) {
      return (
        <div className="mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">🎲 Pasa Race — Ludo</p>
          <p className="mt-2 rounded-lg bg-[#f5a623]/10 px-3 py-2.5 text-center text-sm font-semibold text-[#5c5e66]">
            🎲 Ye purani Ludo game hai — naya system aa gaya hai, naya match banao
          </p>
        </div>
      );
    }
    return <p className="text-sm italic text-[#80848e]">Game load nahi hua</p>;
  }

  /* ───────── v2 derived ───────── */
  const settings = st.settings || { per: 2, timer: false, capture: true, teams: false, tor: false };
  const per: number = settings.per === 1 ? 1 : settings.per === 4 ? 4 : 2;
  const torOn: boolean = (() => { try { return pasaTorActive(st); } catch { return false; } })();
  const killOf = (pid: string): number => {
    try { return pasaHasKill(st, pid) ? Math.max(1, st.kills?.[pid] || 0) : (st.kills?.[pid] || 0); } catch { return 0; }
  };
  const leftSet = new Set<string>(Array.isArray(st.leftPlayers) ? st.leftPlayers : []);
  const iAmHost = me === st.host;
  const joined = players.includes(me);
  const winnerId: string | null = typeof st.winner === "string" ? st.winner : null;
  const allLogLines: string[] = Array.isArray(st.log) ? st.log.filter((x: unknown) => typeof x === "string") : [];
  const lastLog: string | null = allLogLines.length > 0 ? allLogLines[allLogLines.length - 1] : null;
  const diceValue: number | null = diceRolling ? diceShown : (typeof st.roll === "number" ? st.roll : st.lastRoll?.v ?? null);
  const hostName = nameOf(st.host);
  const skin = BOARD_SKIN;

  const onTokenTap = (pIdx: number, ti: number) => {
    if (!isMyTurn || st.phase !== "move") return;
    if (players[pIdx] !== me) return;
    if (!legalMoves.includes(ti)) return;
    if (selected === ti) { callDb(movePasaToken as any, m.id, ti); setSelected(null); return; }
    setSelected(ti);
  };
  /** destination cell tap = selected goti chalao (board par hi confirm) */
  const onDestTap = () => {
    if (!isMyTurn || st.phase !== "move" || selected === null) return;
    if (!legalMoves.includes(selected)) return;
    callDb(movePasaToken as any, m.id, selected);
    setSelected(null);
  };
  const toggleMute = () => {
    const next = !muted;
    setPasaMuted(next);
    setMutedState(next);
  };
  const onLeaveGame = () => {
    try { if (!window.confirm("Game chhorna hai? Tum is match se bahir ho jaoge.")) return; } catch { /* ignore */ }
    callDb(leavePasa as any, m.id);
  };
  // engine contract: updatePasaSettings(msgId, patch: Partial<PasaSettings>) — flat patch
  const patchSettings = (patch: Partial<typeof settings>) =>
    callDb(updatePasaSettings as any, m.id, patch);

  // dice dock: bari wale player ke yard wale kone par (Ludo King style)
  const DICE_DOCK: React.CSSProperties[] = [
    { top: 0, left: 0, transform: "translate(-14%,-14%)" },     // red — top-left
    { top: 0, right: 0, transform: "translate(14%,-14%)" },     // green — top-right
    { bottom: 0, right: 0, transform: "translate(14%,14%)" },   // yellow — bottom-right
    { bottom: 0, left: 0, transform: "translate(-14%,14%)" },   // blue — bottom-left
  ];
  // name chips: har yard ke bahari kone ke pas (dice wale kone se thora hat kar)
  const CHIP_POS: React.CSSProperties[] = [
    { top: 40, left: 56 },
    { top: 40, right: 56 },
    { bottom: 8, right: 56 },
    { bottom: 8, left: 56 },
  ];
  const iconBtnCls = "pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-[12px] leading-none text-white shadow transition hover:bg-black/60 active:scale-95";

  /** Board + us ke SAARE overlays (turn pill, chips, dice, toast, icons, winner).
      Card aur fullscreen modal dono yahi use karte hain — dono jagah taps chalte hain. */
  const boardBlock = (inModal: boolean) => (
    <div className="relative">
      <div className={shaking ? "ludo-board-shake" : undefined}>
        <LudoBoard
          st={st}
          interactive={isMyTurn && st.phase === "move"}
          selected={selected}
          legalMoves={legalMoves}
          myIdx={myIdx}
          dangerSet={dangerTokens}
          destPos={destPos}
          pathDots={pathDots}
          captureFlash={captureFlash}
          glowIdx={st.started && !st.done ? turnIdx : -1}
          onTokenTap={onTokenTap}
          onDestTap={selected !== null ? onDestTap : undefined}
        />
      </div>

      {/* har yard ke kone par name chip — alag player list nahi */}
      {players.map((pid, idx) => {
        if (idx > 3) return null;
        const toks: number[] = Array.isArray(st.tokens?.[pid]) ? st.tokens[pid] : [];
        const bahar = toks.filter((p: number) => p >= 1 && p < 58).length;
        const ghar = toks.filter((p: number) => p >= 58).length;
        const isTurn = st.started && !st.done && turnId === pid;
        const locked = torOn && st.started && !st.done && killOf(pid) === 0 && !safePlayerDone(st, pid);
        return (
          <div
            key={`chip-${pid}`}
            className="pointer-events-none absolute z-40"
            style={CHIP_POS[idx]}
          >
            <span
              className={`flex max-w-[118px] items-center gap-1 rounded-full bg-white/90 py-0.5 pl-1.5 pr-2 text-[9px] font-extrabold text-[#2f3035] shadow ${isTurn ? "ring-2" : "ring-1 ring-black/10"}`}
              style={isTurn ? ({ ["--tw-ring-color" as any]: skin.playerColors[idx] } as any) : undefined}
              title={locked ? "Tor: pehle ek goti maro — phir hi ghar ja sakte ho" : undefined}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: skin.playerColors[idx] }} />
              <span className="truncate">{nameOf(pid)}{championId === pid ? " 👑" : ""}</span>
              <span className="shrink-0 font-bold text-[#80848e]">🏃{bahar} 🏁{ghar}</span>
              {locked && <span className="shrink-0" title="Pehle goti maro">🔒</span>}
              {dangerPlayers.has(pid) && st.started && !st.done && <span className="shrink-0">⚠️</span>}
              {leftSet.has(pid) && <span className="shrink-0">🚪</span>}
            </span>
          </div>
        );
      })}

      {/* turn pill — board ke upar center */}
      {st.started && !st.done && turnId && (
        <div className="pointer-events-none absolute left-1/2 top-1 z-40 -translate-x-1/2">
          <span
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black/55 px-3 py-1 text-[11px] font-extrabold text-white shadow backdrop-blur-[1px]"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: skin.playerColors[turnIdx] || "#fff" }} />
            {nameOf(turnId)} ki bari{isMyTurn ? " — tumhari! 👆" : ""}
            {timerOn && remainS !== null && <span className={remainS <= 3 ? "text-[#ff9d9d]" : "text-white/85"}>⏱ {Math.ceil(remainS)}s</span>}
          </span>
        </div>
      )}

      {/* move-phase hint — meri bari, goti select karni hai */}
      {isMyTurn && st.phase === "move" && selected === null && (
        <div className="pointer-events-none absolute left-1/2 top-9 z-40 -translate-x-1/2">
          <span className="whitespace-nowrap rounded-full bg-[#5865f2]/85 px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow">Goti tap karo 👆</span>
        </div>
      )}

      {/* dice — BOARD par, bari wale ke yard ke kone par docked; tap = roll */}
      {st.started && !st.done && turnIdx >= 0 && (
        <div className="absolute z-40" style={DICE_DOCK[turnIdx]}>
          <PasaDice
            variant="board"
            playerIdx={turnIdx}
            value={diceValue}
            rolling={diceRolling}
            disabled={!isMyTurn || st.phase !== "roll"}
            remainingSeconds={timerOn ? remainS : null}
            onRoll={() => callDb(rollPasaDice as any, m.id)}
          />
        </div>
      )}

      {/* aakhri event — board ke neeche kinare par toast line (poora log 📜 me) */}
      {st.started && lastLog && (
        <div
          key={`${allLogLines.length}:${lastLog}`}
          className="ludo-toast pointer-events-none absolute bottom-10 left-1/2 z-40 w-max max-w-[64%]"
          style={{ transform: "translateX(-50%)" }}
        >
          <p className="truncate rounded-full bg-black/55 px-2.5 py-1 text-center text-[10px] font-semibold text-white backdrop-blur-[1px]">{lastLog}</p>
        </div>
      )}

      {/* winner overlay — board ke center par */}
      {st.done && winnerId && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <div className="rounded-2xl border border-[#f5a623]/50 bg-white/95 px-4 py-3 text-center shadow-xl">
            <p className="flex items-center justify-center gap-1.5 text-[15px] font-extrabold text-[#2f3035]">
              <Trophy size={16} className="text-[#f5a623]" /> {nameOf(winnerId)} 👑
            </p>
            <p className="mt-0.5 text-xs font-bold text-[#5c5e66]">{settings.teams ? "Unki team jeet gayi! 🎉" : "Ludo jeet gaya! 🎉"}</p>
          </div>
        </div>
      )}

      {/* icon buttons — board ke dayen kinare par chhoti si patti */}
      <div className="absolute right-1 top-1/2 z-50 flex -translate-y-1/2 flex-col gap-1">
        <button type="button" className={iconBtnCls} onClick={toggleMute} title={muted ? "Awaz on karo" : "Awaz band karo"} aria-label={muted ? "Awaz on karo" : "Awaz band karo"}>
          {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
        <button type="button" className={iconBtnCls} onClick={() => setShowLog(true)} title="Poora log dekho" aria-label="Game log">📜</button>
        <button type="button" className={iconBtnCls} onClick={() => setShowRules(true)} title="Rules" aria-label="Rules">📖</button>
        <button type="button" className={iconBtnCls} onClick={() => setLbOpen(true)} title="Leaderboard" aria-label="Leaderboard">🏆</button>
        {!inModal && (
          <button type="button" className={iconBtnCls} onClick={() => setBoardOpen(true)} title="Bara board" aria-label="Bara board">🔍</button>
        )}
        {st.started && !st.done && joined && (
          <button type="button" className={iconBtnCls} onClick={onLeaveGame} title="Game chhoro" aria-label="Game chhoro">🚪</button>
        )}
      </div>
    </div>
  );

  const toggleBtn = (on: boolean, label: string, onClick: () => void, disabled = false) => (
    <button
      key={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-extrabold transition active:scale-[0.97] disabled:opacity-50 ${on ? "bg-[#5865f2] text-white" : "border border-black/10 bg-white text-[#5c5e66]"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="ludo-scope mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      {showFx && <FxOverlay kind="confetti" emoji="🏆" onDone={() => setShowFx(false)} />}
      {lbOpen && <LudoLeaderboard open={lbOpen} onClose={() => setLbOpen(false)} />}

      {/* slim header — baqi sab kuch board par hai */}
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        🎲 Pasa Race — Ludo
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-extrabold normal-case tracking-normal ${st.done ? "bg-black/[0.06] text-[#80848e]" : st.started ? "bg-[#23a55a]/15 text-[#178a4c]" : "bg-[#f5a623]/15 text-[#9a6a00]"}`}>
          {st.started ? (st.done ? "Khatam" : "🟢 Chal raha hai") : "Players ka intezar"}
        </span>
      </p>
      {st.tourney && (
        <p className="-mt-1 mb-2 inline-block rounded-full bg-[#f5a623]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#9a6a00]">🏆 Tournament match</p>
      )}

      {/* BOARD — running game me card ka matlab sirf board + overlays */}
      {boardBlock(false)}

      {/* ── LOBBY strip (sirf game shuru hone se pehle) ── */}
      {!st.started && (
        <div className="mt-3 space-y-2">
          {/* joined players — compact chips */}
          <div className="flex flex-wrap items-center gap-1">
            {players.map((pid, idx) => (
              <span key={pid} className="flex items-center gap-1 rounded-full bg-black/[0.05] py-0.5 pl-1.5 pr-2 text-[11px] font-bold text-[#2f3035]">
                <span className="h-2 w-2 rounded-full" style={{ background: skin.playerColors[idx] }} />
                {nameOf(pid)}
                {championId === pid ? " 👑" : ""}
                {pid === st.host && <span className="rounded bg-black/[0.07] px-1 py-px text-[8px] font-extrabold uppercase text-[#80848e]">host</span>}
                {st.bots?.[pid] && <span className="text-[9px] font-semibold text-[#80848e]">({st.bots[pid] === "easy" ? "asan" : "normal"})</span>}
              </span>
            ))}
            {players.length === 0 && <span className="text-xs italic text-[#80848e]">Abhi koi player nahi</span>}
            <span className="ml-auto text-[10px] font-semibold text-[#a0a3ab]">{players.length}/4 players</span>
          </div>
          <p className="text-center text-[11px] font-semibold text-[#80848e]">
            {per} goti{per > 1 ? "yan" : ""} · ⏱ timer {settings.timer ? "on" : "off"} · 💥 marna {settings.capture ? "on" : "off"}{settings.teams ? " · 👥 teams" : ""}{torOn ? " · 🔒 tor on" : ""}
          </p>

          {!joined && players.length < 4 && (
            <button onClick={() => callDb(joinPasa as any, m.id)} className="btn btn-blurple w-full py-2.5 text-sm">➕ Join karo</button>
          )}
          {joined && !iAmHost && (
            <button onClick={() => callDb(leavePasa as any, m.id)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-bold text-[#5c5e66] transition active:scale-[0.98]">🚪 Leave karo</button>
          )}
          {iAmHost && players.length < 4 && (
            <div className="flex gap-1.5">
              <button onClick={() => callDb(addBotPasa as any, m.id, "easy")} className="flex-1 rounded-lg border border-black/10 bg-white px-2 py-2 text-xs font-extrabold text-[#2f3035] transition active:scale-[0.98]">+ 🤖 Bot · Asan</button>
              <button onClick={() => callDb(addBotPasa as any, m.id, "normal")} className="flex-1 rounded-lg border border-black/10 bg-white px-2 py-2 text-xs font-extrabold text-[#2f3035] transition active:scale-[0.98]">+ 🤖 Bot · Normal</button>
            </div>
          )}
          {iAmHost && (
            <div className="space-y-1.5 rounded-lg bg-black/[0.03] p-2">
              <div className="flex items-center gap-1.5">
                <span className="w-16 shrink-0 text-[11px] font-bold text-[#5c5e66]">Gotiyan</span>
                {toggleBtn(per === 1, "1 goti", () => patchSettings({ per: 1 }))}
                {toggleBtn(per === 2, "2 goti", () => patchSettings({ per: 2 }))}
                {toggleBtn(per === 4, "4 goti", () => patchSettings({ per: 4 }))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-16 shrink-0 text-[11px] font-bold text-[#5c5e66]">⏱ Timer</span>
                {toggleBtn(!!settings.timer, "On (10s)", () => patchSettings({ timer: true }))}
                {toggleBtn(!settings.timer, "Off", () => patchSettings({ timer: false }))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-16 shrink-0 text-[11px] font-bold text-[#5c5e66]">💥 Marna</span>
                {toggleBtn(!!settings.capture, "On", () => patchSettings({ capture: true }))}
                {toggleBtn(!settings.capture, "Off", () => patchSettings({ capture: false }))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-16 shrink-0 text-[11px] font-bold text-[#5c5e66]">🔒 Tor</span>
                {toggleBtn(!!settings.tor && settings.capture && per >= 2, "On", () => patchSettings({ tor: true }), !settings.capture || per < 2)}
                {toggleBtn(!settings.tor || !settings.capture || per < 2, "Off", () => patchSettings({ tor: false }))}
              </div>
              {per < 2 ? (
                <p className="text-[10px] text-[#a0a3ab]">1-goti mode me tor nahi hota — sirf pehle pugna (finish) hai.</p>
              ) : !settings.capture ? (
                <p className="text-[10px] text-[#a0a3ab]">Tor ke liye 💥 Marna on hona lazmi hai (warna ghar kabhi nahi milega).</p>
              ) : settings.tor ? (
                <p className="text-[10px] text-[#a0a3ab]">🔒 Tor on: jis ne ek goti na mari ho, wo ghar (home) nahi ja sakta.</p>
              ) : null}
              <div className="flex items-center gap-1.5">
                <span className="w-16 shrink-0 text-[11px] font-bold text-[#5c5e66]">👥 Teams</span>
                {toggleBtn(!!settings.teams, "On (2v2)", () => patchSettings({ teams: true }))}
                {toggleBtn(!settings.teams, "Off", () => patchSettings({ teams: false }))}
              </div>
              <p className="text-[10px] text-[#a0a3ab]">Note: gotiyan badalne se tokens reset honge. Settings sirf host ({hostName}) badal sakta hai.</p>
            </div>
          )}
          {iAmHost && (
            settings.teams && players.length < 4 ? (
              <p className="text-center text-xs font-semibold text-[#9a6a00]">👥 Teams ke liye 4 players lazmi hain ({players.length}/4)</p>
            ) : players.length >= 2 ? (
              <button onClick={() => callDb(startPasa as any, m.id)} className="w-full rounded-lg bg-[#23a55a] px-3 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98]">▶️ Game shuru karo</button>
            ) : (
              <p className="text-center text-xs text-[#80848e]">Kam se kam 2 players chahiye</p>
            )
          )}
        </div>
      )}

      {/* ── DONE strip — rematch (winner board par overlay me hai) ── */}
      {st.done && winnerId && (
        <button onClick={() => callDb(rematchPasa as any, m.id)} className="mt-3 w-full rounded-lg bg-[#5865f2] px-3 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98]">🔁 Rematch — wohi players, naya match</button>
      )}

      {/* fullscreen board modal — wohi interactive board (taps yahan bhi chalte hain) */}
      {boardOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={() => setBoardOpen(false)}>
          <div className="w-full max-w-[min(92vw,560px)]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-extrabold text-white">🎲 Ludo Board</p>
              <button onClick={() => setBoardOpen(false)} className="rounded-full bg-white/15 p-1.5 text-white transition hover:bg-white/25" aria-label="Band karo">
                <X size={18} />
              </button>
            </div>
            {boardBlock(true)}
          </div>
        </div>
      )}

      {/* log modal — poora commentary log (board par sirf aakhri line toast me hai) */}
      {showLog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowLog(false)}>
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-extrabold text-[#2f3035]">📜 Game Log</p>
              <button onClick={() => setShowLog(false)} className="rounded-full p-1 text-[#80848e] transition hover:bg-black/5" aria-label="Band karo">
                <X size={17} />
              </button>
            </div>
            {allLogLines.length === 0 ? (
              <p className="text-sm italic text-[#80848e]">Abhi koi event nahi hua.</p>
            ) : (
              <div className="space-y-1">
                {allLogLines.map((line, i) => {
                  const last = i === allLogLines.length - 1;
                  return (
                    <p key={i} className={`rounded-md px-2 py-1 text-[12px] leading-snug ${last ? "bg-[#5865f2]/10 font-bold text-[#2f3035]" : "bg-black/[0.04] font-medium text-[#5c5e66]"}`}>{line}</p>
                  );
                })}
              </div>
            )}
            <button onClick={() => setShowLog(false)} className="btn btn-blurple mt-3 w-full py-2 text-sm">Band karo</button>
          </div>
        </div>
      )}

      {/* rules modal */}
      {showRules && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowRules(false)}>
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-extrabold text-[#2f3035]">📜 Ludo Rules</p>
              <button onClick={() => setShowRules(false)} className="rounded-full p-1 text-[#80848e] transition hover:bg-black/5" aria-label="Band karo">
                <X size={17} />
              </button>
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-snug text-[#3a3b42]">
              <li>Har cheez <b>board par</b> hai: pasa bari wale ke ghar ke pas board ke kone par hota hai — use tap karke phenko. Goti tap karo, phir <b>usi goti ko dobara tap</b> karo ya <b>manzil wale cell ko tap</b> karo — goti chal jayegi. Raste ke dots aur manzil ki ring pehle hi dikh jati hai.</li>
              <li>Har player ke paas {per} goti{per > 1 ? "yan" : ""} hoti {per > 1 ? "hain" : "hai"} (host lobby me 1, 2 ya 4 chun sakta hai).</li>
              <li>Goti ghar (base) se bahar nikalne ke liye <b>6</b> ana lazmi hai.</li>
              <li><b>Extra bari</b> milti hai: 6 aane par, kisi ko marne par, ya goti ke <b>pora finish (58)</b> hone par. Sirf home patri me ghusne par extra bari <b>nahi</b> milti.</li>
              <li>Lagatar <b>teen 6</b> aayen to teesra 6 zaya ho jata hai — bari agle player ko chali jati hai.</li>
              <li><b>Block rule:</b> ek hi cell par tumhari 2 gotiyan hon to block ban jata hai — opponent us cell ko par nahi kar sakta na maar sakta hai.</li>
              <li><b>Safe ⭐</b> wale cells par koi kisi ko nahi maar sakta.</li>
              <li>Finish ke liye <b>exact number</b> chahiye — zyada aye to goti nahi chalegi.</li>
              <li>Jis ki <b>saari gotiyan ghar (58)</b> pohonch jayen, wahi jeet-ta hai.</li>
              {torOn && <li><b>🔒 Tor rule (is game me ON hai):</b> jab tak tum kisi ki <b>ek goti na maro</b>, tumhari koi goti <b>home patri me nahi ja sakti</b> aur finish bhi nahi ho sakti. Naam ke pas 🔒 isiliye dikhta hai.</li>}
              {per === 1 && <li><b>1-goti mode:</b> is me tor nahi hota — sirf pehle finish (pugna) karna hai.</li>}
              <li>Timer on ho to har bari ke liye sirf <b>10 second</b> milte hain — waqt khatam ho to auto chal chal jati hai.</li>
              <li><b>Teams (2v2):</b> aamne-saamne wale players ek team hote hain — partner ko nahi mara jata, aur dono ki saari gotiyan ghar jayen to team jeet-ti hai.</li>
              <li>⚠️ nishan wali goti khatre me hai — koi opponent us se 1–6 qadam peeche hai!</li>
            </ul>
            <button onClick={() => setShowRules(false)} className="btn btn-blurple mt-3 w-full py-2 text-sm">Samajh gaya 👍</button>
          </div>
        </div>
      )}
    </div>
  );
}
