"use client";
// 3-second premium loading — IDENTICAL on mobile and web.
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
    <div className="flex h-full w-full items-center justify-center">
      <div className="glass-strong flex flex-col items-center rounded-3xl px-12 py-10">
        <div className="relative grid h-24 w-24 place-items-center">
          <div
            className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-[#5865f2] to-[#9b7bff] soft-shadow"
            style={{ animation: "loadpulse 1.4s ease-in-out infinite" }}
          />
          <div
            className="absolute -inset-2 rounded-[34px] border-[3px] border-transparent"
            style={{ borderTopColor: "#5865f2", animation: "ringspin 1.6s linear infinite" }}
          />
          <span className="relative text-5xl font-bold text-white">م</span>
        </div>
        <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-[#2f3035]">ChatsApp</h2>
        <p className="mt-1 text-sm text-[#80848e]">Doston se jor rahe hain…</p>
        <div className="mt-6 h-1.5 w-52 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-gradient-to-r from-[#5865f2] to-[#9b7bff]" style={{ width: `${pct}%`, transition: "width 0.1s linear" }} />
        </div>
      </div>
    </div>
  );
}
