'use client';

/**
 * PhotoViewer — fullscreen photo viewer (WhatsApp style).
 * Double-click par zoom toggle (1x ↔ 2.5x), zoom par drag se pan,
 * wheel se zoom, Esc ya bahar click par band.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, ICONS } from './common';

interface Props {
  src: string;
  caption?: string;
  onClose(): void;
}

export default function PhotoViewer({ src, caption, onClose }: Props) {
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const toggleZoom = useCallback((cx?: number, cy?: number) => {
    setZoom((z) => {
      if (z > 1) {
        setPan({ x: 0, y: 0 });
        setOrigin({ x: 50, y: 50 });
        return 1;
      }
      if (cx !== undefined && cy !== undefined && wrapRef.current) {
        const r = wrapRef.current.getBoundingClientRect();
        setOrigin({ x: ((cx - r.left) / r.width) * 100, y: ((cy - r.top) / r.height) * 100 });
      }
      return 2.5;
    });
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => {
      const next = Math.min(4, Math.max(1, z + (e.deltaY < 0 ? 0.4 : -0.4)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[95] bg-black/95 flex flex-col animate-[v4fade_.18s_ease-out] select-none"
      role="dialog"
      aria-modal
      aria-label="Photo viewer"
    >
      <div className="flex items-center gap-3 px-4 py-3 shrink-0 text-white/90">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition" aria-label="Band karein">
          <Icon d={ICONS.x} size={22} />
        </button>
        {caption && <p className="text-[14px] truncate text-white/80">{caption}</p>}
        <div className="flex-1" />
        <a
          href={src}
          download
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-full hover:bg-white/10 transition"
          title="Download karein"
          onClick={(e) => e.stopPropagation()}
        >
          <Icon d={ICONS.download} size={20} />
        </a>
      </div>

      <div
        ref={wrapRef}
        className="flex-1 min-h-0 flex items-center justify-center overflow-hidden px-4 pb-4"
        onDoubleClick={(e) => toggleZoom(e.clientX, e.clientY)}
        onWheel={onWheel}
        onPointerDown={(e) => {
          if (zoom <= 1) return;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          dragRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d) return;
          setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) });
        }}
        onPointerUp={() => { dragRef.current = null; }}
        style={{ cursor: zoom > 1 ? 'grab' : 'zoom-in', touchAction: 'none' }}
      >
        <img
          src={src}
          alt={caption || 'Photo'}
          draggable={false}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-200"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: `${origin.x}% ${origin.y}%`,
          }}
        />
      </div>

      <p className="shrink-0 text-center text-[12px] text-white/40 pb-4">
        Double-click: zoom · Scroll: zoom in/out · Drag: ghumayein
      </p>
    </div>
  );
}
