// PollCard — poll message ke liye UI.
// Props: { message: ChatMessage; meId: string }
// message.poll null ho to kuch render nahi karta (null return).
// Tap karne par `backend.votePoll(chatId, messageId, idx)` call hota hai;
// local optimistic highlight, errors silently catch.
// Example:
//   <PollCard message={msg} meId={user.id} />
'use client';

import { useMemo, useState } from 'react';
import type { ChatMessage } from '@/lib/backend/types';
import { backend } from '@/lib/backend';

interface PollCardProps {
  message: ChatMessage;
  meId: string;
}

export default function PollCard({ message, meId }: PollCardProps) {
  const poll = message.poll;
  // Optimistic: main ne abhi jis option ko tap kiya, backend update se pehle wahi dikhao.
  const [optimisticIdx, setOptimisticIdx] = useState<number | null>(null);

  // Total votes backend data se hi ginata hoon (realtime update aa jata hai).
  const totals = useMemo(() => {
    if (!poll) return { per: [] as number[], total: 0, myIdx: null as number | null };
    const per = poll.options.map((_, i) => poll.votes[String(i)]?.length ?? 0);
    const total = per.reduce((a, b) => a + b, 0);
    let myIdx: number | null = null;
    poll.options.forEach((_, i) => {
      if (poll.votes[String(i)]?.includes(meId)) myIdx = i;
    });
    // optimistic lagao agar backend me abhi mera vote na dikhe
    if (optimisticIdx !== null && optimisticIdx !== myIdx) myIdx = optimisticIdx;
    return { per, total, myIdx };
  }, [poll, meId, optimisticIdx]);

  if (!poll) return null;

  const handleVote = (idx: number) => {
    if (totals.myIdx === idx) return; // wahi option dobara tap → kuch nahi
    setOptimisticIdx(idx);
    backend.votePoll(message.chatId, message.id, idx).catch(() => {
      /* silently ignore — realtime update aayega ya nahi aayega */
    });
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-[#111b21] px-3.5 py-3 min-w-[220px] max-w-[280px]">
      {/* Sawal */}
      <p className="text-[14px] font-semibold leading-snug text-white break-words">
        {poll.question}
      </p>

      {/* Options */}
      <div className="flex flex-col gap-1.5">
        {poll.options.map((opt, i) => {
          const count = totals.per[i] ?? 0;
          const pct = totals.total > 0 ? Math.round((count / totals.total) * 100) : 0;
          const isMine = totals.myIdx === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleVote(i)}
              aria-pressed={isMine}
              className={`relative overflow-hidden rounded-lg px-3 py-2 text-left transition-transform active:scale-[0.98] ${
                isMine
                  ? 'bg-[#0f3b32] ring-1 ring-[#00a884]'
                  : 'bg-[#202c33] hover:bg-[#2a3942]'
              }`}
            >
              {/* Animated vote bar */}
              <div
                className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${
                  isMine ? 'bg-[#00a884]/25' : 'bg-[#8696a0]/15'
                }`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className={`text-[13px] leading-snug break-words ${isMine ? 'text-white font-medium' : 'text-white/90'}`}>
                  {opt}
                </span>
                <span className={`shrink-0 text-[12px] tabular-nums ${isMine ? 'text-[#00a884] font-semibold' : 'text-[#8696a0]'}`}>
                  {pct}% · {count}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-[11px] text-[#8696a0]">
        {totals.total === 0
          ? 'Abhi koi vote nahi — pehla vote karein'
          : `${totals.total} vote${totals.total > 1 ? 's' : ''}`}
      </p>
    </div>
  );
}
