'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { backend, isDemoMode } from '@/lib/backend';
import type { Chat, ChatMessage, UserProfile } from '@/lib/backend/types';
import ChatView from '@/components/ChatView';
import LoginScreen from '@/components/LoginScreen';
import Sidebar from '@/components/Sidebar';
import ProfileEditor from '@/components/v1/ProfileEditor';
import Splash from '@/components/v1/Splash';
import OfflineBanner from '@/components/v1/OfflineBanner';
import useKeyboardShortcuts from '@/lib/v1/useKeyboardShortcuts';
import { playSound, type SoundId } from '@/lib/v1/sounds';
import type { ChatNotificationSettings } from '@/lib/backend/types';

function WelcomeScreen() {
  return (
    <div className="hidden md:flex flex-col items-center justify-center h-full bg-[#222e35] text-center px-8">
      <div className="w-24 h-24 rounded-full bg-[#00a884]/15 flex items-center justify-center mb-6">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="#00a884">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.5 14.1c-.2.6-1.3 1.2-1.9 1.2-.5.1-1.1.2-3.7-.8-3.1-1.3-5.1-4.5-5.3-4.7-.1-.2-1.2-1.7-1.2-3.2s.8-2.3 1-2.6c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5-.3.6-.6.8-.4 1.1.6 1.1 1.4 1.9 2.5 2.4.3.2.5.1.7-.1l.8-.9c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.4 0 .1 0 .5-.4 1.8z" />
        </svg>
      </div>
      <h1 className="text-white text-2xl font-light mb-3">Chat Web</h1>
      <p className="text-[#8696a0] text-sm max-w-md leading-relaxed">
        Ab aap apne doston se seedha browser se chat kar sakte hain.
        <br />
        Koi call feature nahi — sirf tez aur simple messaging.
      </p>
      <div className="mt-8 pt-6 border-t border-[#2a3942] w-full max-w-md">
        <p className="text-[#8696a0] text-xs flex items-center justify-center gap-2">
          <span>🔒</span> Aapki personal messages yahin rehte hain
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [showProfile, setShowProfile] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const lastMsgIds = useRef<Record<string, string>>({});
  const chatSettingsCache = useRef<Record<string, ChatNotificationSettings>>({});
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  useEffect(() => backend.onAuth((u) => { setUser(u); setAuthReady(true); }), []);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Keyboard shortcuts (F20)
  useKeyboardShortcuts({
    onEscape: () => { setSelectedId(null); setShowProfile(false); },
    onNextChat: () => {
      if (chats.length === 0) return;
      const i = chats.findIndex((c) => c.id === selectedId);
      setSelectedId(chats[(i + 1 + chats.length) % chats.length].id);
    },
    onPrevChat: () => {
      if (chats.length === 0) return;
      const i = chats.findIndex((c) => c.id === selectedId);
      setSelectedId(chats[(i - 1 + chats.length) % chats.length].id);
    },
  });
  // v1: har login user auto main group me; background sweeps (scheduled + disappearing)
  useEffect(() => {
    if (!user) return;
    backend.ensureMainGroup().catch(() => {});
    const sweep = () => {
      backend.sweepScheduledMessages?.().catch(() => {});
      backend.sweepDisappearing?.().catch(() => {});
    };
    sweep();
    const t = setInterval(sweep, 60000);
    return () => clearInterval(t);
  }, [user]);
  useEffect(() => {
    if (!user) return;
    return backend.onChats(setChats);
  }, [user]);

  const chatIdsKey = useMemo(() => chats.map((c) => c.id).join(','), [chats]);

  useEffect(() => {
    if (!user || chats.length === 0) return;
    const unsubs = chats.map((chat) =>
      backend.onMessages(chat.id, (msgs) => {
        const n = msgs.filter(
          (m) => m.senderId !== user.id && !m.readBy.includes(user.id) && !(m.deletedFor || []).includes(user.id)
        ).length;
        setUnread((prev) => (prev[chat.id] === n ? prev : { ...prev, [chat.id]: n }));
        // v1: naye incoming message par sound (muted chats me nahi, khuli chat me nahi)
        const incoming = msgs.filter((m) => m.senderId !== user.id);
        const last = incoming[incoming.length - 1];
        if (last && lastMsgIds.current[chat.id] && lastMsgIds.current[chat.id] !== last.id) {
          if (chat.id !== selectedIdRef.current) {
            const s = chatSettingsCache.current[chat.id];
            if (!s?.muted) {
              try { playSound(((s?.sound as SoundId) || 'default')); } catch {}
            }
          }
        }
        if (last) lastMsgIds.current[chat.id] = last.id;
        if (!chatSettingsCache.current[chat.id]) {
          backend.getChatNotificationSettings(chat.id)
            .then((st) => { chatSettingsCache.current[chat.id] = st; })
            .catch(() => {});
        }
      })
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, chatIdsKey]);

  useEffect(() => {
    if (!user || !selectedId) { setMessages([]); return; }
    return backend.onMessages(selectedId, setMessages);
  }, [user, selectedId]);

  const selectedChat = chats.find((c) => c.id === selectedId) || null;

  if (!authReady) {
    return (
      <>
        <Splash ready={false} />
        <div className="h-screen flex items-center justify-center bg-[#0b141a]">
          <div className="w-10 h-10 rounded-full border-2 border-[#00a884] border-t-transparent animate-spin" />
        </div>
      </>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <div className="h-screen flex flex-col bg-[#0b141a]">
      <Splash ready={true} />
      <OfflineBanner online={online} />
      {isDemoMode && (
        <div className="bg-[#182229] text-[#ffd279] text-xs text-center py-1.5 px-3 shrink-0 border-b border-[#222d34]">
          Demo mode — Supabase/Firebase keys lagane par asli Google login aur real-time chat chalegi
        </div>
      )}
      <div className="flex-1 flex min-h-0">
        <div className={`${selectedId ? 'hidden' : 'flex'} md:flex w-full md:w-[38%] lg:w-[32%] shrink-0`}>
          <div className="w-full">
            <Sidebar
              me={user}
              chats={chats}
              unread={unread}
              selectedChatId={selectedId}
              onSelectChat={setSelectedId}
              onOpenProfile={() => setShowProfile(true)}
            />
          </div>
        </div>
        <div className={`${selectedId ? 'flex' : 'hidden'} md:flex flex-1 min-w-0`}>
          {selectedChat ? (
            <div className="w-full">
              <ChatView
                me={user}
                chat={selectedChat}
                chats={chats}
                messages={messages}
                onBack={() => setSelectedId(null)}
              />
            </div>
          ) : (
            <div className="w-full"><WelcomeScreen /></div>
          )}
        </div>
      </div>
      {showProfile && <ProfileEditor me={user} onClose={() => setShowProfile(false)} />}
    </div>
  );
}
