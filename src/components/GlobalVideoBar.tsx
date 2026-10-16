"use client";
// ─────────────────────────────────────────────────────────────
// GlobalVideoBar — app-level mini player.
// Jab Asma-ul-Husna video chal rahi ho (ya paused ho) AUR AsmaPlayer
// closed ho → ye bar poori app me nazar ayega. "Wapas" dabao →
// Deen khul kar AsmaPlayer open, video wahin se resume.
// ─────────────────────────────────────────────────────────────
import { Play, Pause, Square, Clapperboard } from "lucide-react";
import { useVideo, videoToggle, videoStop, fmtVideoTime, VIDEO_POSTER } from "@/lib/videoPlayer";
import { useStore, patchUI } from "@/lib/store";

export default function GlobalVideoBar() {
  const v = useVideo();
  const asmaOpen = useStore((s) => s.ui.asmaOpen);

  if (!v.started || asmaOpen) return null;

  const goBack = () => patchUI({ tab: "deen", asmaOpen: true });

  return (
    <div className="fixed bottom-3 left-3 right-3 z-40 sm:left-auto sm:right-6 sm:w-[380px]">
      <div className="flex items-center gap-2.5 rounded-2xl border border-[#d4af37]/30 bg-[#0e6b4a] p-2.5 pr-3 text-white shadow-2xl">
        <img src={VIDEO_POSTER} alt="" className="h-11 w-16 shrink-0 rounded-lg object-cover" draggable={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-extrabold">Asma-ul-Husna ✨</p>
          <p className="text-[11px] font-bold tabular-nums text-white/70">
            {fmtVideoTime(v.pos)} / {fmtVideoTime(v.dur)}
            {v.playing ? " · chal rahi hai" : " · ruki hui"}
          </p>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-[#d4af37] transition-all"
              style={{ width: v.dur > 0 ? `${(v.pos / v.dur) * 100}%` : "0%" }}
            />
          </div>
        </div>
        <button
          onClick={videoToggle}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d4af37] text-[#083a27] transition active:scale-95"
          aria-label={v.playing ? "Pause" : "Play"}
        >
          {v.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} className="ml-0.5" fill="currentColor" />}
        </button>
        <button
          onClick={videoStop}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white/90 transition active:scale-95"
          aria-label="Stop"
        >
          <Square size={13} fill="currentColor" />
        </button>
        <button
          onClick={goBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white/90 transition active:scale-95"
          aria-label="Video par wapas"
          title="Video par wapas"
        >
          <Clapperboard size={15} />
        </button>
      </div>
    </div>
  );
}
