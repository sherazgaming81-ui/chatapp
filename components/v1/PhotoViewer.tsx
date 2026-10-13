// PhotoViewer — 'use client'
// Fullscreen photo viewer with pinch-free basic interactions:
//
// Props:
//   src: string            — image URL to display
//   onClose: () => void    — closes the viewer
//
// Example:
//   {viewing && <PhotoViewer src={viewing} onClose={() => setViewing(null)} />}
//
// Interactions:
//   - Esc key ya backdrop par tap -> band karo
//   - Mouse wheel -> zoom in/out (cursor ke around)
//   - Double-tap / double-click -> zoom toggle (1x <-> 2.5x)
//   - Zoom me drag -> pan karo
//   - Top bar: download (anchor download) + band karein (✕)
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface PhotoViewerProps {
  src: string;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;

export default function PhotoViewer({ src, onClose }: PhotoViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const lastTapRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const clampPan = useCallback(
    (x: number, y: number, z: number) => {
      // Pan range zoom ke saath badhta hai
      const range = 200 * (z - 1);
      return {
        x: Math.max(-range, Math.min(range, x)),
        y: Math.max(-range, Math.min(range, y)),
      };
    },
    []
  );

  const applyZoom = useCallback(
    (next: number, cx?: number, cy?: number) => {
      setZoom((z) => {
        const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
        if (cx !== undefined && cy !== undefined && containerRef.current) {
          // Zoom origin ke around pan adjust karo (basic cursor-centered zoom)
          const rect = containerRef.current.getBoundingClientRect();
          const ox = cx - (rect.left + rect.width / 2);
          const oy = cy - (rect.top + rect.height / 2);
          const scale = nz / z;
          setPan((p) => clampPan(p.x * scale + ox * (1 - scale), p.y * scale + oy * (1 - scale), nz));
        }
        if (nz === MIN_ZOOM) setPan({ x: 0, y: 0 });
        return nz;
      });
    },
    [clampPan]
  );

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    applyZoom(zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const now = Date.now();
    // Double-tap / double-click -> zoom toggle
    if (now - lastTapRef.current < 350) {
      lastTapRef.current = 0;
      applyZoom(zoom > MIN_ZOOM + 0.1 ? MIN_ZOOM : DOUBLE_TAP_ZOOM, e.clientX, e.clientY);
      return;
    }
    lastTapRef.current = now;
    if (zoom > MIN_ZOOM) {
      dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPan(clampPan(d.panX + (e.clientX - d.startX), d.panY + (e.clientY - d.startY), zoom));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const fileName = src.split('/').pop()?.split('?')[0] || 'photo';

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col select-none"
      role="dialog"
      aria-label="Photo viewer"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 shrink-0">
        <span className="text-sm text-[#aebac1] truncate max-w-[50%]">{fileName}</span>
        <div className="flex items-center gap-2">
          <a
            href={src}
            download={fileName}
            aria-label="Download karo"
            title="Download karo"
            className="p-2 rounded-full text-white hover:bg-white/10 transition-colors"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="3" x2="12" y2="15" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="4" y1="21" x2="20" y2="21" />
            </svg>
          </a>
          <button
            onClick={onClose}
            aria-label="Band karein"
            className="p-2 rounded-full text-white hover:bg-white/10 transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Image area (backdrop click closes) */}
      <div
        ref={containerRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex-1 flex items-center justify-center overflow-hidden touch-none"
        style={{ cursor: zoom > MIN_ZOOM ? 'grab' : 'default' }}
      >
        <img
          src={src}
          alt="Photo"
          draggable={false}
          onClick={(e) => {
            // Backdrop (image ke bahar) par tap -> band karo
            if (e.target === containerRef.current) onClose();
          }}
          className="max-w-full max-h-full object-contain transition-transform duration-150 ease-out"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        />
      </div>

      {/* Bottom hint */}
      <div className="py-3 text-center text-xs text-[#8696a0] shrink-0 bg-black/60">
        {zoom > MIN_ZOOM ? 'Drag karo taake ghuma sako' : 'Double-tap karo zoom ke liye'}
      </div>
    </div>
  );
}
