'use client';

/**
 * DesktopShell — ChatsApp v4 desktop (WhatsApp Web new dark UI, pixel-faithful).
 * Layout: icon rail (64px) | chat list (380px) | conversation (flex) |
 * right slide-over (chat info / profile).
 * No props — backend se directly wired. Login gate included.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, UserProfile } from '@/lib/backend/types';
import LoginScreen from '@/components/LoginScreen';
import { V4Styles, backendV3, v4call } from './common';
import IconRail, { type RailTab } from './IconRail';
import ChatList, { NewChatModal } from './ChatList';
import Conversation from './Conversation';
import ChatInfo from './ChatInfo';
import ProfilePanel from './ProfilePanel';
import SettingsModal from './SettingsModal';
import Welcome from './Welcome';

const UNREAD_KEY = 'v4-unreads';

function loadUnreads(): Record<string, number> {
  try {
    const raw = localStorage.getItem(UNREAD_KEY);
    if (raw) return JSON.parse(raw) as Record<string, number>;
  } catch {}
  return {};
}

export default function DesktopShell() {
  const [authChecked, setAuthChecked] = useState(false);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [railTab, setRailTab] = useState<RailTab>('chats');
  const [infoOpen, setInfoOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [unreads, setUnreads] = useState<Record<string, number>>(loadUnreads);
  const [jumpTo, setJumpTo] = useState<{ id: string; at: number } | null>(null);

  const meRef = useRef<UserProfile | null>(null);
  const selectedRef = useRef<string | null>(null);
  const prevLmRef = useRef<Record<string, number>>({});
  const initRef = useRef(false);
  const archiveSwept = useRef(false);

  useEffect(() => { meRef.current = me; }, [me]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

  // auth
  useEffect(
    () =>
      backend.onAuth((u) => {
        setMe(u);
        setAuthChecked(true);
        if (u) {
          backend.ensureMainGroup().catch(() => {});
          if (!archiveSwept.current) {
            archiveSwept.current = true;
            v4call(() => backendV3.autoArchiveInactive()).catch(() => {});
          }
        } else {
          setSelectedId(null);
          setInfoOpen(false);
          setProfileOpen(false);
          initRef.current = false;
          prevLmRef.current = {};
        }
      }),
    [],
  );

  // chats + unread tracking
  useEffect(() => {
    if (!me) return;
    return backend.onChats((list) => {
      setChats(list);
      if (!initRef.current) {
        initRef.current = true;
        for (const c of list) prevLmRef.current[c.id] = c.lastMessage?.createdAt ?? 0;
        return;
      }
      setUnreads((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const c of list) {
          const ts = c.lastMessage?.createdAt ?? 0;
          const was = prevLmRef.current[c.id] ?? 0;
          if (
            ts > was &&
            c.lastMessage &&
            c.lastMessage.senderId !== meRef.current?.id &&
            c.id !== selectedRef.current
          ) {
            next[c.id] = (next[c.id] ?? 0) + 1;
            changed = true;
          }
          prevLmRef.current[c.id] = Math.max(was, ts);
        }
        if (changed) {
          try { localStorage.setItem(UNREAD_KEY, JSON.stringify(next)); } catch {}
          return next;
        }
        return prev;
      });
    });
  }, [me]);

  const selectChat = useCallback((id: string) => {
    setSelectedId(id);
    setProfileOpen(false);
    setUnreads((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      try { localStorage.setItem(UNREAD_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const onRailTab = useCallback((t: RailTab) => {
    setRailTab(t);
    if (t === 'settings') setSettingsOpen(true);
  }, []);

  const selectedChat = chats.find((c) => c.id === selectedId) ?? null;

  if (!authChecked) {
    return (
      <div className="v4root h-screen w-screen flex items-center justify-center bg-[#0b141a]" data-theme="dark">
        <V4Styles />
        <div className="flex flex-col items-center gap-4">
          <div className="w-11 h-11 rounded-full border-[3px] border-[#1f2c34] border-t-[#00a884] animate-spin" />
          <p className="text-sm text-[#8696a0]">ChatsApp khul raha hai…</p>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="v4root h-screen w-screen bg-[#0b141a]">
        <V4Styles />
        <LoginScreen />
      </div>
    );
  }

  return (
    <div className="v4root h-screen w-screen flex overflow-hidden bg-[#0b141a] text-[#e9edef]">
      <V4Styles />

      {/* far-left icon rail */}
      <IconRail
        me={me}
        tab={railTab}
        onTab={onRailTab}
        onProfile={() => { setProfileOpen(true); setInfoOpen(false); }}
      />

      {/* chat list */}
      <aside className="w-[380px] min-w-[320px] max-w-[440px] shrink-0 border-r border-[#222d34] bg-[#111b21]">
        <ChatList
          me={me}
          chats={chats}
          selectedId={selectedId}
          onSelect={selectChat}
          unreads={unreads}
          railTab={railTab}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </aside>

      {/* conversation / welcome */}
      <main className="flex-1 min-w-0 relative flex flex-col">
        {selectedChat ? (
          <Conversation
            key={selectedChat.id}
            chat={selectedChat}
            chats={chats}
            me={me}
            onOpenInfo={() => { setInfoOpen(true); setProfileOpen(false); }}
            jumpTo={jumpTo}
            onJumpHandled={() => setJumpTo(null)}
          />
        ) : (
          <Welcome onNewChat={() => setNewChatOpen(true)} />
        )}

        {/* right slide-over */}
        {(infoOpen || profileOpen) && (
          <aside className="absolute right-0 top-0 bottom-0 w-[380px] max-w-[92%] border-l border-[#222d34] z-30 shadow-2xl bg-[#111b21]">
            {infoOpen && selectedChat ? (
              <ChatInfo
                key={selectedChat.id}
                chat={selectedChat}
                me={me}
                onClose={() => setInfoOpen(false)}
                onJumpTo={(id) => setJumpTo({ id, at: Date.now() })}
              />
            ) : (
              <ProfilePanel me={me} onClose={() => setProfileOpen(false)} />
            )}
          </aside>
        )}
      </main>

      {/* settings */}
      {settingsOpen && (
        <SettingsModal
          me={me}
          onClose={() => { setSettingsOpen(false); setRailTab('chats'); }}
          onOpenProfile={() => { setSettingsOpen(false); setRailTab('chats'); setProfileOpen(true); setInfoOpen(false); }}
        />
      )}

      {/* new chat from welcome */}
      {newChatOpen && (
        <NewChatModal meId={me.id} onClose={() => setNewChatOpen(false)} onDone={(id) => { selectChat(id); }} />
      )}
    </div>
  );
}
