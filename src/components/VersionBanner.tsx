"use client";
// 13 — "Naya version" banner (v8.0 pattern): naya deploy mile to banner, user jab chahe update kare — koi force reload nahi
import { useEffect, useRef, useState } from "react";
import { X, Sparkles } from "lucide-react";

export default function VersionBanner() {
  const [show, setShow] = useState(false);
  const base = useRef<string | null>(null);
  const dismissed = useRef(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const v = String(j.version || "");
        if (!v) return;
        if (base.current === null) {
          base.current = v; // pehli fetch = current version
          return;
        }
        if (v !== base.current && !dismissed.current && alive) setShow(true);
      } catch { /* ignore */ }
    };
    check();
    const iv = setInterval(check, 5 * 60e3); // har 5 min
    return () => { alive = false; clearInterval(iv); };
  }, []);

  if (!show) return null;
  return (
    <div className="version-banner z-[100] flex shrink-0 items-center justify-center gap-2.5 bg-gradient-to-r from-[#5865f2] to-[#9b7bff] px-4 py-2.5 text-sm font-bold text-white soft-shadow">
      <Sparkles size={16} className="shrink-0" />
      <span className="truncate">🎉 Naya version aaya hai!</span>
      <button
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-full bg-white px-3.5 py-1 text-xs font-extrabold text-[#5865f2] transition hover:bg-white/90 active:scale-95"
      >
        Update karo
      </button>
      <button
        onClick={() => { dismissed.current = true; setShow(false); }}
        className="shrink-0 rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white"
        aria-label="Band karo"
      >
        <X size={14} />
      </button>
    </div>
  );
}
