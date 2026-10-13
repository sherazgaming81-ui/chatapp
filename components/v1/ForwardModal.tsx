/**
 * ForwardModal — Hinglish "forward this message" dialog.
 *
 * Usage:
 *   const [fwd, setFwd] = useState(false);
 *   {fwd && (
 *     <ForwardModal
 *       messageId={message.id}
 *       chats={chats}
 *       onClose={() => setFwd(false)}
 *       onDone={(targetChatId) => openChat(targetChatId)}
 *     />
 *   )}
 *
 * Lists chats with a "Chat dhoondein" search filter. Tapping a row calls
 * backend.forwardMessage(messageId, chat.id), shows a per-row loading state,
 * then calls onDone(targetChatId) and closes. Backdrop click or Esc closes.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat } from '@/lib/backend/types';
import Avatar from '../Avatar';

export interface ForwardModalProps {
  messageId: string;
  chats: Chat[];
  onClose: () => void;
  onDone?: (targetChatId: string) => void;
}

export function ForwardModal({ messageId, chats, onClose, onDone }: ForwardModalProps) {
  const [q, setQ] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return chats;
    return chats.filter((c) => c.name.toLowerCase().includes(needle));
  }, [chats, q]);

  const forward = async (chat: Chat) => {
    if (sendingTo) return;
    setSendingTo(chat.id);
    setError(null);
    try {
      await backend.forwardMessage(messageId, chat.id);
      onDone?.(chat.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bhejne mein ghalti hui');
      setSendingTo(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[#111b21] rounded-xl w-full max-w-md max-h-[80vh] flex flex-col border border-[#222d34]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222d34]">
          <h2 className="text-white font-semibold text-lg">Aagay bhejein</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="px-5 pt-4">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chat dhoondein"
            className="w-full bg-[#202c33] text-white placeholder-[#8696a0] rounded-lg px-3.5 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[#00a884]"
          />
        </div>

        <div className="p-3 overflow-y-auto flex-1">
          {filtered.length === 0 && (
            <p className="text-[#8696a0] text-sm text-center py-8">Koi chat nahi mili</p>
          )}
          {filtered.map((chat) => {
            const busy = sendingTo === chat.id;
            return (
              <button
                key={chat.id}
                disabled={sendingTo !== null}
                onClick={() => forward(chat)}
                className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-[#202c33] active:bg-[#2a3942] disabled:opacity-60 transition-colors text-left"
              >
                <Avatar photoURL={chat.photoURL} name={chat.name} />
                <span className="flex-1 min-w-0">
                  <span className="block text-white text-sm font-medium truncate">{chat.name}</span>
                  <span className="block text-[#8696a0] text-xs">
                    {chat.type === 'group' ? 'Group' : 'Direct chat'}
                  </span>
                </span>
                {busy ? (
                  <span className="w-5 h-5 border-2 border-[#8696a0] border-t-[#00a884] rounded-full animate-spin" />
                ) : (
                  <span className="text-[#00a884] text-xl">➤</span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="px-5 pb-4">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ForwardModal;
