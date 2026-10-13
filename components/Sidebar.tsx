'use client';

import { useEffect, useMemo, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, UserProfile } from '@/lib/backend/types';
import { fmtListTime } from '@/lib/format';
import Avatar from './Avatar';
import { NewChatModal, NewGroupModal } from './Modals';
import StarredModal from './v1/StarredModal';
import SettingsModal from './SettingsModal';

function Ticks({ blue }: { blue: boolean }) {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" className={blue ? 'text-[#53bdeb]' : 'text-[#8696a0]'}>
      <path
        d="M1.5 6.5l2.5 2.5 5-5.5M7 9l2.5 2.5L15 5"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Sidebar({
  me,
  chats,
  unread,
  selectedChatId,
  onSelectChat,
  onOpenProfile,
}: {
  me: UserProfile;
  chats: Chat[];
  unread: Record<string, number>;
  selectedChatId: string | null;
  onSelectChat: (id: string) => void;
  onOpenProfile: () => void;
}) {
  const [q, setQ] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    backend.getPinnedChats?.().then(setPinnedIds).catch(() => {});
  }, [chats.length]);

  const togglePin = (chatId: string) => {
    const pinned = pinnedIds.includes(chatId);
    backend.setChatPinned(chatId, !pinned).catch(() => {});
    setPinnedIds((prev) => (pinned ? prev.filter((c) => c !== chatId) : [...prev, chatId]));
  };

  const sorted = useMemo(() => {
    const pinSet = new Set(pinnedIds);
    return [...chats].sort((a, b) => {
      const pa = pinSet.has(a.id) ? 0 : 1;
      const pb = pinSet.has(b.id) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }, [chats, pinnedIds]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return sorted;
    return sorted.filter((c) => c.name.toLowerCase().includes(t));
  }, [sorted, q]);

  return (
    <div className="flex flex-col h-full bg-[#111b21] border-r border-[#222d34]">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#202c33]">
        <button onClick={onOpenProfile} className="flex items-center gap-3 min-w-0">
          <Avatar name={me.displayName} photoURL={me.photoURL} size={40} />
          <span className="text-white font-medium truncate hidden sm:block">{me.displayName}</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            title="Starred messages"
            onClick={() => setShowStarred(true)}
            className="p-2 rounded-full text-[#aebac1] hover:bg-[#2a3942] transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.3l-6.2 3.7 1.7-7-5.5-4.7 7.2-.6L12 2l2.8 6.7 7.2.6-5.5 4.7 1.7 7z" />
            </svg>
          </button>
          <button
            title="Settings"
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-full text-[#aebac1] hover:bg-[#2a3942] transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L14.9 3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.4 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6zM12.9 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
            </svg>
          </button>
          <button
            title="New group"
            onClick={() => setShowNewGroup(true)}
            className="p-2 rounded-full text-[#aebac1] hover:bg-[#2a3942] transition"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 0a4 4 0 1 0-.4-7.98A5.99 5.99 0 0 1 9 6a6 6 0 0 1-1.4 3.02A4 4 0 0 0 8 11zm8 2c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4zm-9.3.5A9.4 9.4 0 0 1 8 13c.7 0 1.4 0 2 .1A6.6 6.6 0 0 0 5 17v3H1v-3c0-2 2-3.1 2.7-3.5z" />
            </svg>
          </button>
          <button
            title="New chat"
            onClick={() => setShowNewChat(true)}
            className="p-2 rounded-full text-[#aebac1] hover:bg-[#2a3942] transition"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-3 py-2">
        <div className="flex items-center gap-2 bg-[#202c33] rounded-lg px-3 py-1.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#8696a0">
            <path d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ya new chat shuru karein"
            className="bg-transparent outline-none text-white text-sm w-full placeholder-[#8696a0]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.map((chat) => {
          const n = unread[chat.id] || 0;
          const mine = chat.lastMessage?.senderId === me.id;
          return (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat.id)}
              onContextMenu={(e) => { e.preventDefault(); togglePin(chat.id); }}
              title="Right-click: pin/unpin"
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition border-b border-[#222d34]/60 ${
                selectedChatId === chat.id ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]'
              }`}
            >
              <Avatar name={chat.name} photoURL={chat.photoURL} size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-white font-medium truncate">
                    {pinnedIds.includes(chat.id) && <span className="mr-1">📌</span>}
                    {chat.name}
                  </p>
                  {chat.lastMessage && (
                    <span className={`text-xs shrink-0 ${n > 0 ? 'text-[#00a884] font-semibold' : 'text-[#8696a0]'}`}>
                      {fmtListTime(chat.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-[#8696a0] text-sm truncate flex items-center gap-1">
                    {mine && chat.lastMessage && <Ticks blue={false} />}
                    {chat.lastMessage
                      ? `${chat.type === 'group' && !mine ? chat.lastMessage.senderName.split(' ')[0] + ': ' : ''}${chat.lastMessage.text}`
                      : 'Chat shuru karein 👋'}
                  </p>
                  {n > 0 && (
                    <span className="bg-[#00a884] text-[#0b141a] text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shrink-0">
                      {n}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-[#8696a0] text-sm text-center py-10">Koi chat nahi mili</p>
        )}
      </div>

      {showNewChat && (
        <NewChatModal onClose={() => setShowNewChat(false)} onChatCreated={onSelectChat} />
      )}
      {showNewGroup && (
        <NewGroupModal onClose={() => setShowNewGroup(false)} onChatCreated={onSelectChat} />
      )}
      {showStarred && <StarredModal onClose={() => setShowStarred(false)} />}
      {showSettings && <SettingsModal me={me} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
