"use client";
// Fun — Truth or Dare card: mode badge + prompt + reroll
import { rerollTruthDare } from "@/lib/db";
import { parseTruthDare, pickTruthDare } from "@/lib/fun";
import type { Message } from "@/lib/types";

export default function TruthDareMessage({ m }: { m: Message }) {
  const data = parseTruthDare(m.caption);
  if (!data) return <p className="text-sm italic text-[#80848e]">Truth/Dare load nahi hua</p>;

  const isTruth = data.mode === "truth";

  const reroll = () => {
    let p = pickTruthDare(data.mode);
    let tries = 0;
    while (p === data.q && tries++ < 5) p = pickTruthDare(data.mode);
    rerollTruthDare(m.id, data.mode, p);
  };

  return (
    <div className="mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        🎲 Truth or Dare
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold text-white"
          style={{ background: isTruth ? "#5865f2" : "#ed4245" }}
        >
          {isTruth ? "🤔 Truth" : "🔥 Dare"}
        </span>
      </p>
      <p className="text-[15px] font-bold leading-snug text-[#2f3035]">{data.q}</p>
      <button onClick={reroll} className="btn btn-ghost mt-3 px-3.5 py-2 text-sm">
        Ek aur 🔀
      </button>
    </div>
  );
}
