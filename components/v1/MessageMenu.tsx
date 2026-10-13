/**
 * MessageMenu — Hinglish context menu for a chat message.
 *
 * Usage:
 *   // Open on long-press or right-click:
 *   const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
 *   useLongPress(bubbleRef, (e) => {
 *     const p = e instanceof TouchEvent ? e.touches[0] : e;
 *     setMenu({ x: p.clientX, y: p.clientY });
 *   });
 *   // or onContextMenu: (e) => setMenu({ x: e.clientX, y: e.clientY })
 *   {menu && (
 *     <MessageMenu
 *       message={msg} mine={msg.senderId === me} isAdmin={isAdmin}
 *       x={menu.x} y={menu.y}
 *       onReply={...} onEdit={...} onForward={...} onStar={...}
 *       onPin={...} onDelete={...} onClose={() => setMenu(null)}
 *     />
 *   )}
 *
 * Items: Reply ("Jawab dein"), Edit ("Tabdeel karein", only if mine && text),
 * Forward ("Aagay bhejein"), Star/Unstar ("Star karein"), Pin/Unpin
 * ("Pin karein", only if isAdmin), Delete ("Delete karein", red).
 * Backdrop click or Esc closes. Pass `starred`/`pinned` to flip Star/Pin labels.
 */
'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { ChatMessage } from '@/lib/backend/types';

export interface MessageMenuProps {
  message: ChatMessage;
  mine: boolean;
  isAdmin: boolean;
  starred?: boolean;
  pinned?: boolean;
  x?: number; // viewport coords for positioning; defaults to center-ish
  y?: number;
  onReply(): void;
  onEdit(): void;
  onForward(): void;
  onStar(): void;
  onPin(): void;
  onDelete(): void;
  onClose(): void;
}

/** Long-press helper: fires `onLongPress` after 500ms of held touch/pointer. */
export function useLongPress(
  ref: React.RefObject<HTMLElement | null>,
  onLongPress: (e: TouchEvent | MouseEvent | PointerEvent) => void,
  ms = 500,
) {
  const fire = useRef(onLongPress);
  fire.current = onLongPress;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const start = (e: TouchEvent | MouseEvent) => {
      timer = setTimeout(() => fire.current(e as PointerEvent), ms);
    };
    const cancel = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const onTouchMove = () => cancel();

    el.addEventListener('mousedown', start as EventListener);
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseleave', cancel);
    el.addEventListener('touchstart', start as EventListener, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchcancel', cancel);
    return () => {
      cancel();
      el.removeEventListener('mousedown', start as EventListener);
      el.removeEventListener('mouseup', cancel);
      el.removeEventListener('mouseleave', cancel);
      el.removeEventListener('touchstart', start as EventListener);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', cancel);
      el.removeEventListener('touchcancel', cancel);
    };
  }, [ref, ms]);
}

const itemCls =
  'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white hover:bg-[#202c33] active:bg-[#2a3942] rounded-lg transition-colors text-left';

export function MessageMenu({
  message,
  mine,
  isAdmin,
  starred,
  pinned,
  x,
  y,
  onReply,
  onEdit,
  onForward,
  onStar,
  onPin,
  onDelete,
  onClose,
}: MessageMenuProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canEdit = mine && message.type === 'text';

  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    // Clamp menu inside viewport after first paint.
    const t = requestAnimationFrame(() => {
      const box = boxRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const pad = 8;
      if (r.right > window.innerWidth - pad) box.style.left = `${Math.max(pad, window.innerWidth - r.width - pad)}px`;
      if (r.bottom > window.innerHeight - pad) box.style.top = `${Math.max(pad, window.innerHeight - r.height - pad)}px`;
    });
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(t);
    };
  }, [close]);

  const act = (fn: () => void) => () => {
    fn();
    close();
  };

  return (
    <div className="fixed inset-0 z-50" onClick={close} onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={boxRef}
        className="absolute bg-[#233138] rounded-xl shadow-2xl border border-[#2a3942] py-1.5 w-52"
        style={{
          left: x !== undefined ? x : '50%',
          top: y !== undefined ? y : '50%',
          transform: x === undefined || y === undefined ? 'translate(-50%,-50%)' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className={itemCls} onClick={act(onReply)}>↩️ Jawab dein</button>
        {canEdit && <button className={itemCls} onClick={act(onEdit)}>✏️ Tabdeel karein</button>}
        <button className={itemCls} onClick={act(onForward)}>➡️ Aagay bhejein</button>
        <button className={itemCls} onClick={act(onStar)}>{starred ? '⭐ Unstar karein' : '⭐ Star karein'}</button>
        {isAdmin && <button className={itemCls} onClick={act(onPin)}>{pinned ? '📌 Unpin karein' : '📌 Pin karein'}</button>}
        <div className="my-1 border-t border-[#2a3942]" />
        <button className={`${itemCls} text-red-400`} onClick={act(onDelete)}>🗑️ Delete karein</button>
      </div>
    </div>
  );
}

export default MessageMenu;
