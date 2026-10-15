"use client";
import { useEffect } from "react";

const BUBBLES = [
  { x: 20, y: 70, w: 78, h: 34, c: "#1c2a27", d: 1.0, out: false },
  { x: 214, y: 52, w: 70, h: 32, c: "#0f5a43", d: 1.25, out: true },
  { x: 6, y: 170, w: 64, h: 30, c: "#0f5a43", d: 1.5, out: true },
  { x: 226, y: 168, w: 74, h: 34, c: "#1c2a27", d: 1.75, out: false },
];

/** 3-second branded intro: draw (0–1s) → bubbles (1–2s) → ticks (2–2.5s) → tagline (2.5–3s). Pure CSS keyframes = 60fps. */
export default function Loader({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed inset-0 z-[300] grid place-items-center overflow-hidden" style={{ background: "radial-gradient(circle at 50% 38%, #12302a 0%, #0a1311 62%)", animation: "ld-out .35s ease 2.95s forwards" }}>
      <div className="flex flex-col items-center">
        <svg width="320" height="300" viewBox="0 0 320 300" style={{ maxWidth: "88vw" }}>
          <defs>
            <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3be39a" /><stop offset="1" stopColor="#14a96f" /></linearGradient>
          </defs>
          {BUBBLES.map((b, i) => (
            <g key={i} className="ld-b" style={{ animationDelay: `${b.d}s`, transformBox: "fill-box", transformOrigin: b.out ? "100% 100%" : "0% 100%" }}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="14" fill={b.c} stroke="#ffffff14" />
              <rect x={b.x + 12} y={b.y + 11} width={b.w - 38} height="5" rx="2.5" fill="#ffffff55" />
              <rect x={b.x + 12} y={b.y + 20} width={(b.w - 24) * 0.5} height="5" rx="2.5" fill="#ffffff30" />
            </g>
          ))}
          <g transform="translate(80 28) scale(2.4)">
            <path pathLength={100} d="M32 6C17 6 6 16 6 29c0 7 3.5 13 9 17l-2 11 11-5c3 .8 5.5 1 8 1 15 0 26-10 26-24S47 6 32 6z" fill="none" stroke="#3be39a" strokeWidth="1.8" strokeLinejoin="round" className="ld-draw" style={{ strokeDasharray: 100, strokeDashoffset: 100 }} />
            <path d="M32 6C17 6 6 16 6 29c0 7 3.5 13 9 17l-2 11 11-5c3 .8 5.5 1 8 1 15 0 26-10 26-24S47 6 32 6z" fill="url(#lg)" className="ld-fill" />
            <path pathLength={100} d="M21 30l8 8 15-16" fill="none" stroke="#04140d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 100, strokeDashoffset: 100, animation: "ld-draw .5s ease .6s forwards" }} />
          </g>
          {/* double ticks grey → blue */}
          <g transform="translate(246 236)" fill="none" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" stroke="#8696a0">
            <path pathLength={30} d="M0 9l6 6 13-14" className="ld-tick1" style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: "ld-tickdraw .3s ease 2s forwards, ld-blue .25s ease 2.3s forwards" }} />
            <path pathLength={30} d="M8 9l6 6 13-14" className="ld-tick2" style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: "ld-tickdraw .3s ease 2.12s forwards, ld-blue .25s ease 2.3s forwards" }} />
          </g>
        </svg>
        <div className="-mt-3 text-3xl font-extrabold tracking-tight text-white">Chats<span className="text-[#3be39a]">App</span></div>
        <div className="ld-tag mt-2 text-[15px] tracking-wide text-[#9bb7ad]">Baatein, ab aur qareeb</div>
      </div>
    </div>
  );
}
