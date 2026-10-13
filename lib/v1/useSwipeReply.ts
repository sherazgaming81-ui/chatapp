/**
 * useSwipeReply — swipe-right-to-reply gesture hook.
 *
 * Usage:
 *   const bubbleRef = useRef<HTMLDivElement>(null);
 *   useSwipeReply(bubbleRef, () => startReply(message));
 *
 * Attaches touchstart/touchmove/touchend to the element. A horizontal swipe
 * RIGHT past `threshold` (default 64px) with mostly-horizontal movement calls
 * onReply() once per gesture. A subtle translateX visual follows the finger and
 * resets afterwards. Vertical scrolls are ignored. Cleans up on unmount.
 */
'use client';

import { useEffect } from 'react';

interface SwipeReplyOpts {
  threshold?: number; // px of rightward travel needed, default 64
}

export function useSwipeReply(
  ref: React.RefObject<HTMLElement | null>,
  onReply: () => void,
  opts?: SwipeReplyOpts,
) {
  const threshold = opts?.threshold ?? 64;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let fired = false;
    let lockedHorizontal: boolean | null = null;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
      fired = false;
      lockedHorizontal = null;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (lockedHorizontal === null) {
        // Wait until we know which direction the user is going.
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        lockedHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
        if (!lockedHorizontal) {
          tracking = false; // vertical scroll — bail out
          return;
        }
      }
      if (lockedHorizontal === false) return;

      // Only reward rightward swipes; clamp the visual offset.
      const x = Math.max(0, Math.min(dx, 96));
      el.style.transform = `translateX(${x}px)`;
      if (dx >= threshold && !fired) {
        fired = true;
        onReply();
      }
    };

    const reset = () => {
      tracking = false;
      el.style.transition = 'transform 0.15s ease-out';
      el.style.transform = 'translateX(0)';
      window.setTimeout(() => {
        el.style.transition = '';
      }, 180);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', reset, { passive: true });
    el.addEventListener('touchcancel', reset, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', reset);
      el.removeEventListener('touchcancel', reset);
      el.style.transform = '';
      el.style.transition = '';
    };
  }, [ref, onReply, threshold]);
}

export default useSwipeReply;
