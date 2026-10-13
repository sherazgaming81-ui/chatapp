// useKeyboardShortcuts — 'use client'
// Global keyboard shortcuts hook for the Chat app.
//
// Keymap:
//   Esc            -> onEscape (modal/menu band karo)
//   Ctrl/Cmd + K   -> onSearch (chat search kholo)
//   Alt + ArrowDown -> onNextChat (agli chat)
//   Alt + ArrowUp   -> onPrevChat (pichli chat)
//
// Notes:
//   - Typing in input/textarea/contenteditable me shortcut ignore hote hain,
//     sirf Esc wahan bhi kaam karta hai (modal/menu band karne ke liye).
//   - Handlers ko ref me rakha jata hai taake har render par
//     listener re-attach na ho.
//
// Example:
//   useKeyboardShortcuts({
//     onEscape: () => closeAllModals(),
//     onSearch: () => setSearchOpen(true),
//     onNextChat: () => selectChat(nextId),
//     onPrevChat: () => selectChat(prevId),
//   });
//
//   // Help modal ke liye:
//   import { SHORTCUT_HELP } from '@/lib/v1/useKeyboardShortcuts';
'use client';

import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  onEscape?: () => void;
  onSearch?: () => void;
  onNextChat?: () => void;
  onPrevChat?: () => void;
}

export interface ShortcutInfo {
  key: string;
  label: string;
}

export const SHORTCUT_HELP: ShortcutInfo[] = [
  { key: 'Esc', label: 'Modal / menu band karo' },
  { key: 'Ctrl/⌘ + K', label: 'Chat me dhoondein' },
  { key: 'Alt + ↓', label: 'Agli chat' },
  { key: 'Alt + ↑', label: 'Pichli chat' },
];

export default function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable);

      // Esc hamesha chalega — input me ho tab bhi (modal band karne ke liye)
      if (e.key === 'Escape') {
        ref.current.onEscape?.();
        return;
      }

      // Baaki shortcut input me typing karte waqt ignore karo
      if (typing) return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        ref.current.onSearch?.();
        return;
      }

      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        ref.current.onNextChat?.();
        return;
      }
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        ref.current.onPrevChat?.();
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
