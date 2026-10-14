'use client';

import type { Chat, ChatBackend, ChatMessage, SendInput, UserProfile } from '@/lib/backend/types';

/**
 * v5 backend contract — lib/backend/supabaseBackend.ts ke ASAL methods.
 * (Pehle ye "parallel worker add karega" wali draft thi; QA me asal
 * signatures se mila di gayi taake runtime par koi mismatch na rahe.)
 */
export interface V5Backend extends ChatBackend {
  /** true agar current user group owner hai (sherazgaming81@gmail.com) */
  isOwner(): boolean;
  /** badge text: 'Owner' | custom role | 'Member' */
  getRole(userId: string): Promise<string>;
  /** main group ("Madrasa Group") lao; null agar maujood nahi */
  getMainGroup(): Promise<Chat | null>;
  /** user ko group me auto-join karao; group id return kare (userId optional = current user) */
  ensureMemberAutoJoin(userId?: string): Promise<string>;
  /** "/" command parse karo; null agar command nahi */
  parseCommand(text: string): { command: string; args: string[]; rawArgs: string } | null;
  /** owner command chalao; CommandResult { ok, text, stats? } (chatId optional = main group) */
  executeCommand(
    command: string,
    args: string[],
    chatId?: string
  ): Promise<{ ok: boolean; text: string; stats?: unknown }>;
  /** mute status — chatId/userId optional (default: main group + current user) */
  isMuted(chatId?: string, userId?: string): Promise<{ muted: boolean; remainingMs: number }>;
  /**
   * v5 delete: forEveryone=false = sirf mere liye (soft),
   * forEveryone=true = SIRF owner, hard delete — koi placeholder nahi.
   */
  deleteMessage(chatId: string, messageId: string, forEveryone: boolean): Promise<void>;
  /** single message payload realtime stream */
  onMessagePayload(
    chatId: string,
    cb: (msg: ChatMessage, event: 'INSERT' | 'UPDATE' | 'DELETE') => void
  ): () => void;
  /** presence tracking shuru karo (userId optional = current user) */
  trackPresence(userId?: string): void;
  /** online members par subscribe karo — poori presence state milti hai */
  onPresenceChange(cb: (state: Record<string, { online: boolean; lastSeen: number }>) => void): () => void;
  /**
   * optimistic send — temp message FORAN milta hai (UI turant render kare),
   * asal persist background me `sent` par hota hai.
   */
  sendMessageOptimistic(
    chatId: string,
    input: SendInput,
    sender: { id: string; displayName: string }
  ): { temp: ChatMessage; sent: Promise<void> };
}

export type { Chat, ChatMessage, SendInput, UserProfile };

export const MAIN_GROUP_NAME = 'Madrasa Group';
export const OWNER_EMAIL = 'sherazgaming81@gmail.com';
export const OWNER_DISPLAY_NAME = 'sheraz';
export const APP_VERSION = '6.0';

export const ONBOARDING_KEY = 'v5_onboarding_complete';
export const VERSION_KEY = 'v5_app_version';

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1');
  } catch { /* ignore */ }
}

/** true agar update page dikhana chahiye (stored version != current) */
export function shouldShowUpdate(): boolean {
  try {
    return localStorage.getItem(VERSION_KEY) !== APP_VERSION;
  } catch {
    return true;
  }
}

export function markVersionSeen(): void {
  try {
    localStorage.setItem(VERSION_KEY, APP_VERSION);
  } catch { /* ignore */ }
}

/** epoch ms -> "04:32" countdown format */
export function fmtCountdown(until: number, now: number): string {
  const s = Math.max(0, Math.floor((until - now) / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** epoch ms -> "14:32" time */
export function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** epoch ms -> date chip label (Hinglish) */
export function fmtDateChip(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Aaj';
  if (sameDay(d, yest)) return 'Kal';
  return d.toLocaleDateString('ur-PK', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
