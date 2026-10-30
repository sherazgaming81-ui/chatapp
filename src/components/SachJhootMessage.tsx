"use client";
// Fun — Sach Ya Jhoot: statement par Sach/Jhoot vote (reactions), timer par auto-advance
import { useEffect, useRef, useState } from "react";
import { Clock, Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { parseSachJhoot, SACH_BANK } from "@/lib/games";
import { answerSachJhoot, advanceSachJhoot } from "@/lib/db";
import type { Message } from "@/lib/types";

const EMPTY_OBJ: Record<string, string[]> = {};

export default function SachJhootMessage({ m }: { m: Message }) {
  const st: any = parseSachJhoot(m.caption);
  const reactions = useStore((s) => s.messages.find((x) => x.id === m.id)?.reactions || EMPTY_OBJ);
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.me);
  const [, tick] = useState(0);
  const advRef = useRef(false);

  const order: number[] = st && Array.isArray(st.order) ? st.order : [];
  const round: number = st && typeof st.round === "number" ? st.round : 0;
  const item = st ? SACH_BANK[order[round]] : undefined;
  const left = st && !st.done && typeof st.qEndsAt === "number" ? Math.max(0, st.qEndsAt - Date.now()) : 0;

  // timer tick (QuizMessage pattern)
  useEffect(() => {
    if (!st || st.done) return;
    const t = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, st?.done]);

  // timer khatam → agla round — SIRF game starter ka client advance kare
  useEffect(() => {
    if (!st || st.done || advRef.current) return;
    if (m.from !== me) return;
    if (typeof st.qEndsAt === "number" && Date.now() >= st.qEndsAt) {
      advRef.current = true;
      // chhota delay taake sab ke answers sync ho jayein
      const t = setTimeout(() => { advanceSachJhoot(m.id).catch(() => {}); advRef.current = false; }, 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, round]);

  useEffect(() => { advRef.current = false; }, [round]);

  if (!st) return <p className="text-sm italic text-[#80848e]">Game load nahi hua</p>;

  const nameOf = (id: string | null | undefined) => members.find((x) => x.id === id)?.name || "Member";
  const shortName = (id: string) => nameOf(id).split(" ")[0];
  const idOf = (v: any): string | null =>
    typeof v === "string" ? v : v && typeof v === "object" ? (v.by || v.id || v.winner || null) : null;

  // meri choice reactions se: __sj_<round>_0 = Sach, __sj_<round>_1 = Jhoot
  const mine = ((reactions[`__sj_${round}_0`] as string[]) || []).includes(me)
    ? 0
    : ((reactions[`__sj_${round}_1`] as string[]) || []).includes(me)
      ? 1
      : -1;
  const secs = Math.ceil(left / 1000);

  const scores: [string, number][] = st.scores && typeof st.scores === "object"
    ? Object.entries(st.scores as Record<string, number>).sort((a, b) => b[1] - a[1])
    : [];

  const lr: any = st.lastResult && typeof st.lastResult === "object" ? st.lastResult : null;
  const lrRaw = lr ? (lr.answer ?? lr.truth ?? lr.sach ?? lr.a ?? lr.correctAnswer) : undefined;
  const lrSach = lrRaw === true || lrRaw === 0 || lrRaw === "sach" || lrRaw === "Sach" || lrRaw === "true";
  const lrCorrect = lr && typeof (lr.correct ?? lr.count ?? lr.correctCount) === "number"
    ? (lr.correct ?? lr.count ?? lr.correctCount)
    : null;
  const winnerId = idOf(st.winner);

  return (
    <div className="mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        ✅ Sach Ya Jhoot ❌
        <span className="ml-auto rounded-full bg-[#5865f2]/10 px-2 py-0.5 text-[10px] font-extrabold normal-case tracking-normal text-[#5865f2]">
          Round {Math.min(round + 1, order.length || 1)}/{order.length}
        </span>
      </p>

      {!st.done && item && (
        <>
          <div className="mb-2 flex items-center justify-end">
            <span className={`flex items-center gap-1 text-xs font-extrabold tabular-nums ${secs <= 5 ? "text-[#e0245e]" : "text-[#5c5e66]"}`}>
              <Clock size={12} /> {secs}s
            </span>
          </div>
          <p className="mb-2.5 text-center text-[17px] font-bold leading-snug text-[#2f3035]">{item.s}</p>
          <div className="flex gap-1.5">
            <button
              onClick={() => answerSachJhoot(m.id, 0)}
              className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98] ${
                mine === 0 ? "bg-[#23a55a] ring-2 ring-[#23a55a]/50 ring-offset-1" : "bg-[#23a55a]/85 hover:bg-[#23a55a]"
              }`}
            >
              ✅ Sach{mine === 0 ? " ✓" : ""}
            </button>
            <button
              onClick={() => answerSachJhoot(m.id, 1)}
              className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98] ${
                mine === 1 ? "bg-[#ed4245] ring-2 ring-[#ed4245]/50 ring-offset-1" : "bg-[#ed4245]/85 hover:bg-[#ed4245]"
              }`}
            >
              ❌ Jhoot{mine === 1 ? " ✓" : ""}
            </button>
          </div>
          {mine !== -1 && (
            <p className="mt-2 text-center text-xs italic text-[#80848e]">
              Tumhara jawab lag gaya, waqt khatam hone ka intezar karo
            </p>
          )}
        </>
      )}

      {lr && lrCorrect !== null && (
        <p className="mt-2 text-center text-xs font-semibold text-[#5c5e66]">
          Sahi jawab: {lrSach ? "Sach" : "Jhoot"} tha — {lrCorrect} logo ne sahi kaha
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
