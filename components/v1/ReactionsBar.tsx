// ReactionsBar — message par lage emoji reactions ka compact row.
// Props: { message: ChatMessage; meId: string; onToggle: (emoji: string) => void }
// Sirf wahi emojis dikhte hain jinka count > 0; "+"/picker parent handle karta hai.
// Mere reactions accent ring se highlight hote hain. Tap → onToggle(emoji).
// Example:
//   <ReactionsBar message={msg} meId={user.id} onToggle={(e) => backend.toggleReaction(msg.chatId, msg.id, e)} />
'use client';

import type { ChatMessage } from '@/lib/backend/types';

interface ReactionsBarProps {
  message: ChatMessage;
  meId: string;
  onToggle: (emoji: string) => void;
}

const EMOJI_ORDER = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function ReactionsBar({ message, meId, onToggle }: ReactionsBarProps) {
  const reactions = message.reactions ?? {};

  const visible = EMOJI_ORDER.filter((emoji) => (reactions[emoji]?.length ?? 0) > 0);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      {visible.map((emoji) => {
        const users = reactions[emoji] ?? [];
        const mine = users.includes(meId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            aria-pressed={mine}
            aria-label={`Reaction ${emoji}, ${users.length} log`}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] leading-none transition-transform active:scale-95 ${
              mine
                ? 'bg-[#0f3b32] ring-1 ring-[#00a884]'
                : 'bg-[#202c33] ring-1 ring-white/10'
            }`}
          >
            <span>{emoji}</span>
            <span
              className={`tabular-nums text-[11px] ${
                mine ? 'text-[#00a884] font-semibold' : 'text-[#8696a0]'
              }`}
            >
              {users.length}
            </span>
          </button>
        );
      })}
    </div>
  );
}
