"use client";
// Fun — Kainchi Pathar Kaghaz: challenge → accept → ek sath pick (pehle reveal nahi), pehle 2 jeet
import { Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { parseKainchi } from "@/lib/games";
import { acceptKainchi, kainchiPick } from "@/lib/db";
import type { Message } from "@/lib/types";

type Choice = "rock" | "paper" | "scissors";
const CHOICE_EMOJI: Record<string, string> = { rock: "✊", paper: "✋", scissors: "✌️" };
const emoji = (c: string) => CHOICE_EMOJI[c] || "❓";

export default function KainchiMessage({ m }: { m: Message }) {
  const st: any = parseKainchi(m.caption);
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.me);

  if (!st) return <p className="text-sm italic text-[#80848e]">Game load nahi hua</p>;

  const nameOf = (id: string | null | undefined) => members.find((x) => x.id === id)?.name || "Member";
  const idOf = (v: any): string | null =>
    typeof v === "string" ? v : v && typeof v === "object" ? (v.by || v.id || v.winner || null) : null;

  const challenger: string = st.challenger;
  const opponent: string = st.opponent;
  const isPlayer = me === challenger || me === opponent;
  const oppId = me === challenger ? opponent : challenger;

  const cScore: number = typeof st.cScore === "number" ? st.cScore
    : st.scores && typeof st.scores === "object" && typeof st.scores[challenger] === "number" ? st.scores[challenger]
    : st.score && typeof st.score === "object" && !Array.isArray(st.score) && typeof st.score[challenger] === "number" ? st.score[challenger]
    : Array.isArray(st.score) && typeof st.score[0] === "number" ? st.score[0] : 0;
  const oScore: number = typeof st.oScore === "number" ? st.oScore
    : st.scores && typeof st.scores === "object" && typeof st.scores[opponent] === "number" ? st.scores[opponent]
    : st.score && typeof st.score === "object" && !Array.isArray(st.score) && typeof st.score[opponent] === "number" ? st.score[opponent]
    : Array.isArray(st.score) && typeof st.score[1] === "number" ? st.score[1] : 0;

  // picks: Record<userId, choice> ya { challenger/opponent } — sirf apni pick + "us ne chuna ya nahi"
  const pickOf = (id: string): string | null => {
    const p: any = st.picks;
    if (!p || typeof p !== "object") return null;
    if (typeof p[id] === "string") return p[id];
    if (id === challenger && typeof p.challenger === "string") return p.challenger;
    if (id === opponent && typeof p.opponent === "string") return p.opponent;
    if (Array.isArray(p)) {
      const hit = p.find((x: any) => x && (x.by === id || x.id === id));
      return hit ? (hit.choice || hit.pick || hit.c || null) : null;
    }
    return null;
  };
  const myPick = isPlayer ? pickOf(me) : null;
  const oppPicked = isPlayer ? !!pickOf(oppId) : false;

  const last: any = st.last && typeof st.last === "object" ? st.last : null;
  const lastWinnerId = last ? idOf(last.w ?? last.winner) : null;
  const winnerId = idOf(st.winner);

  return (
    <div className="mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        ✂️ Kainchi Pathar Kaghaz
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-extrabold normal-case tracking-normal ${st.done ? "bg-black/[0.06] text-[#80848e]" : st.accepted ? "bg-[#23a55a]/15 text-[#178a4c]" : "bg-[#f5a623]/15 text-[#9a6a00]"}`}>
          {st.done ? "Khatam" : st.accepted ? "🟢 Chal raha hai" : "Challenge"}
        </span>
      </p>

      <p className="text-center text-sm font-bold text-[#2f3035]">
        {nameOf(challenger)} ⚔️ {nameOf(opponent)}
      </p>
      <p className="mt-0.5 text-center text-xs font-semibold text-[#80848e]">
        ({cScore} — {oScore}) · pehle 2 jeet
      </p>

      {!st.accepted ? (
        <div className="mt-2.5 text-center">
          {me === opponent ? (
            <button onClick={() => acceptKainchi(m.id)} className="rounded-lg bg-[#23a55a] px-5 py-2 text-sm font-extrabold text-white transition active:scale-95">
              Challenge qabool karo ✅
            </button>
          ) : (
            <p className="text-xs text-[#80848e]">{nameOf(opponent)} ke jawab ka intezar…</p>
          )}
        </div>
      ) : !st.done ? (
        isPlayer ? (
          myPick ? (
            <div className="mt-2.5 text-center">
              <p className="text-sm font-semibold text-[#178a4c]">✅ Tumne chun liya — dost ka intezar</p>
              <p className="mt-1 text-xs text-[#80848e]">
                {nameOf(oppId)}: {oppPicked ? "❓ chun liya (chhupa hai)" : "abhi nahi chuna"}
              </p>
            </div>
          ) : (
            <div className="mt-2.5 flex gap-1.5">
              <button onClick={() => kainchiPick(m.id, "rock")} className="flex-1 rounded-lg border border-black/10 bg-white px-2 py-2.5 text-sm font-extrabold text-[#2f3035] transition hover:border-[#5865f2]/50 active:scale-[0.98]">✊ Pathar</button>
              <button onClick={() => kainchiPick(m.id, "paper")} className="flex-1 rounded-lg border border-black/10 bg-white px-2 py-2.5 text-sm font-extrabold text-[#2f3035] transition hover:border-[#5865f2]/50 active:scale-[0.98]">✋ Kaghaz</button>
              <button onClick={() => kainchiPick(m.id, "scissors")} className="flex-1 rounded-lg border border-black/10 bg-white px-2 py-2.5 text-sm font-extrabold text-[#2f3035] transition hover:border-[#5865f2]/50 active:scale-[0.98]">✌️ Kainchi</button>
            </div>
          )
        ) : (
          <p className="mt-2 text-center text-[11px] text-[#a0a3ab]">Dekhne wale mode 👀 — dono ke chunav ka intezar</p>
        )
      ) : null}

      {last && last.a && last.b && (
        <p className="mt-2.5 text-center text-[13px] font-semibold text-[#5c5e66]">
          {nameOf(challenger)}: {emoji(last.a)} vs {nameOf(opponent)}: {emoji(last.b)} — {lastWinnerId ? `${nameOf(lastWinnerId)} round jeeta` : "Draw"}
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
