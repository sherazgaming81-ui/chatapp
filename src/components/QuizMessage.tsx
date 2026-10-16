"use client";
// I1 — Deen Quiz message: timer, options, live scoreboard
import { useEffect, useRef, useState } from "react";
import { Brain, Clock, Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { parseQuiz, quizScores, quizAnswered } from "@/lib/games";
import { answerQuiz, advanceQuiz } from "@/lib/db";
import type { Message } from "@/lib/types";

const EMPTY_OBJ: Record<string, string[]> = {};
const Q_TIME = 15000;

export default function QuizMessage({ m }: { m: Message }) {
  const quiz = parseQuiz(m.caption);
  const reactions = useStore((s) => s.messages.find((x) => x.id === m.id)?.reactions || EMPTY_OBJ);
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.me);
  const [, tick] = useState(0);
  const advRef = useRef(false);

  const q = quiz ? quiz.questions[quiz.current] : null;
  const left = quiz && !quiz.done ? Math.max(0, quiz.qEndsAt - Date.now()) : 0;

  // timer tick
  useEffect(() => {
    if (!quiz || quiz.done) return;
    const t = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [quiz?.current, quiz?.done]);

  // timer khatam → agla sawal (sirf ek client advance kare — starter ya pehla viewer)
  useEffect(() => {
    if (!quiz || quiz.done || advRef.current) return;
    if (Date.now() >= quiz.qEndsAt) {
      advRef.current = true;
      // chhota delay taake sab ke answers sync ho jayein
      const t = setTimeout(() => { advanceQuiz(m.id).catch(() => {}); advRef.current = false; }, 1200);
      return () => clearTimeout(t);
    }
  }, [left, quiz?.current]);

  useEffect(() => { advRef.current = false; }, [quiz?.current]);

  if (!quiz || !q) return <p className="text-sm italic text-[#80848e]">Quiz load nahi hua</p>;

  const scores = quizScores(reactions, quiz.questions);
  const mine = quizAnswered(reactions, quiz.current, me);
  const secs = Math.ceil(left / 1000);

  return (
    <div className="mt-1.5 w-full max-w-sm rounded-xl border border-[#5865f2]/25 bg-gradient-to-br from-[#5865f2]/[0.07] to-white p-3.5 soft-shadow">
      <p className="mb-0.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        <Brain size={13} /> Deen Quiz · {quiz.current + 1}/{quiz.questions.length}
      </p>
      {!quiz.done ? (
        <>
          <div className="mb-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full bg-[#5865f2] transition-all duration-500" style={{ width: `${(left / Q_TIME) * 100}%` }} />
            </div>
            <span className={`flex items-center gap-1 text-xs font-extrabold tabular-nums ${secs <= 5 ? "text-[#e0245e]" : "text-[#5c5e66]"}`}>
              <Clock size={12} /> {secs}s
            </span>
          </div>
          <p className="mb-2.5 text-[15px] font-bold leading-snug text-[#2f3035]">{q.q}</p>
          <div className="space-y-1.5">
            {q.opts.map((opt, i) => {
              const isMine = mine === i;
              const votes = ((reactions[`__quiz_${quiz.current}_${i}`] as string[]) || []).length;
              return (
                <button
                  key={i}
                  onClick={() => answerQuiz(m.id, quiz.current, i)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-semibold transition active:scale-[0.99] ${
                    isMine ? "border-[#5865f2] bg-[#5865f2]/[0.1] text-[#2f3035]" : "border-black/10 bg-white text-[#2f3035] hover:border-[#5865f2]/50"
                  }`}
                >
                  <span>{opt} {isMine && <span className="ml-1 text-xs font-bold text-[#5865f2]">✓</span>}</span>
                  <span className="text-xs font-bold tabular-nums text-[#80848e]">{votes}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-[15px] font-bold text-[#2f3035]">Quiz khatam! 🎉</p>
          {scores.length === 0 && <p className="text-sm text-[#80848e]">Kisi ne jawab nahi diya 😅</p>}
        </>
      )}
      {scores.length > 0 && (
        <div className="mt-3 rounded-lg bg-black/[0.04] p-2.5">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wide text-[#80848e]">
            <Trophy size={11} /> Scoreboard
          </p>
          {scores.slice(0, 5).map((sc, i) => {
            const name = members.find((x) => x.id === sc.id)?.name || "Member";
            return (
              <div key={sc.id} className="flex items-center justify-between py-0.5 text-[13px]">
                <span className={`font-semibold ${sc.id === me ? "text-[#5865f2]" : "text-[#2f3035]"}`}>
                  {i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : `${i + 1}. `}{name}
                </span>
                <span className="font-extrabold tabular-nums text-[#5c5e66]">{sc.pts} pts</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
