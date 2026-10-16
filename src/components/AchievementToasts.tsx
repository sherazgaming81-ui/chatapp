"use client";
// Phase 6 — F6 Minecraft-style achievement popup (top se slide-in).
import { useEffect, useState } from "react";
import { onBadgeUnlock, type BadgeDef } from "@/lib/achievements";

export default function AchievementToasts() {
  const [queue, setQueue] = useState<BadgeDef[]>([]);

  useEffect(() => {
    return onBadgeUnlock((b) => {
      setQueue((q) => [...q, b]);
      setTimeout(() => setQueue((q) => q.slice(1)), 3800);
    });
  }, []);

  const cur = queue[0];
  if (!cur) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-[110] -translate-x-1/2">
      <div
        key={cur.id + Date.now()}
        className="flex items-center gap-3 rounded-2xl border-2 border-[#d4af37] bg-gradient-to-br from-[#2b2d31] to-[#1e1f22] px-4 py-3 text-white shadow-2xl"
        style={{ animation: "achv-in 0.45s cubic-bezier(0.2, 1.4, 0.4, 1)" }}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#d4af37]/20 text-2xl">{cur.icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#d4af37]">Achievement hasil hui! 🏆</p>
          <p className="truncate text-sm font-extrabold">{cur.title}</p>
          <p className="truncate text-xs text-white/60">{cur.desc}</p>
        </div>
      </div>
      <style>{`@keyframes achv-in { from { transform: translateY(-120%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}
