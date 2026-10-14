'use client';

/**
 * HomeWidget — chhota embeddable widget: recent chats ka preview.
 * Sidebar se ya kahin se bhi khola ja sakta hai. Simple, clean.
 */

import Avatar from '@/components/Avatar';
import { fmtListTime } from '@/lib/format';
import type { Chat } from '@/lib/backend/types';
import { Icon, ICONS } from './common';

interface Props {
  chats: Chat[];
  onOpen(chatId: string): void;
  onClose(): void;
  limit?: number;
}

export default function HomeWidget({ chats, onOpen, onClose, limit = 6 }: Props) {
  const recent = [...chats]
    .sort((a, b) => (b.lastMessage?.createdAt ?? b.updatedAt ?? 0) - (a.lastMessage?.createdAt ?? a.updatedAt ?? 0))
    .slice(0, limit);

  return (
    <div className="w-[340px] bg-[var(--v2-panel)] text-[var(--v2-text)] border border-[var(--v2-border)] rounded-2xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--v2-border)]">
        <h3 className="text-[14.5px] font-semibold">Recent chats</h3>
        <button onClick={onClose} className="p-1 rounded-full text-[var(--v2-muted)] hover:bg-[var(--v2-hover)] transition">
          <Icon d={ICONS.x} size={17} />
        </button>
      </div>
      <div className="max-h-[380px] overflow-y-auto v2scroll py-1">
        {recent.length === 0 && (
          <p className="text-center text-[13px] text-[var(--v2-muted)] py-8 px-6">
            Abhi koi chat nahi. Nayi chat shuru karein!
          </p>
        )}
        {recent.map((c) => (
          <button
            key={c.id}
            onClick={() => onOpen(c.id)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--v2-hover)] transition text-left"
          >
            <Avatar name={c.name} photoURL={c.photoURL} size={42} />
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[14px] font-medium truncate">{c.name}</span>
                {c.lastMessage && (
                  <span className="text-[11px] text-[var(--v2-muted)] shrink-0">{fmtListTime(c.lastMessage.createdAt)}</span>
                )}
              </span>
              <span className="block text-[12.5px] text-[var(--v2-muted)] truncate mt-0.5">
                {c.lastMessage ? previewText(c.lastMessage.type, c.lastMessage.text) : 'Chat shuru karein'}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t border-[var(--v2-border)]">
        <p className="text-[11.5px] text-[var(--v2-muted)] text-center">ChatsApp · {chats.length} chats</p>
      </div>
    </div>
  );
}

function previewText(type: string, text: string) {
  if (type === 'image') return '📷 Photo';
  if (type === 'audio') return '🎤 Voice message';
  if (type === 'poll') return '📊 Poll';
  if (type === 'file') return `📎 ${text || 'File'}`;
  return text;
}
