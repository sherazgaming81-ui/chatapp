'use client';

/**
 * DesktopShell — ChatsApp v5 desktop (single-group pivot).
 * Layout: slim icon rail (64px) | main area | right slide-over (group info).
 * - NO chat list — seedha Madrasa Group ka conversation khulta hai.
 * - Rail: ChatsApp logo (home), group icon, namaz icon (next-prayer badge),
 *   owner dashboard (sirf owner), settings, profile avatar (neeche).
 * - Home/welcome area: NamazWidget + QuranCard + HadeesCard (group ke bahar).
 */

import { useCallback, useEffect, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, UserProfile } from '@/lib/backend/types';
import LoginScreen from '@/components/LoginScreen';
import Avatar from '@/components/Avatar';
import SettingsModal from '@/components/v4/desktop/SettingsModal';
import {
  Icon, ICONS, V4Styles, V5Styles, Modal,
  backendV5, v5call, resolveOwnership, MAIN_GROUP_NAME, type GroupTheme,
} from './common';
import { useGroupTheme } from './ThemePicker';
import ThemePicker from './ThemePicker';
import Conversation from './Conversation';
import GroupInfoPanel from './GroupInfoPanel';
import OwnerDashboard from './OwnerDashboard';
import NamazWidget, { useNamaz, useNamazBadge, nextPrayerLabel } from './NamazWidget';
import QuranCard from './QuranCard';
import HadeesCard from './HadeesCard';

type View = 'home' | 'group' | 'namaz' | 'dashboard';

function MosqueIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 2v3M12 5c-4 0-7 2.5-7 6v9h14V11c0-3.5-3-6-7-6zM4 20h16M9 11h.01M15 11h.01" />
      <path d="M18.5 4.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </svg>
  );
}

function RailBtn({ active, title, badge, onClick, children }: {
  active: boolean; title: string; badge?: string | null; onClick(): void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title} aria-label={title} className="relative w-12 h-12 rounded-full flex items-center justify-center transition group">
      <span className={`absolute inset-x-1 inset-y-[7px] rounded-full transition-all duration-200 ${
        active ? 'bg-[#00a884]/20 scale-100 opacity-100' : 'bg-[#8696a0]/0 scale-75 opacity-0 group-hover:bg-[#8696a0]/15 group-hover:scale-100 group-hover:opacity-100'
      }`} />
      <span className={`relative transition-colors ${active ? 'text-[#00a884]' : 'text-[#8696a0] group-hover:text-[#d1d7db]'}`}>
        {children}
      </span>
      {badge && (
        <span className="absolute -top-0.5 -right-1 z-10 text-[9px] font-semibold bg-[#00a884] text-white rounded-full px-1.5 py-[1px] whitespace-nowrap shadow">
          {badge}
        </span>
      )}
    </button>
  );
}

function ProfileModal({ me, onClose }: { me: UserProfile; onClose(): void }) {
  const [name, setName] = useState(me.displayName);
  const [about, setAbout] = useState(me.about || '');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await backend.updateProfile({ displayName: name.trim() || me.displayName, about });
      onClose();
    } finally { setSaving(false); }
  };
  return (
    <Modal title="Profile" onClose={onClose}>
      <div className="p-6 flex flex-col items-center">
        <Avatar name={name} photoURL={me.photoURL} size={110} />
        <p className="text-[12px] text-[#8696a0] mt-2">Photo Google account se aati hai</p>
        <div className="w-full mt-5 space-y-3">
          <div>
            <p className="text-[12px] text-[#8696a0] mb-1">Naam</p>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#1f2c34] rounded-xl px-4 py-2.5 text-[14.5px] text-[#e9edef] outline-none focus:ring-1 focus:ring-[#00a884]" />
          </div>
          <div>
            <p className="text-[12px] text-[#8696a0] mb-1">About</p>
            <input value={about} onChange={(e) => setAbout(e.target.value)} placeholder="Apne baare me likhein…" className="w-full bg-[#1f2c34] rounded-xl px-4 py-2.5 text-[14.5px] text-[#e9edef] outline-none focus:ring-1 focus:ring-[#00a884]" />
          </div>
          <button onClick={save} disabled={saving} className="w-full bg-[#00a884] hover:bg-[#06cf9c] text-white font-medium rounded-xl py-2.5 text-[14.5px] transition disabled:opacity-50">
            {saving ? 'Save ho raha hai…' : 'Save karein'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function DesktopShell() {
  const [authChecked, setAuthChecked] = useState(false);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [view, setView] = useState<View>('group');
  const [infoOpen, setInfoOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [amOwner, setAmOwner] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);

  const theme = useGroupTheme(chat?.id ?? null);
  const namazBadge = useNamazBadge();
  const { next } = useNamaz();

  const applyTheme = useCallback((_t: GroupTheme) => {}, []);

  // auth + presence
  useEffect(
    () =>
      backend.onAuth((u) => {
        setMe(u);
        setAuthChecked(true);
        if (!u) {
          setChat(null);
          setAmOwner(false);
          setOwnerId(null);
          setView('group');
        }
      }),
    [],
  );

  useEffect(() => {
    if (!me) return;
    v5call(() => backendV5.trackPresence!()).catch(() => {});
    const t = setInterval(() => v5call(() => backendV5.trackPresence!()).catch(() => {}), 60000);
    return () => clearInterval(t);
  }, [me]);

  // main group resolve: getMainGroup() -> onChats (isMainGroup / naam) -> ensureMainGroup()
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;
    (async () => {
      const direct = await v5call(() => backendV5.getMainGroup!());
      if (cancelled) return;
      if (direct && typeof direct === 'object' && 'id' in direct) {
        setChat(direct as Chat);
        return;
      }
      const directId = typeof direct === 'string' ? direct : null;
      if (cancelled) return;
      unsub = backend.onChats((list) => {
        const found =
          (directId && list.find((c) => c.id === directId)) ||
          list.find((c) => c.isMainGroup) ||
          list.find((c) => c.type === 'group' && (c.name || '').toLowerCase().includes('madrasa')) ||
          list.find((c) => c.type === 'group');
        if (found) setChat(found);
        else backend.ensureMainGroup().catch(() => {});
      });
    })();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [me]);

  // ownership resolve
  useEffect(() => {
    if (!me) return;
    resolveOwnership(me, chat).then(({ amOwner: o, ownerId: id }) => {
      setAmOwner(o);
      setOwnerId(id);
    });
  }, [me, chat?.id, chat?.adminIds]);

  // mute status (live countdown ke liye)
  useEffect(() => {
    if (!me) return;
    const check = async () => {
      const r = await v5call(() => backendV5.isMuted!());
      if (r && typeof r === 'object' && 'muted' in r) {
        setMutedUntil(r.muted && r.until && r.until > Date.now() ? r.until : null);
      } else {
        setMutedUntil(null);
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [me]);

  if (!authChecked) {
    return (
      <div className="h-dvh w-full flex flex-col items-center justify-center gap-4 bg-[#0b141a] v4root">
        <V4Styles /><V5Styles />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="ChatsApp" className="w-20 h-20 rounded-3xl animate-pulse" />
        <p className="text-[#8696a0] text-sm">ChatsApp khul raha hai…</p>
      </div>
    );
  }
  if (!me) return <LoginScreen />;

  return (
    <div className="v4root h-dvh w-full flex bg-[#0b141a] text-[#e9edef] overflow-hidden">
      <V4Styles />
      <V5Styles />

      {/* slim icon rail */}
      <nav className="w-16 shrink-0 bg-[#1f2c34] flex flex-col items-center py-3 z-40" aria-label="Navigation">
        <div className="flex flex-col items-center gap-1.5 flex-1">
          <button onClick={() => setView('home')} title="ChatsApp Home" aria-label="Home" className="mb-1 rounded-2xl overflow-hidden hover:ring-2 hover:ring-[#00a884]/60 transition">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ChatsApp" className="w-11 h-11 rounded-2xl" />
          </button>
          <RailBtn active={view === 'group'} title="Madrasa Group" onClick={() => setView('group')}>
            <Icon d={ICONS.groups} size={24} />
          </RailBtn>
          <RailBtn active={view === 'namaz'} title={next ? nextPrayerLabel(next) : 'Namaz timings'} badge={namazBadge} onClick={() => setView('namaz')}>
            <MosqueIcon size={24} />
          </RailBtn>
          {amOwner && (
            <RailBtn active={view === 'dashboard'} title="Owner Dashboard" onClick={() => setView('dashboard')}>
              <Icon d={ICONS.crown} size={24} />
            </RailBtn>
          )}
          <RailBtn active={false} title="Settings" onClick={() => setSettingsOpen(true)}>
            <Icon d={ICONS.settings} size={24} />
          </RailBtn>
        </div>
        <button
          onClick={() => setProfileOpen(true)}
          className="mt-2 rounded-full ring-2 ring-transparent hover:ring-[#00a884]/60 transition p-[2px]"
          title={me.displayName}
        >
          <Avatar name={me.displayName} photoURL={me.photoURL} size={38} />
        </button>
      </nav>

      {/* main area */}
      {view === 'home' && (
        <div className="flex-1 min-w-0 overflow-y-auto v4scroll bg-[#0b141a]">
          <div className="max-w-[860px] mx-auto px-6 lg:px-10 py-8">
            <div className="flex items-center gap-4 mb-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="ChatsApp" className="w-14 h-14 rounded-2xl" />
              <div>
                <h1 className="text-[22px] font-semibold text-[#e9edef]">Assalam-o-Alaikum, {me.displayName.split(' ')[0]}! 🤲</h1>
                <p className="text-[13.5px] text-[#8696a0]">ChatsApp · Madrasse ke doston ka apna group</p>
              </div>
            </div>

            <button
              onClick={() => setView('group')}
              className="w-full mb-6 bg-[#1f2c34] hover:bg-[#2a3942] border border-[#222d34] rounded-2xl p-4 flex items-center gap-4 text-left transition group"
            >
              <Avatar name={chat?.name || MAIN_GROUP_NAME} photoURL={chat?.photoURL} size={54} />
              <span className="flex-1 min-w-0">
                <span className="block text-[16px] font-medium text-[#e9edef]">{chat?.name || MAIN_GROUP_NAME}</span>
                <span className="block text-[13px] text-[#8696a0] truncate">
                  {chat ? `${chat.participants.length} members · baat cheet ke liye dabayein` : 'Group load ho raha hai…'}
                </span>
              </span>
              <Icon d={ICONS.chevRight} size={22} className="text-[#8696a0] group-hover:text-[#00a884] group-hover:translate-x-1 transition" />
            </button>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><NamazWidget /></div>
              <QuranCard />
              <HadeesCard />
            </div>
            <p className="text-center text-[11.5px] text-[#8696a0] mt-8">ChatsApp · madrasse ke doston ke liye ❤️</p>
          </div>
        </div>
      )}

      {view === 'namaz' && (
        <div className="flex-1 min-w-0 overflow-y-auto v4scroll bg-[#0b141a]">
          <div className="max-w-[560px] mx-auto px-6 py-8">
            <h1 className="text-[20px] font-semibold text-[#e9edef] mb-1 flex items-center gap-2.5">
              <MosqueIcon size={26} className="text-[#00a884]" /> Namaz Timings
            </h1>
            <p className="text-[13px] text-[#8696a0] mb-5">Karachi, Pakistan · rozana auto-update</p>
            <NamazWidget />
            <div className="mt-4 bg-[#111b21] border border-[#222d34] rounded-2xl p-5">
              <p className="text-[14px] text-[#e9edef] leading-relaxed" dir="rtl" lang="ar">إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا</p>
              <p className="text-[13px] text-[#8696a0] mt-2" dir="rtl" lang="ur">Beshak namaz momineen par waqt ki pabandi ke saath farz hai. (4:103)</p>
            </div>
          </div>
        </div>
      )}

      {view === 'dashboard' && chat && amOwner && (
        <OwnerDashboard chat={chat} me={me} ownerId={ownerId} />
      )}

      {view === 'group' && (
        <>
          {chat ? (
            <Conversation
              chat={chat}
              me={me}
              ownerId={ownerId}
              amOwner={amOwner}
              theme={theme}
              mutedUntil={mutedUntil}
              onOpenInfo={() => setInfoOpen(true)}
              onOpenThemes={() => setThemesOpen(true)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#0b141a]">
              <div className="v5shimmer w-16 h-16 rounded-2xl" />
              <p className="text-[#8696a0] text-sm">Madrasa Group load ho raha hai…</p>
            </div>
          )}
          {infoOpen && chat && (
            <GroupInfoPanel
              chat={chat}
              me={me}
              ownerId={ownerId}
              amOwner={amOwner}
              onClose={() => setInfoOpen(false)}
              onOpenThemes={() => { setInfoOpen(false); setThemesOpen(true); }}
            />
          )}
        </>
      )}

      {/* overlays */}
      {themesOpen && chat && amOwner && (
        <ThemePicker chatId={chat.id} onClose={() => setThemesOpen(false)} onApplied={applyTheme} />
      )}
      {settingsOpen && (
        <SettingsModal me={me} onClose={() => setSettingsOpen(false)} onOpenProfile={() => { setSettingsOpen(false); setProfileOpen(true); }} />
      )}
      {profileOpen && <ProfileModal me={me} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}
