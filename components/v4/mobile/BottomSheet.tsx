'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * BottomSheet — v4 slide-up sheet (WhatsApp style). Backdrop tap + drag handle to dismiss.
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  height = 'auto',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  height?: string | number;
}) {
  const [render, setRender] = useState(open);
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      setDragY(0);
    } else {
      const t = setTimeout(() => setRender(false), 240);
      return () => clearTimeout(t);
    }
  }, [open ]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open ]);

  if (!render) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    dragging.current = true;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    dragging.current = false;
    if (dragY > 110) onClose();
    else setDragY(0);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 bg-black/60 ${open ? 'wa4-fade-in' : 'opacity-0 transition-opacity duration-200'}`}
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-md rounded-t-[20px] bg-[var(--wa4-sheet)] shadow-[var(--wa4-shadow)] ${open && dragY === 0 ? 'wa4-sheet-in' : ''}`}
        style={{
          maxHeight: '88dvh',
          height: typeof height === 'number' ? `${height}px` : height === 'auto' ? 'auto' : height,
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY > 0 ? 'none' : 'transform 0.2s ease-out, opacity 0.2s',
          opacity: open ? 1 : 0,
        }}
      >
        <div
          className="pt-2.5 pb-1 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-[var(--wa4-muted)]/50" />
        </div>
        {title && (
          <div className="px-5 pt-1 pb-2">
            <h2 className="text-[17px] font-semibold text-[var(--wa4-text)] truncate">{title}</h2>
          </div>
        )}
        <div className="overflow-y-auto wa4-no-scrollbar wa4-safe-bottom" style={{ maxHeight: 'calc(88dvh - 64px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Row button for sheets */
export function SheetRow({
  icon,
  label,
  sub,
  danger,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="wa4-row w-full flex items-center gap-4 px-5 py-3 min-h-[56px] text-left"
    >
      {icon && <span className={`shrink-0 ${danger ? 'text-[var(--wa4-danger)]' : 'text-[var(--wa4-muted)]'}`}>{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className={`block text-[16px] ${danger ? 'text-[var(--wa4-danger)]' : 'text-[var(--wa4-text)]'}`}>{label}</span>
        {sub && <span className="block text-[13px] text-[var(--wa4-muted)] mt-0.5 truncate">{sub}</span>}
      </span>
    </button>
  );
}
