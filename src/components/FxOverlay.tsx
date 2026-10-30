"use client";
// Chat Effects / Super Reaction — full-screen effect overlay (~2.6s, pointer-events-none)
// confetti: canvas-confetti (repo pattern — SetupChecklist/videoPlayer jaisa)
// hearts/stars: Web Animations API se emoji neeche se upar float (CSS file edit nahi)
import { useEffect, useMemo, useRef } from "react";
import confetti from "canvas-confetti";
import type { FxKind } from "@/lib/fun";

interface Particle { left: number; delay: number; dur: number; size: number; drift: number }

export default function FxOverlay({ kind, emoji, onDone }: { kind: FxKind; emoji: string; onDone?: () => void }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const spansRef = useRef<(HTMLSpanElement | null)[]>([]);
  const parts = useMemo<Particle[]>(
    () =>
      Array.from({ length: 26 }, () => ({
        left: Math.random() * 100,
        delay: Math.random() * 700,
        dur: 1900 + Math.random() * 900,
        size: 20 + Math.random() * 22,
        drift: (Math.random() - 0.5) * 140,
      })),
    []
  );

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (kind === "confetti") {
      const colors = ["#5865f2", "#23a55a", "#f5a623", "#ed4245", "#ffffff"];
      try {
        confetti({ particleCount: 130, spread: 85, origin: { y: 0.55 }, colors });
        timers.push(setTimeout(() => {
          try { confetti({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors }); } catch { /* ignore */ }
        }, 300));
        timers.push(setTimeout(() => {
          try { confetti({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors }); } catch { /* ignore */ }
        }, 450));
      } catch { /* ignore */ }
    } else {
      spansRef.current.forEach((el, i) => {
        if (!el) return;
        const p = parts[i];
        if (!p) return;
        try {
          el.animate(
            [
              { transform: "translate(0, 0) rotate(0deg)", opacity: 0 },
              { transform: `translate(${p.drift * 0.4}px, -32vh) rotate(40deg)`, opacity: 1, offset: 0.25 },
              { transform: `translate(${p.drift}px, -108vh) rotate(-30deg)`, opacity: 0.85 },
            ],
            { duration: p.dur, delay: p.delay, easing: "ease-out", fill: "forwards" }
          );
        } catch { /* ignore */ }
      });
    }
    timers.push(setTimeout(() => doneRef.current?.(), 2600));
    return () => timers.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[95] overflow-hidden" aria-hidden>
      {kind !== "confetti" &&
        parts.map((p, i) => (
          <span
            key={i}
            ref={(el) => { spansRef.current[i] = el; }}
            className="absolute -bottom-12 select-none"
            style={{ left: `${p.left}%`, fontSize: p.size, opacity: 0 }}
          >
            {emoji}
          </span>
        ))}
    </div>
  );
}
