'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import LoginScreen from '@/components/LoginScreen';
import { backend, backendV2 } from '@/lib/backend';
import type { BackendV2 } from '@/lib/v2/types';
import type { Chat, ChatMessage, UserProfile } from '@/lib/backend/types';
import ChatsScreen from './ChatsScreen';
import ChatScreen from './ChatScreen';
import SettingsScreen from './SettingsScreen';
import BottomSheet from './BottomSheet';
import { tapHaptic } from '../../v2/shared/haptics';
import { ChatsNavIcon, GroupsNavIcon, SettingsNavIcon, LockIcon, StarIcon, XIcon } from './icons';
import '../../v2/mobile/v2-mobile.css';
import './v4-mobile.css';

const backendV2x = backendV2 as unknown as BackendV2;

type Tab = 'chats' | 'groups' | 'settings';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

/**
 * MobileShell — v4 mobile app (FINAL). WhatsApp Android dark, pixel-faithful.
 * No props; backend directly. Tabs: Chats | Groups | Settings (no calls).
 */
export default function MobileShell() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>('chats');
  const [selected, setSelected] = useState<Chat | null>(null);

  const [lockedIds, setLockedIds] = useState<string[]>(() => readJSON('v4-locked', []));
  const [pin, setPin] = useState<string | null>(() => { try { return localStorage.getItem('v4-pin'); } catch { return null; } });
  const [pinSheet, setPinSheet] = useState<{ chat: Chat; mode: 'set' | 'confirm'; first: string } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readJSON('v4-favs', []));
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readJSON('v4-pinned', []));
  const [archivedIds, setArchivedIds] = useState<string[]>(() => readJSON('v4-archived', []));
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [showStarred, setShowStarred] = useState(false);
  const [starred, setStarred] = useState<ChatMessage[]>([]);

  // ---- auth ----
  useEffect(() => backend.onAuth((u) => { setUser(u); setAuthReady(true); }), []);

  // ---- main group + sweeps ----
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
  }, [user ]);

  // ---- chats + unread ----
  useEffect(() => {
    if (!user) return;
    return backend.onChats((cs) => {
      setChats(cs);
      setSelected((prev) => (prev ? cs.find((c) => c.id === prev.id) || null : null));
    });
  }, [user ]);

  useEffect(() => {
    if (!user || chats.length === 0) return;
    const unsubs = chats.map((chat) =>
      backend.onMessages(chat.id, (msgs: ChatMessage[]) => {
        const n = msgs.filter(
          (m) => m.senderId !== user.id && !(m.readBy || []).includes(user.id) && !(m.deletedFor || []).includes(user.id)
        ).length;
        setUnread((prev) => (prev[chat.id] === n ? prev : { ...prev, [chat.id]: n }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [user, chats ]);

  // ---- blocked ----
  const refreshBlocked = useCallback(async () => {
    try { setBlockedIds((await backendV2x.getBlockedUsers()).map((b) => b.userId)); }
    catch { /* backend support nahi */ }
  }, []);
  useEffect(() => { if (user) refreshBlocked(); }, [user, refreshBlocked ]);

  // ---- persist ----
  useEffect(() => { try { localStorage.setItem('v4-locked', JSON.stringify(lockedIds)); } catch {} }, [lockedIds]);
  useEffect(() => { try { localStorage.setItem('v4-favs', JSON.stringify(favoriteIds)); } catch {} }, [favoriteIds]);
  useEffect(() => { try { localStorage.setItem('v4-pinned', JSON.stringify(pinnedIds)); } catch {} }, [pinnedIds]);
  useEffect(() => { try { localStorage.setItem('v4-archived', JSON.stringify(archivedIds)); } catch {} }, [archivedIds]);

  // ---- lock / pin ----
  const isChatLocked = useCallback((id: string) => lockedIds.includes(id), [lockedIds]);
  const verifyPin = useCallback((p: string) => pin !== null && p === pin, [pin ]);

  const lockChat = (chat: Chat) => {
    setLockedIds((ids) => (ids.includes(chat.id) ? ids : [...ids, chat.id]));
    backendV2x.setChatLocked?.(chat.id, true).catch(() => {});
  };
  const unlockChat = (id: string) => {
    setLockedIds((ids) => ids.filter((x) => x !== id));
    backendV2x.setChatLocked?.(id, false).catch(() => {});
  };
  const toggleLock = (chat: Chat) => {
    if (isChatLocked(chat.id)) { unlockChat(chat.id); return; }
    if (!pin) {
      setPinSheet({ chat, mode: 'set', first: '' });
      setPinInput('');
      setPinError(false);
      return;
    }
    lockChat(chat);
  };
  const submitPinSetup = () => {
    if (!pinSheet) return;
    if (pinInput.length < 4) { setPinError(true); return; }
    if (pinSheet.mode === 'set') {
      setPinSheet({ ...pinSheet, mode: 'confirm', first: pinInput });
      setPinInput('');
      setPinError(false);
    } else if (pinInput === pinSheet.first) {
      try { localStorage.setItem('v4-pin', pinInput); } catch {}
      setPin(pinInput);
      lockChat(pinSheet.chat);
      setPinSheet(null);
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  // ---- favorites ----
  const toggleFavorite = useCallback((id: string) => {
    setFavoriteIds((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  }, []);
  const isFavorite = useCallback((id: string) => favoriteIds.includes(id), [favoriteIds]);

  // ---- archive / pin ----
  const archiveChat = useCallback((id: string) => setArchivedIds((a) => (a.includes(id) ? a : [...a, id])), []);
  const unarchiveChat = useCallback((id: string) => setArchivedIds((a) => a.filter((x) => x !== id)), []);
  const pinChat = useCallback((id: string) => setPinnedIds((p) => (p.includes(id) ? p : [...p, id])), []);
  const unpinChat = useCallback((id: string) => setPinnedIds((p) => p.filter((x) => x !== id)), []);

  // ---- block ----
  const isUserBlocked = useCallback((userId: string) => blockedIds.includes(userId), [blockedIds]);
  const toggleBlock = async (chat: Chat) => {
    const other = chat.participants.find((p) => p !== user?.id);
    if (!other) return;
    try {
      if (isUserBlocked(other)) {
        await backendV2x.unblockUser(other);
        setBlockedIds((ids) => ids.filter((x) => x !== other));
      } else {
        await backendV2x.blockUser(other);
        setBlockedIds((ids) => [...ids, other]);
      }
    } catch { /* backend support nahi */ }
  };

  // ---- starred sheet ----
  const openStarred = async () => {
    setShowStarred(true);
    try { setStarred(await backend.getStarredMessages()); } catch { setStarred([]); }
  };

  const totalUnread = useMemo(() => Object.values(unread).reduce((a, b) => a + b, 0), [unread]);

  if (!authReady) {
    return (
      <div className="wa4 mv2 min-h-dvh flex items-center justify-center" data-theme="dark">
        <div className="flex flex-col items-center gap-4">
          <Image src="/logo.png" alt="ChatsApp" width={76} height={76} className="rounded-2xl" />
          <p className="text-[var(--wa4-muted)] text-[14px]">ChatsApp khul raha hai...</p>
        </div>
      </div>
    );
  }
  if (!user) return <LoginScreen />;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'chats', label: 'Chats', icon: <ChatsNavIcon size={25} /> },
    { id: 'groups', label: 'Groups', icon: <GroupsNavIcon size={25} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsNavIcon size={25} /> },
  ];

  const listProps = {
    chats, user, unread, totalUnread,
    lockedIds, verifyPin,
    favoriteIds, onToggleFavorite: toggleFavorite,
    pinnedIds, archivedIds,
    onArchive: archiveChat, onUnarchive: unarchiveChat, onPin: pinChat, onUnpin: unpinChat,
    onSelect: setSelected,
    onOpenSettings: () => setTab('settings'),
    onOpenStarred: openStarred,
  };

  return (
    <div className="wa4 mv2 h-dvh flex flex-col overflow-hidden select-none" data-theme="dark">
      {/* Content */}
      <main className="flex-1 min-h-0 relative">
        {tab === 'chats' && <ChatsScreen {...listProps} />}
        {tab === 'groups' && <ChatsScreen {...listProps} forceGroups />}
        {tab === 'settings' && (
          <SettingsScreen user={user} chats={chats} onSignOut={() => backend.signOut().catch(() => {})} />
        )}
      </main>

      {/* Bottom nav — WhatsApp style: icon in pill + label */}
      <nav className="wa4-safe-bottom bg-[var(--wa4-header)] border-t border-black/30 z-20">
        <div className="flex h-[68px] pt-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            const badge = t.id === 'chats' ? totalUnread : 0;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); tapHaptic(); }}
                className={`flex-1 flex flex-col items-center justify-center gap-[3px] min-h-[44px] ${
                  active ? 'text-[var(--wa4-accent)]' : 'text-[var(--wa4-muted)]'
                }`}
              >
                <span className={`wa4-nav-pill relative px-5 py-[5px] rounded-full ${active ? 'bg-[var(--wa4-accent-dim)]' : ''}`}>
                  {t.icon}
                  {badge > 0 && (
                    <span className="absolute top-0 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--wa4-accent)] text-[#0b141a] text-[10px] font-bold flex items-center justify-center">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                <span className={`text-[12px] ${active ? 'font-semibold' : 'font-medium'}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Chat screen overlay — slides in from right */}
      {selected && (
        <div className="fixed inset-0 z-[50] wa4-screen-in bg-[#0b141a]">
          <ChatScreen
            chat={selected}
            user={user}
            chats={chats}
            onBack={() => setSelected(null)}
            onSelectChat={setSelected}
            isChatLocked={isChatLocked}
            onToggleLock={toggleLock}
            isUserBlocked={isUserBlocked}
            onToggleBlock={toggleBlock}
            isFavorite={isFavorite}
            onToggleFavorite={toggleFavorite}
          />
        </div>
      )}

      {/* Starred messages sheet */}
      <BottomSheet open={showStarred} onClose={() => setShowStarred(false)} title="Starred messages">
        <div className="pb-6 max-h-[60dvh] overflow-y-auto">
          {starred.length === 0 && (
            <p className="text-[var(--wa4-muted)] text-[14px] text-center py-8">Koi starred message nahi</p>
          )}
          {starred.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-[var(--wa4-divider)]">
              <span className="text-[var(--wa4-accent)]"><StarIcon size={20} filled /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] text-[var(--wa4-muted)]">{m.senderName}</span>
                <span className="block text-[14px] text-[var(--wa4-text)] truncate">{m.text || m.type}</span>
              </span>
              <button
                onClick={() => {
                  backend.starMessage(m.id, false).catch(() => {});
                  setStarred((s) => s.filter((x) => x.id !== m.id));
                }}
                className="text-[var(--wa4-muted)] p-2" aria-label="Unstar karein"
              >
                <XIcon size={18} />
              </button>
            </div>
          ))}
        </div>
      </BottomSheet>

      {/* PIN setup sheet */}
      <BottomSheet open={!!pinSheet} onClose={() => setPinSheet(null)}
        title={pinSheet?.mode === 'set' ? 'PIN banayein' : 'PIN confirm karein'}>
        <div className="px-5 pb-6">
          <div className="flex justify-center py-3 text-[var(--wa4-accent)]"><LockIcon size={40} /></div>
          <p className="text-[var(--wa4-muted)] text-[14px] mb-4 text-center">
            {pinSheet?.mode === 'set' ? 'Locked chats ke liye 4–6 digit ka PIN chunein.' : 'PIN dobara daliye.'}
          </p>
          <input
            type="password" inputMode="numeric" maxLength={6}
            value={pinInput}
            aria-label="Locked chats ka PIN"
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submitPinSetup()}
            placeholder="••••" autoFocus
            className={`w-full h-14 text-center text-2xl tracking-[0.5em] rounded-xl bg-[var(--wa4-input)] outline-none border text-[var(--wa4-text)] ${
              pinError ? 'border-[var(--wa4-danger)]' : 'border-transparent focus:border-[var(--wa4-accent)]'
            }`}
          />
          {pinError && (
            <p className="text-[var(--wa4-danger)] text-[13px] mt-2 text-center">
              {pinSheet?.mode === 'set' ? 'Kam se kam 4 digit' : 'PIN match nahi hua'}
            </p>
          )}
          <button onClick={submitPinSetup} disabled={pinInput.length < 4}
            className="w-full mt-4 h-12 rounded-full bg-[var(--wa4-accent)] text-[#0b141a] font-semibold disabled:opacity-40">
            {pinSheet?.mode === 'set' ? 'Aage' : 'PIN mehfooz karein'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
