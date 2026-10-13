// PinnedBar — chat ke top par pinned messages ki horizontal strip.
// Props:
//   messages: ChatMessage[]  — pinned messages (isPinned wale), khaali ho to kuch render nahi hota
//   onJump: (messageId: string) => void  — chip par tap karne par call hota hai (message tak scroll karne ke liye)
// Example:
//   <PinnedBar messages={pinned} onJump={(id) => scrollToMessage(id)} />
'use client';

import type { ChatMessage } from '@/lib/backend/types';

interface Props {
  messages: ChatMessage[];
  onJump: (messageId: string) => void;
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

export default function PinnedBar({ messages, onJump }: Props) {
  if (messages.length === 0) return null;

  return (
    <div className="flex items-center gap-2 bg-[#202c33] rounded-lg mx-2 mt-2 px-2 py-1.5 h-[44px] shrink-0 border border-[#2a3942]">
      <span className="text-[#00a884] text-base leading-none shrink-0" aria-label="Pinned messages">📌</span>
      <div className="flex gap-2 overflow-x-auto flex-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {messages.map((m) => (
          <button
            key={m.id}
            onClick={() => onJump(m.id)}
            className="flex items-center gap-1.5 bg-[#2a3942] hover:bg-[#374045] transition rounded-md px-2 py-1 max-w-[220px] shrink-0 text-left"
          >
            <span className="text-[#00a884] text-xs font-semibold truncate max-w-[70px] shrink-0">
              {m.senderName}
            </span>
            <span className="text-[#d1d7db] text-xs line-clamp-2 leading-tight break-words">
              {snippet(m)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
