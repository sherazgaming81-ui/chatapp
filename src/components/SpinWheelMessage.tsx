"use client";
// Fun — Spin Wheel: SVG wheel, result aane par CSS transition se ghum kar rukta hai
import { useEffect, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { spinWheelNow } from "@/lib/db";
import { parseSpin } from "@/lib/fun";
import type { Message } from "@/lib/types";

const PALETTE = ["#5865f2", "#23a55a", "#f5a623", "#ed4245", "#9b7bff", "#00b0f4", "#ff7a59", "#2fbf71"];
const C = 115; // center (viewBox 230)
const R = 108; // radius

function segPath(i: number, n: number): string {
  const seg = 360 / n;
  const a0 = ((i * seg - 90) * Math.PI) / 180;
  const a1 = (((i + 1) * seg - 90) * Math.PI) / 180;
  const x0 = C + R * Math.cos(a0);
  const y0 = C + R * Math.sin(a0);
  const x1 = C + R * Math.cos(a1);
  const y1 = C + R * Math.sin(a1);
  const large = seg > 180 ? 1 : 0;
  return `M ${C} ${C} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

function labelPos(i: number, n: number): { x: number; y: number } {
  const seg = 360 / n;
  const am = (((i + 0.5) * seg - 90) * Math.PI) / 180;
  return { x: C + 70 * Math.cos(am), y: C + 70 * Math.sin(am) };
}

const short = (s: string) => (s.length > 10 ? s.slice(0, 9) + "…" : s);

export default function SpinWheelMessage({ m }: { m: Message }) {
  const spin = parseSpin(m.caption);
  const members = useStore((s) => s.members);
  const [busy, setBusy] = useState(false);

  const result = spin?.result ?? null;
  const n = spin?.options.length ?? 0;
  const seg = n > 0 ? 360 / n : 0;
  const finalRot = result !== null ? 360 * 5 + (360 - (result * seg + seg / 2)) : 0;

  // pehle se result ke sath mount (purana message) → baghair animation final position
  const [rot, setRot] = useState<number>(() => (result !== null ? finalRot : 0));
  const [animate, setAnimate] = useState(false);
  const [settled, setSettled] = useState<boolean>(() => result !== null);
  const prevResult = useRef<number | null>(result);

  useEffect(() => {
    const was = prevResult.current;
    prevResult.current = result;
    if (was === null && result !== null) {
      // naya result aya — wheel ghumao aur winner animation ke baad dikhao
      setAnimate(true);
      const t1 = setTimeout(() => setRot(finalRot), 40);
      const t2 = setTimeout(() => setSettled(true), 3550);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (result !== null) setSettled(true);
  }, [result, finalRot]);

  if (!spin) return <p className="text-sm italic text-[#80848e]">Wheel load nahi hua</p>;

  const spunByName = spin.spunBy ? members.find((x) => x.id === spin.spunBy)?.name || "Member" : null;

  const doSpin = () => {
    if (busy || result !== null) return;
    setBusy(true);
    spinWheelNow(m.id).catch(() => setBusy(false));
  };

  return (
    <div className="mt-1.5 w-full max-w-sm rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#5865f2]">
        🎡 Spin Wheel
      </p>
      <div className="relative mx-auto h-[230px] w-[230px] max-w-full">
        {/* pointer — upar, neeche ki taraf */}
        <div
          className="absolute -top-1 left-1/2 z-10 -translate-x-1/2"
          style={{ width: 0, height: 0, borderLeft: "11px solid transparent", borderRight: "11px solid transparent", borderTop: "18px solid #2f3035" }}
        />
        <svg
          viewBox="0 0 230 230"
          className="h-full w-full drop-shadow"
          style={{
            transform: `rotate(${rot}deg)`,
            transition: animate ? "transform 3.4s cubic-bezier(0.12, 0.8, 0.08, 1)" : "none",
          }}
        >
          {spin.options.map((opt, i) => {
            const lp = labelPos(i, n);
            return (
              <g key={i}>
                <path d={segPath(i, n)} fill={PALETTE[i % PALETTE.length]} stroke="#ffffff" strokeWidth={2} />
                <text
                  x={lp.x}
                  y={lp.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize={11}
                  fontWeight={700}
                >
                  {short(opt)}
                </text>
              </g>
            );
          })}
          <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={2} />
        </svg>
        {/* center circle */}
        <div className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-black/10 bg-white text-xl soft-shadow">
          🎡
        </div>
      </div>
      {result === null ? (
        <button onClick={doSpin} disabled={busy} className="btn btn-blurple mt-3 w-full py-2.5 text-sm disabled:opacity-60">
          {busy ? "Ghum raha hai…" : "Ghumaao 🎡"}
        </button>
      ) : settled ? (
        <div className="mt-3 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[15px] font-extrabold text-[#2f3035]">
            <Trophy size={16} className="text-[#f5a623]" /> {spin.options[result]}
          </p>
          {spunByName && <p className="mt-0.5 text-xs text-[#80848e]">{spunByName} ne ghumaya</p>}
        </div>
      ) : (
        <p className="mt-3 text-center text-sm font-semibold text-[#80848e]">Ghum raha hai… 🎡</p>
      )}
    </div>
  );
}
