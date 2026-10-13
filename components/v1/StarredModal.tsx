// StarredModal — sare starred (sitare wale) messages dikhane wala modal.
// Props:
//   onClose: () => void  — modal band karne ke liye (Close button, background click, ya Esc)
// Data backend se load hota hai: backend.getStarredMessages().
// Har row me unstar button hai — click par backend.starMessage(id, false) hota hai aur row turant hat jati hai.
// Example:
//   {showStarred && <StarredModal onClose={() => setShowStarred(false)} />}
'use client';

import { useCallback, useEffect, useState } from 'react';
import { backend } from '@/lib/backend';
import type { ChatMessage } from '@/lib/backend/types';

interface Props {
  onClose: () => void;
}

function snippet(m: ChatMessage): string {
  if (m.text) return m.text;
  switch (m.type) {
    case 'image': return '📷 Tasveer';
    case 'audio': return '🎤 Audio';
    case 'poll': return '📊 Poll';
    case 'file': return '📎 File';
    default: return 'Message';
  }
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function StarredModal({ onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    backend.getStarredMessages()
      .then((res) => { if (alive) setMessages(res); })
      .catch(() => { if (alive) setError('Starred messages load nahi ho sake. Dobara koshish karein.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const unstar = useCallback(async (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id)); // optimistic
    try {
      await backend.starMessage(id, false);
    } catch {
      // fail ho to wapas la do
      backend.getStarredMessages().then(setMessages).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-[#111b21] rounded-xl w-full max-w-md max-h-[80vh] flex flex-col border border-[#222d34]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Starred Messages"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222d34]">
          <h2 className="text-white font-semibold text-lg">Starred Messages</h2>
          <button onClick={onClose} className="text-[#8696a0] hover:text-white text-2xl leading-none" aria-label="Band karein">×</button>
        </div>

        <div className="px-5 py-3">
          <p className="text-[#8696a0] text-sm">Sitare wale messages</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {loading && (
            <div className="flex flex-col items-center py-10">
              <div className="w-8 h-8 rounded-full border-2 border-[#2a3942] border-t-[#00a884] animate-spin" />
              <p className="text-[#8696a0] text-sm mt-3">Load ho rahe hain...</p>
            </div>
          )}

          {!loading && error && (
            <p className="text-red-400 text-sm text-center py-10">{error}</p>
          )}

          {!loading && !error && messages.length === 0 && (
            <p className="text-[#8696a0] text-sm text-center py-10">Koi starred message nahi</p>
          )}

          {!loading && !error && messages.length > 0 && (
            <div className="space-y-1">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-[#202c33] transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[#00a884] text-xs font-semibold truncate">{m.senderName}</p>
                      <p className="text-[#8696a0] text-xs shrink-0">{formatDate(m.createdAt)}</p>
                    </div>
                    <p className="text-[#d1d7db] text-sm mt-1 line-clamp-2 break-words">{snippet(m)}</p>
                  </div>
                  <button
                    onClick={() => unstar(m.id)}
                    className="text-lg leading-none shrink-0 p-1 rounded hover:bg-[#2a3942] transition"
                    aria-label="Unstar karein"
                    title="Unstar karein"
                  >
                    ⭐
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
