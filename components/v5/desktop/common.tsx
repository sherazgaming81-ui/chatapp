'use client';

/**
 * v5/desktop shared bits.
 * v4 ke atoms (Icon/ICONS/Modal/Popover/RowBtn/SectionTitle/Toggle/V4Styles/fmt)
 * read-only re-export hote hain — v4 files me koi change nahi.
 * Plus: v5 backend contract (backend worker parallel me add kar raha hai —
 * sab methods optional, feature-detect ke saath), owner constants,
 * RoleBadge ("Owner"/"Member"), group themes, aur v5 CSS.
 */

import { backend } from '@/lib/backend';
import type { Chat, ChatMessage } from '@/lib/backend/types';
import { useEffect, useState } from 'react';

export {
  Icon,
  ICONS,
  Modal,
  Popover,
  MenuItem,
  RowBtn,
  SectionTitle,
  Toggle,
  V4Styles,
  fmtClock,
  fmtListHinglish,
  fmtDayHinglish,
  fmtSeenHinglish,
} from '@/components/v4/desktop/common';
export type { IconName } from '@/components/v4/desktop/common';

/** v5 ka fixed owner — display name badalne par bhi badge nahi badlega. */
export const OWNER_EMAIL = 'sherazgaming81@gmail.com';
export const OWNER_DISPLAY_NAME = 'sheraz';
export const MAIN_GROUP_NAME = 'Madrasa Group';

/** v5 group theme (group_themes table / localStorage fallback). */
export interface GroupTheme {
  kind: 'preset' | 'custom';
  presetId?: 'midnight' | 'emerald' | 'desert' | 'ocean';
  url?: string; // custom image/video
  mediaType?: 'image' | 'video';
}

export const THEME_PRESETS: { id: NonNullable<GroupTheme['presetId']>; name: string; bg: string; hint: string }[] = [
  { id: 'midnight', name: 'Midnight', bg: '#0b141a', hint: 'Classic WhatsApp dark' },
  { id: 'emerald', name: 'Emerald', bg: '#0c3b33', hint: 'Gehra sabz' },
  { id: 'desert', name: 'Desert', bg: '#3a2c20', hint: 'Garam ret jaisa' },
  { id: 'ocean', name: 'Ocean', bg: '#0a2c40', hint: 'Gehra neela' },
];

export const DEFAULT_THEME: GroupTheme = { kind: 'preset', presetId: 'midnight' };

export interface MutedUserInfo {
  userId: string;
  displayName: string;
  until: number; // epoch ms
  reason?: string;
}

export interface BannedUserInfo {
  userId: string;
  displayName: string;
  at: number;
}

export interface WarnInfo {
  id: string;
  userId: string;
  displayName: string;
  reason: string;
  at: number;
  by: string;
}

export interface GroupStats {
  totalMessages: number;
  activeMembers: number;
  messagesToday: number;
  topSenders: { userId: string; displayName: string; count: number }[];
}

export interface CommandResult {
  ok: boolean;
  text: string; // Hinglish confirmation
  stats?: {
    totalMessages: number;
    activeMembers: number;
    messagesToday: number;
    topSenders: { userId: string; displayName: string; count: number }[];
  };
}

/**
 * BackendV5 — v5 contract (supabaseBackend me maujood methods).
 * Jo methods (abhi) nahi hain wo optional hain — UI feature-detect karti hai.
 */
export interface BackendV5 {
  /** Sync boolean — kya current user owner hai. */
  isOwner?(): boolean | Promise<boolean>;
  /** Badge text: 'Owner' | custom role | 'Member'. */
  getRole?(userId: string): Promise<string>;
  /** Owner ka user id (profiles me email se). */
  getOwnerId?(): Promise<string | null>;
  /** Main group. */
  getMainGroup?(): Promise<Chat | null>;
  /**
   * Owner command: executeCommand('mute', ['@ahmed','10m'], chatId).
   * Commands: mute/timeout, unmute, ban, warn, lock, unlock, announce, clear, stats.
   */
  executeCommand?(command: string, args: string[], chatId: string): Promise<CommandResult>;
  /** Mute status: { muted, remainingMs }. */
  isMuted?(chatId: string, userId: string): Promise<{ muted: boolean; remainingMs: number }>;
  /** Naam/userId se member resolve (fuzzy). */
  resolveUserByName?(chatId: string, nameQuery: string): Promise<{ userId: string; displayName: string } | null>;
  /** Custom role lagao/hatayo (owner). */
  setUserRole?(userId: string, role: string): Promise<void>;
  /** Raw message payload subscription (agar ho). */
  onMessagePayload?(chatId: string, cb: (payload: unknown) => void): () => void;
  /** Online presence heartbeat (agar ho). */
  trackPresence?(): Promise<void>;
  /** Group theme (group_themes table; missing ho to localStorage fallback). */
  getGroupTheme?(chatId: string): Promise<GroupTheme | null>;
  setGroupTheme?(chatId: string, theme: GroupTheme): Promise<void>;
  /** Moderation lists (owner) — missing hon to UI graceful empty state dikhaye. */
  getMutedUsers?(chatId: string): Promise<MutedUserInfo[]>;
  unmuteUser?(chatId: string, userId: string): Promise<void>;
  getBannedUsers?(chatId: string): Promise<BannedUserInfo[]>;
  unbanUser?(chatId: string, userId: string): Promise<void>;
  getWarnings?(chatId: string): Promise<WarnInfo[]>;
  clearWarning?(chatId: string, warnId: string): Promise<void>;
  setMemberSlowMode?(chatId: string, userId: string, seconds: number): Promise<void>;
  getGroupStats?(chatId: string): Promise<GroupStats | null>;
}

export const backendV5 = backend as unknown as BackendV5;

/** Backend v5 call ko safely chalao — method missing ya fail ho to null. */
export async function v5call<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/** Optional v5 backend method ko naam se safely call karo. */
export function callV5(key: keyof BackendV5, ...args: unknown[]): Promise<unknown> {
  const fn = backendV5[key];
  if (typeof fn !== 'function') return Promise.resolve(null);
  return v5call(() => (fn as (...a: unknown[]) => Promise<unknown>)(...args));
}

/** Owner resolve: fixed email -> backend.getOwnerId() -> isOwner()/getRole(). */
export async function resolveOwnership(
  me: { id: string; email: string },
  chat: Chat | null,
): Promise<{ amOwner: boolean; ownerId: string | null }> {
  if (me.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
    return { amOwner: true, ownerId: me.id };
  }
  const ownerId = await v5call(() => backendV5.getOwnerId!());
  if (ownerId && ownerId === me.id) return { amOwner: true, ownerId };
  const flag = await v5call(() => Promise.resolve(backendV5.isOwner!()));
  if (flag === true) return { amOwner: true, ownerId: ownerId ?? me.id };
  const role = await v5call(() => backendV5.getRole!(me.id));
  if (role === 'Owner' || role === 'owner') return { amOwner: true, ownerId: me.id };
  return { amOwner: false, ownerId: ownerId ?? chat?.adminIds?.[0] ?? null };
}

/**
 * Owner command chalao: "/mute @ahmed 10m" -> executeCommand('mute', ['@ahmed','10m'], chatId).
 * Backend ka CommandResult.text (Hinglish) wapas milta hai.
 */
export async function runOwnerCommand(chatId: string, fullText: string): Promise<CommandResult> {
  const fn = backendV5.executeCommand;
  if (typeof fn !== 'function') throw new Error('Commands backend me maujood nahi hain');
  const parts = fullText.trim().split(/\s+/);
  const command = (parts[0] || '').replace(/^\//, '');
  const args = parts.slice(1);
  if (!command) throw new Error('Koi command nahi likhi');
  return fn.call(backendV5, command, args, chatId);
}

/** Mute status -> mute khatam hone ka waqt (epoch ms), ya null. */
export async function getMuteUntil(chatId: string, userId: string): Promise<number | null> {
  const r = await v5call(() => backendV5.isMuted!(chatId, userId));
  if (r && r.muted && r.remainingMs > 0) return Date.now() + r.remainingMs;
  return null;
}

export type Role = 'owner' | 'member';

/** Badge — 'Owner' (gold), 'Member' (gray), ya custom role text. Naam badalne par bhi sahi. */
export function RoleBadge({ role, small }: { role: string; small?: boolean }) {
  const r = (role || '').toLowerCase();
  if (r === 'owner') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-[#ffd447]/15 text-[#ffd447] border border-[#ffd447]/30 font-medium whitespace-nowrap ${
          small ? 'text-[9.5px] px-1.5 py-[1px]' : 'text-[10.5px] px-2 py-[2px]'
        }`}
        title="Group Owner"
      >
        <svg width={small ? 9 : 11} height={small ? 9 : 11} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M3 8l4 4 5-6 5 6 4-4-1.5 10h-15L3 8z" />
        </svg>
        Owner
      </span>
    );
  }
  const label = r === 'member' || !role ? 'Member' : role;
  return (
    <span
      className={`inline-flex items-center rounded-full bg-[#8696a0]/15 text-[#aebac1] border border-[#8696a0]/25 font-medium whitespace-nowrap ${
        small ? 'text-[9.5px] px-1.5 py-[1px]' : 'text-[10.5px] px-2 py-[2px]'
      }`}
      title={label}
    >
      {label}
    </span>
  );
}

/** Mute countdown text: "2 ghante 15 min" / "45 min" / "30 sec". */
export function fmtCountdown(until: number): string {
  const ms = Math.max(0, until - Date.now());
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} sec`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} ghante ${rm} min` : `${h} ghante`;
}

/** Member roles (Owner/Member/custom) — backend.getRole per user, cached. */
export function useMemberRoles(chatId: string, userIdsKey: string): Record<string, string> {
  const [roles, setRoles] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = [...new Set(userIdsKey.split(',').filter(Boolean))];
    if (!ids.length || typeof backendV5.getRole !== 'function') return;
    let on = true;
    (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        ids.map(async (uid) => {
          const r = await v5call(() => backendV5.getRole!(uid));
          if (r) next[uid] = r;
        }),
      );
      if (on) setRoles((prev) => ({ ...next, ...prev }));
    })();
    return () => { on = false; };
  }, [chatId, userIdsKey]);
  return roles;
}

/** v5 global styles (v4 keyframes ke upar). */
export function V5Styles() {
  return (
    <style>{`
      .v5wallpaper { background-color: #0b141a; }
      .v5wallpaper.doodle { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cg fill='none' stroke='%238696a0' stroke-opacity='0.13' stroke-width='1.4'%3E%3Cpath d='M28 34a12 12 0 0 0 12 12h14l6 7v-7h6a12 12 0 0 0 12-12v-8a12 12 0 0 0-12-12H40a12 12 0 0 0-12 12z'/%3E%3Ccircle cx='150' cy='40' r='14'/%3E%3Crect x='200' y='90' width='26' height='20' rx='4'/%3E%3Cpath d='M30 130l10-14 8 8 10-12 8 10'/%3E%3Crect x='24' y='108' width='52' height='40' rx='5'/%3E%3Ccircle cx='60' cy='200' r='10'/%3E%3Cpath d='M60 190v20M50 200h20'/%3E%3C/g%3E%3C/svg%3E"); }
      @keyframes v5pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
      .v5pulse { animation: v5pulse 2s ease-in-out infinite; }
      @keyframes v5shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
      .v5shimmer { background: linear-gradient(110deg, #1f2c34 40%, #2a3942 50%, #1f2c34 60%); background-size: 200% 100%; animation: v5shimmer 1.6s linear infinite; }
    `}</style>
  );
}

export type { Chat, ChatMessage };
