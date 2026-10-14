'use client';

/**
 * DesktopShell — ChatsApp v2 desktop (WhatsApp Web style 3-panel).
 * Login gate + auth state + theme engine (Auto/Light/Dark + night schedule)
 * + responsive 3-panel layout (768px → 1400px+).
 *
 * No app/ changes needed: render <DesktopShell/> from a route to use.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { backend } from '@/lib/backend';
import type { Chat, UserProfile } from '@/lib/backend/types';
import LoginScreen from '@/components/LoginScreen';
import Sidebar from './Sidebar';
import ChatView from './ChatView';
import InfoPanel from './InfoPanel';
import MessageInput from './MessageInput';
import SettingsModal from './SettingsModal';
import HomeWidget from './HomeWidget';
import { Icon, ICONS } from './common';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type BubbleStyle = 'default' | 'rounded';
/** purani 'doodle'|'plain' values backward-compatible hain — ab gallery ids bhi aa sakti hain */
export type WallpaperKind = string;
export type MessageFont = 'system' | 'serif' | 'rounded' | 'mono';

export const FONT_STACKS: Record<MessageFont, string> = {
  system: `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
  serif: `Georgia, 'Times New Roman', serif`,
  rounded: `'Segoe UI Rounded', 'SF Pro Rounded', ui-rounded, system-ui, sans-serif`,
  mono: `'JetBrains Mono', 'Cascadia Code', Consolas, monospace`,
};

export const FONT_LABELS: { v: MessageFont; name: string; sample: string }[] = [
  { v: 'system', name: 'System', sample: 'Assalam o Alaikum!' },
  { v: 'serif', name: 'Serif', sample: 'Assalam o Alaikum!' },
  { v: 'rounded', name: 'Rounded', sample: 'Assalam o Alaikum!' },
  { v: 'mono', name: 'Mono', sample: 'Assalam o Alaikum!' },
];

export interface WallpaperDef {
  id: string;
  name: string;
  sub: string;
  light: string; // light theme background CSS
  dark: string; // dark theme background CSS
}

/** Wallpaper gallery — tayyar wallpapers (koi external image nahi, sab CSS). */
export const WALLPAPERS: WallpaperDef[] = [
  { id: 'doodle', name: 'Doodle', sub: 'WhatsApp jaisa pattern', light: '', dark: '' },
  { id: 'plain', name: 'Plain', sub: 'Saaf solid background', light: '', dark: '' },
  { id: 'ocean', name: 'Ocean', sub: 'Gehra neela', light: 'linear-gradient(135deg,#bfe3f2 0%,#8fc3e0 100%)', dark: 'linear-gradient(135deg,#10293d 0%,#0b141a 100%)' },
  { id: 'sunset', name: 'Sunset', sub: 'Naranji shaam', light: 'linear-gradient(135deg,#ffd9a8 0%,#ff9d9e 100%)', dark: 'linear-gradient(135deg,#472a18 0%,#191009 100%)' },
  { id: 'forest', name: 'Forest', sub: 'Hara bharra', light: 'linear-gradient(135deg,#c4e6c4 0%,#93cf93 100%)', dark: 'linear-gradient(135deg,#152b1b 0%,#0b141a 100%)' },
  { id: 'lavender', name: 'Lavender', sub: 'Halka purple', light: 'linear-gradient(135deg,#e2d3f7 0%,#bda3e8 100%)', dark: 'linear-gradient(135deg,#2b2040 0%,#120e1a 100%)' },
  { id: 'peach', name: 'Peach', sub: 'Naram gulabi', light: 'linear-gradient(135deg,#ffe7d6 0%,#ffcbb3 100%)', dark: 'linear-gradient(135deg,#3f251d 0%,#190f0c 100%)' },
  { id: 'midnight', name: 'Midnight', sub: 'Raat ka neela', light: 'linear-gradient(135deg,#31405e 0%,#1b2436 100%)', dark: 'linear-gradient(135deg,#0d1622 0%,#05090f 100%)' },
];

export interface DesktopPrefs {
  theme: ThemeMode;
  nightStart: string; // "21:00"
  nightEnd: string; // "06:00"
  wallpaper: WallpaperKind;
  bubbleStyle: BubbleStyle;
  messageFont: MessageFont;
  enterToSend: boolean;
}

const PREF_KEY = 'v2-desktop-prefs';

const DEFAULT_PREFS: DesktopPrefs = {
  theme: 'auto',
  nightStart: '21:00',
  nightEnd: '06:00',
  wallpaper: 'doodle',
  bubbleStyle: 'default',
  messageFont: 'system',
  enterToSend: true,
};

export function loadPrefs(): DesktopPrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_PREFS };
}

function inNightWindow(now: Date, start: string, end: string): boolean {
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const n = now.getHours() * 60 + now.getMinutes();
  const s = toMin(start);
  const e = toMin(end);
  if (s === e) return false;
  if (s < e) return n >= s && n < e;
  return n >= s || n < e; // overnight window
}

export function effectiveTheme(p: DesktopPrefs, now = new Date()): 'light' | 'dark' {
  if (p.theme === 'light') return 'light';
  if (p.theme === 'dark') return 'dark';
  return inNightWindow(now, p.nightStart, p.nightEnd) ? 'dark' : 'light';
}

const DARK_DOODLE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cg fill='none' stroke='%23374d5c' stroke-opacity='0.5' stroke-width='1'%3E%3Ccircle cx='20' cy='20' r='6'/%3E%3Cpath d='M60 30l8 8M68 30l-8 8'/%3E%3Crect x='90' y='70' width='10' height='10' rx='2'/%3E%3Cpath d='M15 90q8-10 16 0'/%3E%3C/g%3E%3C/svg%3E")`;
const LIGHT_DOODLE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cg fill='none' stroke='%23d1c7b7' stroke-opacity='0.7' stroke-width='1'%3E%3Ccircle cx='20' cy='20' r='6'/%3E%3Cpath d='M60 30l8 8M68 30l-8 8'/%3E%3Crect x='90' y='70' width='10' height='10' rx='2'/%3E%3Cpath d='M15 90q8-10 16 0'/%3E%3C/g%3E%3C/svg%3E")`;

function V2Styles() {
  const galleryCss = WALLPAPERS.filter((w) => w.light)
    .map(
      (w) => `
      .v2root[data-wallpaper="${w.id}"][data-theme="light"] .v2wallpaper { background: ${w.light}; }
      .v2root[data-wallpaper="${w.id}"][data-theme="dark"] .v2wallpaper { background: ${w.dark}; }`,
    )
    .join('\n');
  return (
    <style>{`
      .v2root { --v2-accent: #00a884; --v2-accent-soft: rgba(0,168,132,.12); --v2-danger-bg: rgba(234,0,56,.08); --v2-msgfont: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        /* shared (mobile) components desktop par sahi rang me dikhein */
        --mv2-accent: var(--v2-accent); --mv2-accent-soft: var(--v2-accent-soft);
        --mv2-danger: #ea0038; --mv2-muted: var(--v2-muted); --mv2-text: var(--v2-text); }
      @keyframes mv2spin { to { transform: rotate(360deg); } }
      .v2root .mv2-spin { animation: mv2spin .8s linear infinite; }
      @keyframes mv2shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
      .v2root .mv2-shake { animation: mv2shake .3s ease-in-out 2; }
      .v2root[data-theme="dark"] {
        --v2-bg: #0b141a; --v2-panel: #111b21; --v2-panel2: #1f2c34; --v2-panel3: #2a3942;
        --v2-text: #e9edef; --v2-text2: #d1d7db; --v2-muted: #8696a0;
        --v2-border: #222d34; --v2-hover: rgba(134,150,160,.10); --v2-active: rgba(134,150,160,.16);
        --v2-bubble-in: #1f2c34; --v2-bubble-out: #005c4b;
        --v2-input: #2a3942; --v2-shadow: 0 1px 2px rgba(0,0,0,.35);
        --v2-wallpaper: #0b141a;
      }
      .v2root[data-theme="light"] {
        --v2-bg: #dfe0dc; --v2-panel: #ffffff; --v2-panel2: #f0f2f5; --v2-panel3: #e9edef;
        --v2-text: #111b21; --v2-text2: #3b4a54; --v2-muted: #667781;
        --v2-border: #e5e0d8; --v2-hover: rgba(17,27,33,.06); --v2-active: rgba(17,27,33,.10);
        --v2-bubble-in: #ffffff; --v2-bubble-out: #d9fdd3;
        --v2-input: #f0f2f5; --v2-shadow: 0 1px 1.5px rgba(17,27,33,.12);
        --v2-wallpaper: #eae6df;
      }
      .v2root[data-wallpaper="doodle"][data-theme="dark"] .v2wallpaper { background-color: var(--v2-wallpaper); background-image: ${DARK_DOODLE}; }
      .v2root[data-wallpaper="doodle"][data-theme="light"] .v2wallpaper { background-color: var(--v2-wallpaper); background-image: ${LIGHT_DOODLE}; }
      .v2root[data-wallpaper="plain"] .v2wallpaper { background-color: var(--v2-wallpaper); background-image: none; }
      ${galleryCss}
      /* chat list entrance animation */
      @keyframes v2rowin { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      .v2rowin { animation: v2rowin .28s cubic-bezier(.2,.7,.3,1) both; }
      @keyframes v2fadeup { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      .v2fadeup { animation: v2fadeup .22s ease-out both; }
      .v2scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .v2scroll::-webkit-scrollbar-thumb { background: var(--v2-panel3); border-radius: 3px; }
      .v2scroll::-webkit-scrollbar-track { background: transparent; }
      @keyframes v2pop { from { opacity: 0; transform: scale(.96) translateY(4px); } to { opacity: 1; transform: none; } }
      @keyframes v2fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes v2slide { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: none; } }
      .v2root input::placeholder, .v2root textarea::placeholder { color: var(--v2-muted); opacity: 1; }
    `}</style>
  );
}

export default function DesktopShell() {
  const [authChecked, setAuthChecked] = useState(false);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [prefs, setPrefs] = useState<DesktopPrefs>(DEFAULT_PREFS);
  const [jumpTo, setJumpTo] = useState<{ id: string; at: number } | null>(null);

  // prefs load + night-schedule ticker
  useEffect(() => {
    setPrefs(loadPrefs());
    const t = setInterval(() => setPrefs((p) => ({ ...p })), 60000); // re-evaluate night window
    return () => clearInterval(t);
  }, []);

  const savePrefs = useCallback((patch: Partial<DesktopPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREF_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => backend.onAuth((u) => {
    setMe(u);
    setAuthChecked(true);
    if (u) {
      backend.ensureMainGroup().catch(() => {});
    } else {
      setSelectedId(null);
      setInfoOpen(false);
    }
  }), []);

  useEffect(() => {
    if (!me) return;
    return backend.onChats(setChats);
  }, [me]);

  const theme = useMemo(() => effectiveTheme(prefs), [prefs]);
  const selectedChat = useMemo(
    () => chats.find((c) => c.id === selectedId) ?? null,
    [chats, selectedId],
  );

  const openInfo = useCallback(() => setInfoOpen(true), []);
  const closeInfo = useCallback(() => setInfoOpen(false), []);
  const jumpToMessage = useCallback((id: string) => {
    setJumpTo({ id, at: Date.now() });
  }, []);

  if (!authChecked) {
    return (
      <div className="v2root h-screen w-screen flex items-center justify-center bg-[#0b141a]" data-theme="dark">
        <V2Styles />
        <div className="flex flex-col items-center gap-3 text-[#8696a0]">
          <div className="w-10 h-10 rounded-full border-[3px] border-[#2a3942] border-t-[#00a884] animate-spin" />
          <p className="text-sm">Load ho raha hai…</p>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="v2root h-screen w-screen" data-theme="dark">
        <V2Styles />
        <LoginScreen />
      </div>
    );
  }

  return (
    <div
      className="v2root h-screen w-screen flex overflow-hidden text-[var(--v2-text)] bg-[var(--v2-bg)]"
      data-theme={theme}
      data-wallpaper={prefs.wallpaper}
    >
      <V2Styles />

      {/* ===== Left: sidebar (chat list ~30%) ===== */}
      <aside className="shrink-0 w-[32%] min-w-[272px] max-w-[430px] max-[900px]:min-w-[236px] border-r border-[var(--v2-border)] bg-[var(--v2-panel)] flex flex-col">
        <Sidebar
          me={me}
          chats={chats}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenWidget={() => setWidgetOpen(true)}
        />
      </aside>

      {/* ===== Center: chat view (~45-50%) ===== */}
      <main className="flex-1 min-w-0 flex flex-col relative">
        {selectedChat ? (
          <ChatView
            key={selectedChat.id}
            chat={selectedChat}
            chats={chats}
            me={me}
            infoOpen={infoOpen}
            onOpenInfo={openInfo}
            bubbleStyle={prefs.bubbleStyle}
            messageFont={prefs.messageFont}
            enterToSend={prefs.enterToSend}
            jumpTo={jumpTo}
            onJumpHandled={() => setJumpTo(null)}
          />
        ) : (
          <EmptyState onOpenWidget={() => setWidgetOpen(true)} theme={theme} />
        )}
      </main>

      {/* ===== Right: info panel (~25%, toggleable) ===== */}
      {infoOpen && selectedChat && (
        <aside className="shrink-0 w-[26%] min-w-[300px] max-w-[400px] max-[1100px]:absolute max-[1100px]:right-0 max-[1100px]:top-0 max-[1100px]:bottom-0 max-[1100px]:w-[340px] max-[1100px]:shadow-2xl border-l border-[var(--v2-border)] bg-[var(--v2-panel)] z-30 animate-[v2slide_.2s_ease-out]">
          <InfoPanel chat={selectedChat} me={me} onClose={closeInfo} onJumpTo={jumpToMessage} />
        </aside>
      )}

      {settingsOpen && (
        <SettingsModal
          me={me}
          chats={chats}
          prefs={prefs}
          onSavePrefs={savePrefs}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {widgetOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center pt-16 pointer-events-none">
          <div className="pointer-events-auto animate-[v2pop_.18s_ease-out]">
            <HomeWidget chats={chats} onOpen={(id) => { setSelectedId(id); setWidgetOpen(false); }} onClose={() => setWidgetOpen(false)} />
          </div>
          <div className="absolute inset-0 -z-10 bg-black/40 pointer-events-auto" onClick={() => setWidgetOpen(false)} />
        </div>
      )}
    </div>
  );
}

function EmptyState({ onOpenWidget, theme }: { onOpenWidget(): void; theme: 'light' | 'dark' }) {
  return (
    <div className="v2wallpaper flex-1 flex flex-col items-center justify-center text-center px-8 select-none">
      <img
        src="/logo.png"
        alt="ChatsApp"
        className={`w-24 h-24 rounded-full object-cover mb-6 ${theme === 'dark' ? 'opacity-90' : 'opacity-95 shadow-lg'}`}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <h1 className="text-[26px] font-light text-[var(--v2-text)] mb-2">ChatsApp Web</h1>
      <p className="text-[14px] text-[var(--v2-muted)] max-w-[420px] leading-relaxed">
        Baayein taraf se koi chat chunein aur baat-cheet shuru karein.
        Sab kuch tezz, saaf aur bilkul responsive — PC par bhi perfect.
      </p>
      <button
        onClick={onOpenWidget}
        className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--v2-accent)] text-white text-[14px] font-medium hover:brightness-110 transition shadow-lg"
      >
        <Icon d={ICONS.poll} size={18} />
        Recent chats dekhein
      </button>
    </div>
  );
}
