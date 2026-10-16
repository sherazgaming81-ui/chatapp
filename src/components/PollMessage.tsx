"use client";
// B5 — poll message: animated percentage bars, tap to vote / change vote
import { useEffect, useState } from "react";
import { BarChart3, Clock } from "lucide-react";
import { useStore } from "@/lib/store";
import { parsePoll, pollVotes, votePoll } from "@/lib/db";
import type { Message } from "@/lib/types";

const EMPTY_OBJ: Record<string, string[]> = {};

function fmtLeft(ms: number): string {
  if (ms <= 0) return "Band ho gaya";
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  if (h >= 24) return `${Math.floor(h / 24)} din baqi`;
  if (h > 0) return `${h}h ${m}m baqi`;
  return `${m}m baqi`;
}

export default function PollMessage({ m }: { m: Message }) {
  const reactions = useStore((s) => s.messages.find((x) => x.id === m.id)?.reactions || EMPTY_OBJ);
  const [, tick] = useState(0);
  const poll = parsePoll(m.caption);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  if (!poll) return <p className="text-sm italic text-[#80848e]">Poll load nahi hua</p>;
  const closed = poll.endsAt < Date.now();
  const { counts, total, mine } = pollVotes({ ...m, reactions });

  return (
    <div className="mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <p className="mb-0.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        <BarChart3 size={13} /> Poll
      </p>
      <p className="mb-2.5 text-[15px] font-bold leading-snug text-[#2f3035]">{poll.q}</p>
      <div className="space-y-1.5">
        {poll.opts.map((opt, i) => {
          const pct = total === 0 ? 0 : Math.round((counts[i] / total) * 100);
          const isMine = mine === i;
          return (
            <button
              key={i}
              disabled={closed}
              onClick={() => votePoll(m.id, i)}
              className={`relative block w-full overflow-hidden rounded-lg border text-left transition active:scale-[0.99] ${
                isMine ? "border-[#5865f2] bg-[#5865f2]/[0.08]" : "border-black/10 bg-black/[0.03] hover:border-[#5865f2]/50"
              } ${closed ? "cursor-default" : ""}`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-[#5865f2]/20 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center justify-between px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#2f3035]">
                  {opt} {isMine && <span className="ml-1 text-xs font-bold text-[#5865f2]">✓ aapka vote</span>}
                </span>
                <span className="ml-2 shrink-0 text-xs font-bold tabular-nums text-[#5c5e66]">{pct}% · {counts[i]}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 flex items-center gap-1.5 text-xs text-[#80848e]">
        <Clock size={12} /> {fmtLeft(poll.endsAt - Date.now())} · {total} vote{total === 1 ? "" : "s"}
        {!closed && mine >= 0 && <span> · vote badalne ke liye dobara tap karo</span>}
      </p>
    </div>
  );
}
