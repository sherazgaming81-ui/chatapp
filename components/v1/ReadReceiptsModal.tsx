'use client';

// Usage:
//   import ReadReceiptsModal from '@/components/v1/ReadReceiptsModal';
//   <ReadReceiptsModal chatId={chat.id} messageId={msg.id} onClose={() => setReadersOpen(null)} />
//
// Props: { chatId: string; messageId: string; onClose: () => void }
// Loads backend.getMessageReaders(chatId, messageId) and shows who read the
// message: avatar circle (initial letter, colored), displayName, and a Hinglish
// "parha" timestamp ("aaj 10:32 PM", "kal", full date). Header reads
// "Parha — N logon ne". Shows a loading shimmer while fetching and
// "Abhi kisi ne nahi parha" when empty. Closes on backdrop click or Escape.

import { useEffect, useState } from 'react';
import { backend } from '@/lib/backend';
import type { ReaderInfo } from '@/lib/backend/types';
import { avatarColor, initials } from '@/lib/format';

function readAtText(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (sameDay) return `aaj ${time}`;
  if (isYesterday) return `kal ${time}`;
  return d.toLocaleDateString('ur-PK', { day: 'numeric', month: 'short', year: 'numeric' }) + ` ${time}`;
}

function ShimmerRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-3 animate-pulse">
      <div className="w-11 h-11 rounded-full bg-[#202c33] shrink-0" />
      <div className="flex-1">
        <div className="h-4 w-2/3 rounded bg-[#202c33] mb-2" />
        <div className="h-3 w-1/3 rounded bg-[#202c33]" />
      </div>
      <div className="w-9 h-9 rounded-full bg-[#202c33]/60 shrink-0" />
    </div>
  );
}

export default function ReadReceiptsModal({
  chatId,
  messageId,
  onClose,
}: {
  chatId: string;
  messageId: string;
  onClose: () => void;
}) {
  const [readers, setReaders] = useState<ReaderInfo[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await backend.getMessageReaders(chatId, messageId);
        if (alive) setReaders([...list].sort((a, b) => b.readAt - a.readAt));
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [chatId, messageId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />

      {/* sheet */}
      <div
        className="relative w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl bg-[#111b21] border border-[#222d34] max-h-[80vh] flex flex-col overflow-hidden"
        style={{ animation: 'readers-pop 0.22s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes readers-pop { from { transform: translateY(16px) scale(0.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }`}</style>

        {/* header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-[#202c33] shrink-0">
          <div className="w-10 h-10 rounded-full bg-[#00a884]/15 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M1.5 12.5l5 5L10 14l9.5-9.5"
                stroke="#00a884"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7 12.5l3.5 3.5L14 12.5 20.5 6"
                stroke="#00a884"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.55"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-lg leading-tight">Parha</h2>
            <p className="text-[#8696a0] text-sm">
              {readers === null ? 'Logon ki fehrist la rahe hain...' : `${readers.length} logon ne`}
            </p>
          </div>
          <button onClick={onClose} className="text-[#8696a0] hover:text-white text-2xl leading-none px-1" aria-label="Band karein">
            ×
          </button>
        </div>

        {/* body */}
        <div className="overflow-y-auto py-2 min-h-[120px]">
          {readers === null && !error && (
            <>
              <ShimmerRow />
              <ShimmerRow />
              <ShimmerRow />
            </>
          )}
          {error && (
            <p className="text-center text-red-400 text-sm py-10 px-6">
              Fehrist load nahi ho saki. Dobara koshish karein.
            </p>
          )}
          {readers !== null && readers.length === 0 && (
            <div className="flex flex-col items-center py-12 px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-[#202c33] flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" stroke="#8696a0" strokeWidth="1.6" />
                  <circle cx="12" cy="12" r="2.6" stroke="#8696a0" strokeWidth="1.6" />
                </svg>
              </div>
              <p className="text-white font-medium">Abhi kisi ne nahi parha</p>
              <p className="text-[#8696a0] text-sm mt-1">Jab koi message parega to yahan nazar aayega</p>
            </div>
          )}
          {readers !== null &&
            readers.map((r) => (
              <div key={r.userId} className="flex items-center gap-3 px-5 py-3 hover:bg-[#202c33]/60 transition">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-lg shrink-0 select-none"
                  style={{ background: avatarColor(r.displayName) }}
                >
                  {initials(r.displayName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{r.displayName}</p>
                  <p className="text-[#8696a0] text-sm">{readAtText(r.readAt)}</p>
                </div>
                <div className="shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M1.5 12.5l5 5L10 14l9.5-9.5" stroke="#53bdeb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M7 12.5l3.5 3.5L14 12.5 20.5 6" stroke="#53bdeb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
                  </svg>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
