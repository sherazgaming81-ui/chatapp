'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import LoginScreen from '@/components/LoginScreen';
import { backend } from '@/lib/backend';
import type { BackendV2 } from '@/lib/v2/types';
import type { Chat, ChatMessage, UserProfile } from '@/lib/backend/types';
import ChatList, { chatDisplayName, chatPhoto } from './ChatList';
import ChatScreen from './ChatScreen';
import SettingsScreen, { type NightSchedule, type ThemeChoice } from './SettingsScreen';
import BottomSheet, { SheetRow } from './BottomSheet';
import ChatBubbles from './ChatBubbles';
import AppTour from './AppTour';
import { tapHaptic } from '../shared/haptics';
import Avatar from '@/components/Avatar';
import './v2-mobile.css';

const backendV2 = backend as unknown as BackendV2;

type Tab = 'chats' | 'groups' | 'settings';

function readLS(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

function effectiveTheme(choice: ThemeChoice, night: NightSchedule): 'light' | 'dark' {
  if (choice === 'light') return 'light';
  if (choice === 'dark') return 'dark';
  // auto: night schedule ya system preference
  if (night.enabled) {
    try {
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = night.start.split(':').map(Number);
      const [eh, em] = night.end.split(':').map(Number);
      const s = sh * 60 + sm, e = eh * 60 + em;
      const inNight = s <= e ? cur >= s && cur < e : cur >= s || cur < e;
      if (inNight) return 'dark';
      return 'light';
    } catch { /* fall through */ }
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

/**
 * MobileShell — v2 mobile app ka main container (WhatsApp mobile style).
 * Top app bar, bottom tab bar (Chats | Groups | Settings), login gate,
 * theme/wallpaper/lock/block state yahin manage hota hai.
 */
export default function MobileShell() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>('chats');
  const [selected, setSelected] = useState<Chat | null>(null);

  const [theme, setTheme] = useState<ThemeChoice>(() => readLS('v2-theme', 'auto') as ThemeChoice);
  const [wallpaper, setWallpaper] = useState(() => readLS('v2-wallpaper', 'doodle'));
  const [night, setNight] = useState<NightSchedule>(() => {
    try {
      const raw = localStorage.getItem('v2-night');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { enabled: false, start: '22:00', end: '06:00' };
  });
  const [lockedIds, setLockedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('v2-locked') || '[]'); } catch { return []; }
  });
  const [pin, setPin] = useState<string | null>(() => { try { return localStorage.getItem('v2-pin'); } catch { return null; } });
  const [pinSheet, setPinSheet] = useState<{ chat: Chat; mode: 'set' | 'confirm'; first: string } | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [compact, setCompact] = useState(() => readLS('v2-compact', '0') === '1');
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('v2-pinned') || '[]'); } catch { return []; }
  });
  const [archivedIds, setArchivedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('v2-archived') || '[]'); } catch { return []; }
  });
  const [dismissedBubbles, setDismissedBubbles] = useState<Record<string, number>>({});
  const [showTour, setShowTour] = useState(() => {
    try { return localStorage.getItem('v2-tour-done') !== '1'; } catch { return true; }
  });

  // ---- auth ----
  useEffect(() => backend.onAuth((u) => { setUser(u); setAuthReady(true); }), []);

  // ---- main group + sweeps (v1 jaisa) ----
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

  // ---- chats + unread ----
  useEffect(() => {
    if (!user) return;
    return backend.onChats((cs) => {
      setChats(cs);
      // selected chat ka fresh object rakhein
      setSelected((prev) => (prev ? cs.find((c) => c.id === prev.id) || null : null));
    });
  }, [user]);

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
  }, [user, chats]);

  // ---- blocked ----
  const refreshBlocked = useCallback(async () => {
    try { setBlockedIds((await backendV2.getBlockedUsers()).map((b) => b.userId)); }
    catch { /* backend support nahi — khali */ }
  }, []);
  useEffect(() => { if (user) refreshBlocked(); }, [user, refreshBlocked]);

  // ---- theme persist + apply ----
  useEffect(() => { try { localStorage.setItem('v2-theme', theme); } catch {} }, [theme]);
  useEffect(() => { try { localStorage.setItem('v2-wallpaper', wallpaper); } catch {} }, [wallpaper]);
  useEffect(() => { try { localStorage.setItem('v2-night', JSON.stringify(night)); } catch {} }, [night]);
  useEffect(() => { try { localStorage.setItem('v2-locked', JSON.stringify(lockedIds)); } catch {} }, [lockedIds]);
  useEffect(() => { try { localStorage.setItem('v2-compact', compact ? '1' : '0'); } catch {} }, [compact]);
  useEffect(() => { try { localStorage.setItem('v2-pinned', JSON.stringify(pinnedIds)); } catch {} }, [pinnedIds]);
  useEffect(() => { try { localStorage.setItem('v2-archived', JSON.stringify(archivedIds)); } catch {} }, [archivedIds]);

  // night schedule par har minute re-evaluate
  const [, setTick] = useState(0);
  useEffect(() => {
    if (theme !== 'auto' || !night.enabled) return;
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, [theme, night.enabled]);
  const effTheme = effectiveTheme(theme, night);

  // ---- lock / pin ----
  const isChatLocked = useCallback((id: string) => lockedIds.includes(id), [lockedIds]);
  const verifyPin = useCallback((p: string) => pin !== null && p === pin, [pin]);

  const lockChat = (chat: Chat) => {
    setLockedIds((ids) => (ids.includes(chat.id) ? ids : [...ids, chat.id]));
    backendV2.setChatLocked?.(chat.id, true).catch(() => {});
  };
  const unlockChat = (id: string) => {
    setLockedIds((ids) => ids.filter((x) => x !== id));
    backendV2.setChatLocked?.(id, false).catch(() => {});
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
    } else {
      if (pinInput === pinSheet.first) {
        try { localStorage.setItem('v2-pin', pinInput); } catch {}
        setPin(pinInput);
        lockChat(pinSheet.chat);
        setPinSheet(null);
      } else {
        setPinError(true);
        setPinInput('');
      }
    }
  };

  // ---- block ----
  const isUserBlocked = useCallback((userId: string) => blockedIds.includes(userId), [blockedIds]);
  const toggleBlock = async (chat: Chat) => {
    const other = chat.participants.find((p) => p !== user?.id);
    if (!other) return;
    try {
      if (isUserBlocked(other)) {
        await backendV2.unblockUser(other);
        setBlockedIds((ids) => ids.filter((x) => x !== other));
      } else {
        await backendV2.blockUser(other);
        setBlockedIds((ids) => [...ids, other]);
      }
    } catch { /* backend support nahi */ }
  };

  const totalUnread = useMemo(() => Object.values(unread).reduce((a, b) => a + b, 0), [unread]);

  // ---- archive / pin ----
  const archiveChat = useCallback((id: string) => setArchivedIds((a) => (a.includes(id) ? a : [...a, id])), []);
  const unarchiveChat = useCallback((id: string) => setArchivedIds((a) => a.filter((x) => x !== id)), []);
  const pinChat = useCallback((id: string) => setPinnedIds((p) => (p.includes(id) ? p : [...p, id])), []);
  const unpinChat = useCallback((id: string) => setPinnedIds((p) => p.filter((x) => x !== id)), []);

  // ---- floating chat bubble: latest unread chat (jab koi chat khuli na ho) ----
  const bubbleChat = useMemo(() => {
    if (selected || !user) return null;
    // dismiss ke baad naya message aaye to bubble dobara dikhe
    const cands = chats.filter((c) => (unread[c.id] || 0) > 0 && (unread[c.id] || 0) > (dismissedBubbles[c.id] || 0));
    if (cands.length === 0) return null;
    return [...cands].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }, [chats, unread, selected, dismissedBubbles, user]);

  const finishTour = useCallback(() => {
    try { localStorage.setItem('v2-tour-done', '1'); } catch {}
    setShowTour(false);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q || !user) return [];
    return chats
      .filter((c) => chatDisplayName(c, user.id).toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 15);
  }, [searchQ, chats, user]);

  if (!authReady) {
    return (
      <div className="mv2 min-h-dvh flex items-center justify-center" data-theme="dark">
        <div className="flex flex-col items-center gap-4">
          <Image src="/logo.png" alt="ChatsApp" width={72} height={72} className="rounded-2xl" />
          <p className="text-[var(--mv2-muted)] text-[14px]">ChatsApp khul raha hai...</p>
        </div>
      </div>
    );
  }
  if (!user) return <LoginScreen />;

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'chats', label: 'Chats',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" /></svg>,
    },
    {
      id: 'groups', label: 'Groups',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M16 5a3 3 0 0 1 0 6M17.5 14.7c2.3.7 4 2.3 4 4.3" /></svg>,
    },
    {
      id: 'settings', label: 'Settings',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2z" /></svg>,
    },
  ];

  return (
    <div className="mv2 h-dvh flex flex-col overflow-hidden select-none" data-theme={effTheme}>
      {/* Top app bar */}
      <header className="mv2-safe-top bg-[var(--mv2-header)] z-20 shadow-sm">
        <div className="flex items-center gap-2 pl-4 pr-1 h-[60px]">
          <Image src="/logo.png" alt="ChatsApp logo" width={36} height={36} className="rounded-xl" />
          <span className="text-[20px] font-bold text-[var(--mv2-text)] tracking-tight flex-1">ChatsApp</span>
          <button onClick={() => { setSearchQ(''); setShowSearch(true); }} aria-label="Search"
            className="w-11 h-11 flex items-center justify-center text-[var(--mv2-muted)]">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          </button>
          <button onClick={() => setShowMenu(true)} aria-label="Menu"
            className="w-11 h-11 flex items-center justify-center text-[var(--mv2-muted)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 min-h-0 relative">
        {tab === 'chats' && (
          <ChatList chats={chats} user={user} unread={unread} isLocked={isChatLocked} verifyPin={verifyPin}
            onSelect={setSelected}
            pinnedIds={pinnedIds} archivedIds={archivedIds} compact={compact}
            onArchive={archiveChat} onUnarchive={unarchiveChat} onPin={pinChat} onUnpin={unpinChat} />
        )}
        {tab === 'groups' && (
          <ChatList chats={chats} user={user} unread={unread} isLocked={isChatLocked} verifyPin={verifyPin}
            onSelect={setSelected} forceFilter="groups"
            pinnedIds={pinnedIds} archivedIds={archivedIds} compact={compact}
            onArchive={archiveChat} onUnarchive={unarchiveChat} onPin={pinChat} onUnpin={unpinChat} />
        )}
        {tab === 'settings' && (
          <SettingsScreen
            user={user} chats={chats}
            theme={theme} onTheme={setTheme}
            wallpaperId={wallpaper} onWallpaper={setWallpaper}
            lockedIds={lockedIds} onUnlockChat={unlockChat}
            night={night} onNight={setNight}
            compact={compact} onCompact={setCompact}
            onSignOut={() => backend.signOut().catch(() => {})}
          />
        )}
      </main>

      {/* Bottom tab bar */}
      <nav className="mv2-safe-bottom bg-[var(--mv2-header)] border-t border-[var(--mv2-divider)] z-20">
        <div className="flex h-[64px]">
          {tabs.map((t) => {
            const active = tab === t.id;
            const badge = t.id === 'chats' ? totalUnread : 0;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); tapHaptic(); }}
                className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] ${active ? 'text-[var(--mv2-accent)]' : 'text-[var(--mv2-muted)]'}`}
              >
                <span className="relative">
                  {t.icon}
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--mv2-unread)] text-white text-[10px] font-bold flex items-center justify-center">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                <span className={`text-[11px] font-medium ${active ? 'font-semibold' : ''}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Chat screen overlay */}
      {selected && (
        <div className="fixed inset-0 z-[50] mv2-fade-anim">
          <ChatScreen
            chat={selected}
            user={user}
            chats={chats}
            wallpaperId={wallpaper}
            onWallpaper={setWallpaper}
            isChatLocked={isChatLocked}
            onToggleLock={toggleLock}
            isUserBlocked={isUserBlocked}
            onToggleBlock={toggleBlock}
            onBack={() => setSelected(null)}
            onSelectChat={setSelected}
          />
        </div>
      )}

      {/* Floating chat bubble (Messenger style) */}
      {bubbleChat && (
        <ChatBubbles
          chat={bubbleChat}
          userId={user.id}
          unreadCount={unread[bubbleChat.id] || 0}
          onOpen={(c) => setSelected(c)}
          onDismiss={(id) => setDismissedBubbles((d) => ({ ...d, [id]: unread[id] || 0 }))}
        />
      )}

      {/* App tour (pehli login par) */}
      {showTour && <AppTour onDone={finishTour} />}

      {/* Global search sheet */}
      <BottomSheet open={showSearch} onClose={() => setShowSearch(false)} title="Search">
        <div className="px-4 pb-6">
          <input
            autoFocus
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Chats dhoondhein..."
            className="w-full h-12 px-4 rounded-full bg-[var(--mv2-input)] text-[15px] text-[var(--mv2-text)] placeholder:text-[var(--mv2-muted)] outline-none mb-2"
          />
          {searchResults.map((c) => (
            <button key={c.id} onClick={() => { setShowSearch(false); setSelected(c); }}
              className="w-full flex items-center gap-3 py-2.5 text-left active:bg-[var(--mv2-accent-soft)]">
              <Avatar name={chatDisplayName(c, user.id)} photoURL={chatPhoto(c, user.id)} size={46} />
              <span className="text-[15px] text-[var(--mv2-text)] truncate">{chatDisplayName(c, user.id)}</span>
            </button>
          ))}
          {searchQ.trim() && searchResults.length === 0 && (
            <p className="text-[var(--mv2-muted)] text-[14px] text-center py-6">Kuch nahi mila</p>
          )}
        </div>
      </BottomSheet>

      {/* Top-bar menu */}
      <BottomSheet open={showMenu} onClose={() => setShowMenu(false)} title="Menu">
        <div className="pb-6">
          <SheetRow label="Meri profile" sub="Settings kholein" onClick={() => { setShowMenu(false); setTab('settings'); }}
            icon={<Avatar name={user.displayName} photoURL={user.photoURL} size={36} />} />
          <SheetRow label="Naya group" sub="Group banayein" onClick={() => { setShowMenu(false); setTab('chats'); }}
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M18 8v6M15 11h6" /></svg>} />
        </div>
      </BottomSheet>

      {/* PIN setup sheet */}
      <BottomSheet open={!!pinSheet} onClose={() => setPinSheet(null)}
        title={pinSheet?.mode === 'set' ? 'PIN banayein' : 'PIN confirm karein'}>
        <div className="px-5 pb-6">
          <p className="text-[var(--mv2-muted)] text-[14px] mb-4">
            {pinSheet?.mode === 'set' ? 'Locked chats ke liye 4–6 digit ka PIN chunein.' : 'PIN dobara daliye.'}
          </p>
          <input
            type="password" inputMode="numeric" maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && submitPinSetup()}
            placeholder="••••" autoFocus
            className={`w-full h-14 text-center text-2xl tracking-[0.5em] rounded-xl bg-[var(--mv2-input)] outline-none border ${pinError ? 'border-[var(--mv2-danger)]' : 'border-transparent focus:border-[var(--mv2-accent)]'} text-[var(--mv2-text)]`}
          />
          {pinError && <p className="text-[var(--mv2-danger)] text-[13px] mt-2 text-center">{pinSheet?.mode === 'set' ? 'Kam se kam 4 digit' : 'PIN match nahi hua'}</p>}
          <button onClick={submitPinSetup} disabled={pinInput.length < 4}
            className="w-full mt-4 h-12 rounded-full bg-[var(--mv2-accent)] text-white font-semibold disabled:opacity-40">
            {pinSheet?.mode === 'set' ? 'Aage' : 'PIN mehfooz karein'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
