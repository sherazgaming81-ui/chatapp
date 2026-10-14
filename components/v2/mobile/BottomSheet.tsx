'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * BottomSheet — reusable slide-up modal for mobile.
 * Backdrop tap + drag handle (touch) to dismiss.
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
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      setDragY(0);
    } else {
      const t = setTimeout(() => setRender(false), 220);
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
        className={`absolute inset-0 bg-black/60 ${open ? 'mv2-fade-anim' : 'opacity-0 transition-opacity duration-200'}`}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={`relative w-full max-w-md rounded-t-2xl bg-[var(--mv2-sheet)] shadow-[var(--mv2-shadow)] ${open && dragY === 0 ? 'mv2-sheet-anim' : ''}`}
        style={{
          maxHeight: '85dvh',
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
          <div className="mx-auto h-1 w-10 rounded-full bg-[var(--mv2-muted)]/40" />
        </div>
        {title && (
          <div className="px-5 pt-1 pb-2">
            <h2 className="text-[17px] font-semibold text-[var(--mv2-text)]">{title}</h2>
          </div>
        )}
        <div className="overflow-y-auto mv2-safe-bottom" style={{ maxHeight: 'calc(85dvh - 60px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Simple row button used inside bottom sheets */
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
      className="w-full flex items-center gap-4 px-5 py-3.5 min-h-[56px] active:bg-[var(--mv2-accent-soft)] text-left"
    >
      {icon && <span className={danger ? 'text-[var(--mv2-danger)]' : 'text-[var(--mv2-muted)]'}>{icon}</span>}
      <span className="flex-1">
        <span className={`block text-[16px] ${danger ? 'text-[var(--mv2-danger)]' : 'text-[var(--mv2-text)]'}`}>{label}</span>
        {sub && <span className="block text-[13px] text-[var(--mv2-muted)] mt-0.5">{sub}</span>}
      </span>
    </button>
  );
}
