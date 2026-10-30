"use client";
// 🏆 Ludo Leaderboard — loaded chat history se wins gin kar top 10
import { X, Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { parsePasaV2, pasaBotName } from "@/lib/games";

export default function LudoLeaderboard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const messages = useStore((s) => s.messages);
  const members = useStore((s) => s.members);

  if (!open) return null;

  const nameOf = (id: string): string => members.find((x) => x.id === id)?.name || pasaBotName(id) || "Member";

  const wins: Record<string, number> = {};
  let finishedCount = 0;

  for (const msg of messages) {
    if (msg.type !== "pasa") continue;
    let st: any = null;
    try {
      st = parsePasaV2(msg.caption);
    } catch {
      st = null;
    }
    if (!st || !st.done || !st.winner) continue;
    finishedCount++;
    const players: string[] = Array.isArray(st.players) ? st.players : [];
    const winner: string = st.winner;
    const teams = !!(st.settings && st.settings.teams);
    if (teams && players.length === 4) {
      const idx = players.indexOf(winner);
      if (idx >= 0) {
        const partner = players[(idx + 2) % 4];
        wins[winner] = (wins[winner] || 0) + 1;
        if (partner && partner !== winner) wins[partner] = (wins[partner] || 0) + 1;
      } else {
        wins[winner] = (wins[winner] || 0) + 1;
      }
    } else {
      wins[winner] = (wins[winner] || 0) + 1;
    }
  }

  const ranked = Object.entries(wins)
    .map(([id, n]) => ({ id, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  const rankLabel = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="pop-in fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[360px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-black/10 bg-white p-5 soft-shadow">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-[#2f3035]">
            <Trophy size={19} className="text-[#f5a623]" /> 🏆 Ludo Leaderboard
          </h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#80848e] hover:bg-black/5" aria-label="Band karo">
            <X size={18} />
          </button>
        </div>

        {finishedCount === 0 || ranked.length === 0 ? (
          <p className="mt-4 text-center text-sm leading-relaxed text-[#5c5e66]">
            Abhi koi Ludo match khatam nahi hua — pehle ek match khelo!
          </p>
        ) : (
          <div className="mt-4 space-y-1.5">
            {ranked.map((r, i) => (
              <div
                key={r.id}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 ${i === 0 ? "border-[#f5a623]/40 bg-[#f5a623]/10" : "border-black/[0.06] bg-black/[0.02]"}`}
              >
                <span className="w-7 shrink-0 text-center text-base">{rankLabel(i)}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#2f3035]">{nameOf(r.id)}</span>
                <span className="shrink-0 text-sm font-extrabold text-[#5865f2]">{r.n} jeet</span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 rounded-lg bg-black/[0.04] px-3 py-2 text-[11px] leading-relaxed text-[#80848e]">
          Ye list is device par loaded chat history se bani hai — purani chats load hon to number badal sakte hain.
        </p>
      </div>
    </>
  );
}
