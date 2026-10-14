'use client';

import { useEffect, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import type { Chat } from '@/lib/backend/types';
import { chatDisplayName, chatPhoto } from './ChatList';
import { tapHaptic } from '../shared/haptics';

/**
 * ChatBubbles — Messenger-style floating chat bubble (mobile).
 * Jab koi nayi unread chat ho aur user kahin aur ho, bubble tairta hai:
 * tap → chat khul jati hai, neeche drag → dismiss.
 */
export default function ChatBubbles({
  chat,
  userId,
  unreadCount,
  onOpen,
  onDismiss,
}: {
  chat: Chat | null;
  userId: string;
  unreadCount: number;
  onOpen: (chat: Chat) => void;
  onDismiss: (chatId: string) => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [overTrash, setOverTrash] = useState(false);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // naye chat par position reset (neeche-dayein)
  useEffect(() => {
    if (chat) setPos(null);
  }, [chat?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!chat) return null;
  const name = chatDisplayName(chat, userId);

  const startDrag = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = { sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const moveDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 8) { d.moved = true; setDragging(true); }
    if (!d.moved) return;
    const w = window.innerWidth, h = window.innerHeight;
    const x = Math.min(w - 64, Math.max(8, d.ox + dx));
    const y = Math.min(h - 120, Math.max(70, d.oy + dy));
    setPos({ x, y });
    // trash zone: neeche center
    setOverTrash(e.clientY > h - 140 && Math.abs(e.clientX - w / 2) < 90);
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (d.moved) {
      tapHaptic();
      if (overTrash) onDismiss(chat.id);
      setOverTrash(false);
    } else {
      tapHaptic();
      onOpen(chat);
    }
  };

  const style: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' }
    : { right: 16, bottom: 96 };

  return (
    <>
      {/* trash zone */}
      {dragging && (
        <div className="fixed inset-x-0 bottom-0 z-[75] flex justify-center pb-8 pointer-events-none mv2-fade-anim">
          <div className={`flex items-center gap-2 px-5 h-12 rounded-full transition-all ${overTrash ? 'bg-[var(--mv2-danger)] scale-110' : 'bg-black/70 border border-white/20'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
            <span className="text-white text-[13px] font-medium">Yahan chhodein — band karein</span>
          </div>
        </div>
      )}
      <div
        ref={ref}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`fixed z-[75] touch-none ${dragging ? 'scale-110' : 'mv2-pop-anim'} transition-transform`}
        style={style}
        role="button"
        aria-label={`${name} kholein`}
      >
        <div className={`relative rounded-full p-[3px] ${overTrash ? 'bg-[var(--mv2-danger)]' : 'bg-[var(--mv2-accent)]'} shadow-[0_8px_24px_rgba(0,0,0,0.45)]`}>
          <span className="block rounded-full overflow-hidden bg-[var(--mv2-header)]">
            <Avatar name={name} photoURL={chatPhoto(chat, userId)} size={54} />
          </span>
          {unreadCount > 0 && !overTrash && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-[var(--mv2-danger)] text-white text-[11px] font-bold flex items-center justify-center border-2 border-[var(--mv2-bg)]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
