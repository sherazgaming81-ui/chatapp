"use client";
// 3-second premium loading — Claude-style: minimal, white, calm breathing.
// IDENTICAL on mobile and web.
import { useEffect, useState } from "react";

export default function Loader() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - t0) / 2800) * 100));
      setPct(p);
      if (p >= 100) clearInterval(iv);
    }, 50);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <div className="flex flex-col items-center px-8">
        {/* Claude-style breathing logo */}
        <div className="relative grid h-20 w-20 place-items-center">
          <div
            className="absolute inset-0 rounded-[24px] bg-gradient-to-br from-[#5865f2] to-[#9b7bff]"
            style={{ animation: "claude-breathe 2.4s ease-in-out infinite" }}
          />
          <span className="relative text-4xl font-bold text-white">م</span>
        </div>
        {/* Brand */}
        <h2 className="mt-7 text-[26px] font-semibold tracking-tight text-[#1a1b1e]">
          ChatsApp
        </h2>
        {/* Claude-style typing dots */}
        <div className="mt-3 flex items-center gap-1.5" aria-hidden>
          <span className="h-1.5 w-1.5 rounded-full bg-[#b6b8c0]" style={{ animation: "claude-dot 1.2s ease-in-out infinite" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[#b6b8c0]" style={{ animation: "claude-dot 1.2s ease-in-out 0.2s infinite" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-[#b6b8c0]" style={{ animation: "claude-dot 1.2s ease-in-out 0.4s infinite" }} />
        </div>
        <p className="mt-3 text-[13px] text-[#8a8d98]">Doston se jor rahe hain…</p>
        {/* Thin Claude-style progress line */}
        <div className="mt-8 h-[3px] w-44 overflow-hidden rounded-full bg-[#eef0f3]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#5865f2] to-[#9b7bff]"
            style={{ width: `${pct}%`, transition: "width 0.1s linear" }}
          />
        </div>
      </div>
    </div>
  );
}
