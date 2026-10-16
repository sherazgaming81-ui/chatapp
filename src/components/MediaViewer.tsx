"use client";
// A7 — full-screen media viewer: pinch/scroll zoom, swipe/arrows between media, counter, X / swipe-down close
import { useEffect, useMemo, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useStore, patchUI, getState } from "@/lib/store";
import { fmtTime, fmtDayLabel } from "@/components/ui";

export default function MediaViewer() {
  const viewer = useStore((s) => s.ui.viewer);
  const [idx, setIdx] = useState(0);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  const images = useMemo(() => {
    const s = getState();
    const chatId = s.ui.activeChatId;
    return s.messages.filter((m) => m.chatId === chatId && m.type === "image" && m.src && !m.deleted);
  }, [viewer]);

  useEffect(() => {
    if (!viewer) return;
    const i = images.findIndex((m) => m.id === viewer.msgId);
    setIdx(i >= 0 ? i : 0);
    setScale(1); setTx(0); setTy(0);
  }, [viewer?.msgId]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard nav
  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") nav(1);
      if (e.key === "ArrowLeft") nav(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [viewer, idx]);

  if (!viewer || images.length === 0) return null;
  const m = images[idx];
  const close = () => patchUI({ viewer: null });
  const nav = (d: number) => {
    setIdx((i) => (i + d + images.length) % images.length);
    setScale(1); setTx(0); setTy(0);
  };

  // touch: pinch zoom + swipe nav + swipe-down close
  const touches = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchD = useRef(0);
  const startY = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => {
    touches.current.set(e.changedTouches[0].identifier, { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY });
    if (touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      pinchD.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
    if (touches.current.size === 1) startY.current = e.changedTouches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    if (touches.current.has(t.identifier)) touches.current.set(t.identifier, { x: t.clientX, y: t.clientY });
    if (touches.current.size === 2) {
      const [a, b] = [...touches.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchD.current > 0) setScale((s) => Math.min(4, Math.max(1, s * (d / pinchD.current))));
      pinchD.current = d;
    } else if (touches.current.size === 1 && scale === 1) {
      setTy(t.clientY - startY.current);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    const start = touches.current.get(t.identifier);
    touches.current.delete(t.identifier);
    if (touches.current.size === 0) {
      const dy = t.clientY - startY.current;
      const dx = start ? t.clientX - start.x : 0;
      if (scale === 1 && dy > 120 && Math.abs(dy) > Math.abs(dx) * 1.5) { close(); return; }
      if (scale === 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { nav(dx < 0 ? 1 : -1); return; }
      setTy(0);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setScale((s) => Math.min(4, Math.max(1, s - e.deltaY * 0.005)));
    }
  };

  const sender = getState().members.find((x) => x.id === m.from);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/95">
      {/* top bar */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-bold tabular-nums">{idx + 1} / {images.length}</span>
        <span className="truncate px-3 text-sm text-white/70">{sender?.name || "Member"} · {fmtDayLabel(m.at)} {fmtTime(m.at)}</span>
        <button onClick={close} className="rounded-lg p-2 hover:bg-white/10" aria-label="Band karo">
          <X size={22} />
        </button>
      </div>
      {/* stage */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        onDoubleClick={() => { setScale((s) => (s > 1 ? 1 : 2.5)); setTx(0); setTy(0); }}
      >
        <img
          src={m.src}
          alt=""
          draggable={false}
          className="max-h-full max-w-full select-none object-contain transition-transform duration-150"
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
        />
        {images.length > 1 && (
          <>
            <button onClick={() => nav(-1)} className="absolute left-3 rounded-full bg-white/10 p-2.5 text-white backdrop-blur hover:bg-white/20" aria-label="Pichli">
              <ChevronLeft size={22} />
            </button>
            <button onClick={() => nav(1)} className="absolute right-3 rounded-full bg-white/10 p-2.5 text-white backdrop-blur hover:bg-white/20" aria-label="Agli">
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
      {/* caption */}
      {m.caption && (
        <p className="shrink-0 px-6 pb-5 pt-1 text-center text-sm text-white/80">{m.caption}</p>
      )}
      {!m.caption && <div className="shrink-0 pb-4" />}
    </div>
  );
}
