"use client";
// 🏆 Ludo Tournament — bracket card: 2 semi-finals + final, host games start karta hai
import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { parseTourney, parsePasaV2, pasaBotName } from "@/lib/games";
import { startTourneyGame, syncTournament } from "@/lib/db";
import FxOverlay from "./FxOverlay";
import type { Message } from "@/lib/types";

export default function TourneyMessage({ m }: { m: Message }) {
  const st: any = parseTourney(m.caption);
  const members = useStore((s) => s.members);
  const messages = useStore((s) => s.messages);
  const me = useStore((s) => s.me);
  const [showFx, setShowFx] = useState(false);
  const fxFiredRef = useRef<Set<string>>(new Set());

  const champion: string | null = st?.champion || st?.final?.winner || null;

  useEffect(() => {
    if (!champion) return;
    const key = m.id;
    if (fxFiredRef.current.has(key)) return;
    fxFiredRef.current.add(key);
    setShowFx(true);
  }, [champion, m.id]);

  if (!st) return <p className="text-sm italic text-[#80848e]">Tournament load nahi hua</p>;

  const nameOf = (id: string | null | undefined): string => {
    if (!id) return "TBD";
    return members.find((x) => x.id === id)?.name || pasaBotName(id) || "Member";
  };

  const isHost = st.host === me;

  const semis: any[] = Array.isArray(st.semis) ? st.semis : [];
  const semi1 = semis[0] || { a: null, b: null, gameId: null, winner: null };
  const semi2 = semis[1] || { a: null, b: null, gameId: null, winner: null };
  const final = st.final || { a: null, b: null, gameId: null, winner: null };

  // Linked game ki live status (sirf display ke liye)
  const liveStatus = (gameId: string | null | undefined): { done: boolean; winner: string | null } | null => {
    if (!gameId) return null;
    const gm = messages.find((x) => x.id === gameId);
    if (!gm) return null;
    try {
      const gs: any = parsePasaV2(gm.caption);
      if (!gs) return null;
      return { done: !!gs.done, winner: gs.winner || null };
    } catch {
      return null;
    }
  };

  const renderSlot = (slot: any, label: string, slotKey: "semi1" | "semi2" | "final") => {
    const a: string | null = slot?.a ?? null;
    const b: string | null = slot?.b ?? null;
    const gameId: string | null = slot?.gameId ?? null;
    const winner: string | null = slot?.winner ?? null;
    const live = liveStatus(gameId);
    const effectiveWinner = winner || (live?.done ? live.winner : null);
    const isFinal = slotKey === "final";
    const canStartFinal = isFinal ? !!(semi1.winner && semi2.winner) && !gameId : true;
    const showStart = isHost && !gameId && !winner && canStartFinal && (isFinal ? !!(a && b) : !!(a && b));

    const rowCls = (id: string | null) =>
      effectiveWinner && id && effectiveWinner === id
        ? "bg-[#f5a623]/15 border-[#f5a623]/40"
        : "bg-black/[0.03] border-black/[0.06]";

    return (
      <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-3">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.07em] text-[#80848e]">{label}</p>
        <div className="space-y-1.5">
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${rowCls(a)}`}>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#2f3035]">
              {a ? nameOf(a) : "TBD"}
              {effectiveWinner && a && effectiveWinner === a ? " 👑" : ""}
            </span>
            {effectiveWinner && a && effectiveWinner === a && <Trophy size={14} className="shrink-0 text-[#f5a623]" />}
          </div>
          <p className="text-center text-[11px] font-extrabold text-[#80848e]">VS</p>
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${rowCls(b)}`}>
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#2f3035]">
              {b ? nameOf(b) : "TBD"}
              {effectiveWinner && b && effectiveWinner === b ? " 👑" : ""}
            </span>
            {effectiveWinner && b && effectiveWinner === b && <Trophy size={14} className="shrink-0 text-[#f5a623]" />}
          </div>
        </div>

        {gameId && !effectiveWinner && (
          <p className="mt-2 text-center text-xs font-semibold text-[#5865f2]">🎮 match chal raha hai</p>
        )}
        {live?.done && live.winner && !winner && (
          <p className="mt-2 text-center text-xs font-semibold text-[#5c5e66]">Match khatam — {nameOf(live.winner)} jeeta</p>
        )}

        {showStart && (
          <button
            onClick={() => startTourneyGame(m.id, slotKey)}
            className="btn btn-blurple mt-2.5 w-full py-2.5 text-sm"
          >
            {slotKey === "semi1" ? "▶ Semi 1 shuru karo" : slotKey === "semi2" ? "▶ Semi 2 shuru karo" : "▶ Final shuru karo"}
          </button>
        )}
        {isFinal && isHost && !gameId && !winner && !(semi1.winner && semi2.winner) && (
          <p className="mt-2 text-center text-xs text-[#80848e]">Dono semi-finals ke winners ke baad final shuru hoga</p>
        )}
      </div>
    );
  };

  return (
    <div className="mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      {showFx && <FxOverlay kind="confetti" emoji="🏆" onDone={() => setShowFx(false)} />}

      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        🏆 Ludo Tournament
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-extrabold normal-case tracking-normal ${champion ? "bg-[#f5a623]/15 text-[#9a6a00]" : "bg-[#23a55a]/15 text-[#178a4c]"}`}>
          {champion ? "Khatam" : "🟢 Chal raha hai"}
        </span>
      </p>

      {Array.isArray(st.players) && st.players.length > 0 && (
        <p className="mb-3 text-xs text-[#80848e]">
          Players: {st.players.map((id: string) => nameOf(id)).join(" · ")}
        </p>
      )}

      <div className="space-y-3">
        {renderSlot(semi1, "Semi-Final 1", "semi1")}
        {renderSlot(semi2, "Semi-Final 2", "semi2")}
        {renderSlot(final, "Final", "final")}
      </div>

      {champion && (
        <div className="mt-3 rounded-xl bg-gradient-to-r from-[#f5a623]/20 to-[#5865f2]/10 px-3 py-3 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[15px] font-extrabold text-[#2f3035]">
            <Trophy size={16} className="text-[#f5a623]" /> 🏆 Champion: {nameOf(champion)} 👑
          </p>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] text-[#80848e]">Har match 2 gotiyon wala hoga</p>

      <button
        onClick={() => syncTournament(m.id)}
        className="btn btn-ghost mt-2 w-full py-2 text-sm"
      >
        🔄 Result update karo
      </button>
    </div>
  );
}
