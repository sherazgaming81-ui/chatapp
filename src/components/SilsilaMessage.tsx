"use client";
// Fun — Lafz Silsila: lafzon ki chain game (score ke sath)
import { useState } from "react";
import { Send, Trophy } from "lucide-react";
import { toast, useStore } from "@/lib/store";
import { silsilaPlay } from "@/lib/db";
import { parseSilsila } from "@/lib/fun";
import type { Message } from "@/lib/types";

export default function SilsilaMessage({ m }: { m: Message }) {
  const data = parseSilsila(m.caption);
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.me);
  const [val, setVal] = useState("");
  const [sending, setSending] = useState(false);

  if (!data) return <p className="text-sm italic text-[#80848e]">Game load nahi hua</p>;

  const nameOf = (id: string | null | undefined) => members.find((x) => x.id === id)?.name || "Member";
  const shortName = (id: string) => nameOf(id).split(" ")[0];

  const lastWord = data.words[data.words.length - 1]?.w || "";
  const cleaned = lastWord.replace(/[^a-z]/g, "");
  const needChar = cleaned ? cleaned.slice(-1).toUpperCase() : lastWord.slice(-1);
  const scores = Object.entries(data.scores).sort((a, b) => b[1] - a[1]);

  const play = async () => {
    const w = val.trim();
    if (!w || sending) return;
    setSending(true);
    const r = await silsilaPlay(m.id, w);
    setSending(false);
    if (r === "ok") setVal("");
    else if (r === "ended") toast("Ghalat lafz!", "Silsila khatam ho gaya");
    // "blocked" / "invalid" — db khud toast deta hai, yahan kuch khaas nahi
  };

  return (
    <div className="mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        🔤 Lafz Silsila
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-extrabold normal-case tracking-normal ${data.done ? "bg-black/[0.06] text-[#80848e]" : "bg-[#23a55a]/15 text-[#178a4c]"}`}>
          {data.done ? "Khatam" : "🟢 Chal raha hai"}
        </span>
      </p>

      {/* words ke chips */}
      <div className="flex flex-wrap gap-1.5">
        {data.words.map((x, i) => (
          <span key={i} className="inline-flex items-baseline gap-1 rounded-full bg-[#5865f2]/10 px-2.5 py-1 text-[13px] text-[#2f3035]">
            <b>{x.w}</b>
            <span className="text-[11px] text-[#80848e]">{shortName(x.by)}</span>
            {i < data.words.length - 1 && <span className="text-[#5865f2]">→</span>}
          </span>
        ))}
      </div>

      {/* scores */}
      {scores.length > 0 && (
        <p className="mt-2.5 text-xs font-semibold text-[#5c5e66]">
          🏆 {scores.map(([id, pts]) => `${shortName(id)}: ${pts}`).join(" · ")}
        </p>
      )}

      {data.done ? (
        <div className="mt-3 rounded-lg bg-[#f5a623]/10 px-3 py-2.5 text-center">
          {data.winner && (
            <p className="flex items-center justify-center gap-1.5 text-sm font-extrabold text-[#2f3035]">
              <Trophy size={15} className="text-[#f5a623]" /> {nameOf(data.winner)} jeet gaya!
            </p>
          )}
          {data.endedBy && (
            <p className="mt-0.5 text-xs text-[#80848e]">{nameOf(data.endedBy)} ke ghalat lafz par game khatam</p>
          )}
        </div>
      ) : (
        <>
          <p className="mt-2.5 text-xs text-[#80848e]">
            Pichle lafz ke aakhri harf <b className="text-[#5865f2]">'{needChar}'</b> se shuru hone wala lafz (kam se kam 3 harf, pehle wala repeat nahi)
          </p>
          {data.lastBy === me ? (
            <p className="mt-2 text-sm italic text-[#80848e]">Doston ke lafz ka intezar karo…</p>
          ) : (
            <div className="mt-2 flex items-center gap-1.5">
              <input
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); play(); } }}
                placeholder={`${needChar} se lafz likho…`}
                maxLength={30}
                className="field min-w-0 flex-1 px-3 py-2 text-sm"
              />
              <button onClick={play} disabled={sending || !val.trim()} className="btn btn-blurple shrink-0 px-3.5 py-2 text-sm disabled:opacity-60">
                <Send size={14} className="mr-1 inline" /> Bhejo
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
