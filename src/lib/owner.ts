"use client";
// ─────────────────────────────────────────────────────────────
// Phase 8 — Owner Superpowers. Sab kuch is file me hai.
// group_settings keys: slowmode_<chatId>, badwords_<chatId>, auditlog
// ─────────────────────────────────────────────────────────────
import { supabase, MAIN_GROUP_ID } from "./supabase";
import { getState, update, toast } from "./store";
import type { Role } from "./types";

const sb = () => supabase();
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* ═══════════ H9 — SLOW MODE ═══════════ */
export async function getSlowMode(chatId: string): Promise<number> {
  try {
    const { data } = await sb().from("group_settings").select("value").eq("key", `slowmode_${chatId}`).single();
    const v = Number(data?.value);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch { return 0; }
}
export async function setSlowMode(chatId: string, seconds: number): Promise<void> {
  try {
    if (seconds <= 0) await sb().from("group_settings").delete().eq("key", `slowmode_${chatId}`);
    else await sb().from("group_settings").upsert({ key: `slowmode_${chatId}`, value: seconds });
  } catch { /* ignore */ }
  try { localStorage.setItem(`chatsapp:slowmode:${chatId}`, String(seconds)); } catch { /* ignore */ }
  await logAudit("slowmode", null, seconds > 0 ? `Slow mode ${seconds}s` : "Slow mode off", chatId);
}
/** last message time per user per chat (memory) */
const lastMsgAt: Record<string, number> = {};
export function checkSlowMode(chatId: string, userId: string, seconds: number): number {
  if (seconds <= 0) return 0;
  const me = getState().members.find((m) => m.id === userId);
  // owner/admin/mod exempt
  if (me && (me.role === "owner" || me.role === "admin" || me.role === "mod")) return 0;
  const key = `${chatId}:${userId}`;
  const last = lastMsgAt[key] || 0;
  const wait = Math.ceil((last + seconds * 1000 - Date.now()) / 1000);
  if (wait > 0) return wait;
  lastMsgAt[key] = Date.now();
  return 0;
}
export function getCachedSlowMode(chatId: string): number {
  try { return Number(localStorage.getItem(`chatsapp:slowmode:${chatId}`)) || 0; } catch { return 0; }
}

/* ═══════════ H15 — AUTO-MOD WORD LIST ═══════════ */
export interface BadWords { words: string[]; action: "warn" | "delete" | "both" }
export async function getBadWords(chatId: string): Promise<BadWords> {
  try {
    const { data } = await sb().from("group_settings").select("value").eq("key", `badwords_${chatId}`).single();
    const v = data?.value as BadWords | null;
    if (v && Array.isArray(v.words)) return { words: v.words, action: v.action || "warn" };
  } catch { /* ignore */ }
  return { words: [], action: "warn" };
}
export async function setBadWords(chatId: string, words: string[], action: BadWords["action"]): Promise<void> {
  const clean = [...new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean))];
  try {
    await sb().from("group_settings").upsert({ key: `badwords_${chatId}`, value: { words: clean, action } });
  } catch { /* ignore */ }
  try { localStorage.setItem(`chatsapp:badwords:${chatId}`, JSON.stringify({ words: clean, action })); } catch { /* ignore */ }
  await logAudit("automod", null, `${clean.length} banned words (${action})`, chatId);
}
export function getCachedBadWords(chatId: string): BadWords {
  try {
    const raw = localStorage.getItem(`chatsapp:badwords:${chatId}`);
    if (raw) { const v = JSON.parse(raw); if (Array.isArray(v.words)) return v; }
  } catch { /* ignore */ }
  return { words: [], action: "warn" };
}
/** returns matched word or null */
export function findBadWord(text: string, words: string[]): string | null {
  const t = ` ${text.toLowerCase()} `;
  for (const w of words) {
    // word-boundary-ish match (simple, no regex injection risk)
    if (t.includes(` ${w} `) || t.includes(` ${w}.`) || t.includes(` ${w},`) || t.includes(` ${w}!`) || t.includes(` ${w}?`)) return w;
  }
  return null;
}

/* ═══════════ H16 — AUDIT LOG ═══════════ */
export interface AuditEntry {
  id: string; action: string; by: string; byName: string;
  target: string | null; targetName: string | null;
  reason: string; chatId: string | null; at: number;
}
const AUDIT_KEY = "chatsapp:auditlog";
const MAX_AUDIT = 200;
export async function logAudit(action: string, targetId: string | null, reason: string, chatId: string | null = MAIN_GROUP_ID): Promise<void> {
  const s = getState();
  const byName = s.members.find((m) => m.id === s.me)?.name || "Owner";
  const targetName = targetId ? s.members.find((m) => m.id === targetId)?.name || null : null;
  const entry: AuditEntry = { id: uid("a"), action, by: s.me, byName, target: targetId, targetName, reason, chatId, at: Date.now() };
  // local first
  try {
    const cur = getAuditLocal();
    cur.unshift(entry);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(cur.slice(0, MAX_AUDIT)));
  } catch { /* ignore */ }
  // server (best-effort, group_settings single key)
  try {
    const { data } = await sb().from("group_settings").select("value").eq("key", "auditlog").single();
    const arr = Array.isArray(data?.value) ? data.value as AuditEntry[] : [];
    arr.unshift(entry);
    await sb().from("group_settings").upsert({ key: "auditlog", value: arr.slice(0, MAX_AUDIT) });
  } catch { /* ignore */ }
  // notify listeners
  emitAudit();
}
export function getAuditLocal(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
export async function fetchAuditServer(): Promise<AuditEntry[]> {
  try {
    const { data } = await sb().from("group_settings").select("value").eq("key", "auditlog").single();
    if (Array.isArray(data?.value)) {
      const arr = data.value as AuditEntry[];
      try { localStorage.setItem(AUDIT_KEY, JSON.stringify(arr.slice(0, MAX_AUDIT))); } catch { /* ignore */ }
      emitAudit();
      return arr;
    }
  } catch { /* ignore */ }
  return getAuditLocal();
}
/* audit live updates (local) */
const auditListeners = new Set<() => void>();
function emitAudit() { auditListeners.forEach((l) => { try { l(); } catch { /* ignore */ } }); }
import { useSyncExternalStore } from "react";
const auditServerSnap: AuditEntry[] = [];
export function useAuditLog(): AuditEntry[] {
  return useSyncExternalStore(
    (cb) => { auditListeners.add(cb); return () => { auditListeners.delete(cb); }; },
    getAuditLocal,
    () => auditServerSnap,
  );
}

/* ═══════════ H3 — BROADCAST ═══════════ */
export async function broadcast(text: string, chatIds: string[]): Promise<number> {
  const s = getState();
  const clean = text.trim();
  if (!clean || chatIds.length === 0) return 0;
  let sent = 0;
  for (const chatId of chatIds) {
    const m = {
      id: uid("m"), chat_id: chatId, sender_id: s.me, type: "announcement",
      text: clean, media_url: "", reply_to: null, created_at: Date.now(), read_by: [],
    };
    try {
      await sb().from("messages").insert(m);
      sent++;
    } catch { /* ignore — continue others */ }
  }
  // local mirror
  const local = chatIds.map((chatId) => ({
    id: uid("m"), from: s.me, chatId, type: "announcement" as const,
    text: clean, at: Date.now(), reactions: {},
  }));
  update({ messages: [...s.messages, ...local] });
  await logAudit("broadcast", null, `${sent}/${chatIds.length} chats: ${clean.slice(0, 60)}`);
  return sent;
}

/* ═══════════ H4 — SCHEDULED ANNOUNCEMENTS ═══════════ */
export interface Scheduled { id: string; text: string; chatIds: string[]; at: number; createdAt: number }
const SCHED_KEY = "chatsapp:scheduled";
export function getScheduled(): Scheduled[] {
  try {
    const raw = localStorage.getItem(SCHED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x: any) => x && x.at > Date.now()) : [];
  } catch { return []; }
}
export function scheduleAnnouncement(text: string, chatIds: string[], at: number): Scheduled | null {
  const clean = text.trim();
  if (!clean || chatIds.length === 0 || at <= Date.now()) return null;
  const item: Scheduled = { id: uid("s"), text: clean, chatIds, at, createdAt: Date.now() };
  try {
    const cur = getScheduled();
    cur.push(item);
    cur.sort((a, b) => a.at - b.at);
    localStorage.setItem(SCHED_KEY, JSON.stringify(cur));
  } catch { /* ignore */ }
  emitSched();
  toast("Schedule ho gaya ⏰", new Date(at).toLocaleString());
  return item;
}
export function cancelScheduled(id: string): void {
  try {
    localStorage.setItem(SCHED_KEY, JSON.stringify(getScheduled().filter((x) => x.id !== id)));
  } catch { /* ignore */ }
  emitSched();
}
const schedListeners = new Set<() => void>();
function emitSched() { schedListeners.forEach((l) => { try { l(); } catch { /* ignore */ } }); }
const schedServerSnap: Scheduled[] = [];
export function useScheduled(): Scheduled[] {
  return useSyncExternalStore(
    (cb) => { schedListeners.add(cb); return () => { schedListeners.delete(cb); }; },
    getScheduled,
    () => schedServerSnap,
  );
}
/** app start par chalao — due announcements bhejo */
let schedTimer: any = null;
export function startScheduler(): void {
  if (schedTimer) return;
  const tick = async () => {
    try {
      const raw = localStorage.getItem(SCHED_KEY);
      const arr: Scheduled[] = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      const due = arr.filter((x) => x && x.at <= now);
      if (due.length > 0) {
        const rest = arr.filter((x) => x && x.at > now);
        localStorage.setItem(SCHED_KEY, JSON.stringify(rest));
        for (const d of due) {
          await broadcast(d.text, d.chatIds);
          toast("⏰ Scheduled elaan bhej diya", d.text.slice(0, 50));
        }
        emitSched();
      }
    } catch { /* ignore */ }
  };
  schedTimer = setInterval(tick, 30000);
  setTimeout(tick, 5000);
}

/* ═══════════ H2 — ANALYTICS (100% real data, store se) ═══════════ */
export interface DayStat { label: string; count: number }
export function messagesPerDay(days = 7): DayStat[] {
  const msgs = getState().messages.filter((m) => !m.deleted);
  const out: DayStat[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const start = new Date(d).setHours(0, 0, 0, 0);
    const end = start + 864e5;
    const count = msgs.filter((m) => m.at >= start && m.at < end).length;
    out.push({ label: d.toLocaleDateString("en", { weekday: "short" }), count });
  }
  return out;
}
export function activeMembers(days = 7): number {
  const since = Date.now() - days * 864e5;
  return new Set(getState().messages.filter((m) => m.at >= since && !m.deleted).map((m) => m.from)).size;
}
export function topContributors(limit = 5): { id: string; name: string; count: number }[] {
  const counts: Record<string, number> = {};
  getState().messages.forEach((m) => { if (!m.deleted) counts[m.from] = (counts[m.from] || 0) + 1; });
  const members = getState().members;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => ({ id, name: members.find((m) => m.id === id)?.name || "Member", count }));
}

/* ═══════════ H14 — ROLE MANAGER ═══════════ */
export const ROLES: { id: Role; label: string; desc: string }[] = [
  { id: "owner", label: "Owner 👑", desc: "Sab kuch — full control" },
  { id: "admin", label: "Admin 🛡️", desc: "Mute/ban/warn + elaan" },
  { id: "mod", label: "Mod 🔧", desc: "Mute/warn, messages manage" },
  { id: "member", label: "Member 🙂", desc: "Chat kar sakta hai" },
];
export async function changeRole(userId: string, role: Role): Promise<void> {
  const { setRole } = await import("./db");
  const prev = getState().members.find((m) => m.id === userId)?.role;
  await setRole(userId, role);
  await logAudit("role", userId, `${prev || "?"} → ${role}`);
  toast("Role badal diya", `${role}`);
}

/* ═══════════ SETTINGS PRELOAD (sab users ke liye) ═══════════ */
export async function preloadOwnerSettings(chatIds: string[]): Promise<void> {
  for (const chatId of chatIds) {
    try {
      const { data } = await sb().from("group_settings").select("key,value")
        .or(`key.eq.slowmode_${chatId},key.eq.badwords_${chatId}`);
      (data || []).forEach((r: any) => {
        try {
          if (r.key === `slowmode_${chatId}`) localStorage.setItem(`chatsapp:slowmode:${chatId}`, String(Number(r.value) || 0));
          if (r.key === `badwords_${chatId}` && r.value) localStorage.setItem(`chatsapp:badwords:${chatId}`, JSON.stringify(r.value));
        } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
  }
}

/* ═══════════ G10 — CHANGELOG ═══════════ */
export const CHANGELOG: { v: string; date: string; items: string[] }[] = [
  {
    v: "Phase 8", date: "16 Oct 2026",
    items: ["Owner superpowers: analytics, broadcast, scheduled elaan, pin manager, slow mode, role manager, auto-mod, audit log"],
  },
  {
    v: "Phase 7", date: "16 Oct 2026",
    items: ["Games: deen quiz, tic-tac-toe, daily paheli, Hinglish stickers", "Group banao/delete karo, direct DM"],
  },
  {
    v: "Phase 6", date: "16 Oct 2026",
    items: ["Welcome splash, profile wizard, setup checklist, achievement badges, auto welcome"],
  },
  {
    v: "Phase 5", date: "16 Oct 2026",
    items: ["Privacy dashboard, app lock (PIN), compact mode, wallpapers, chat backup"],
  },
  {
    v: "Phase 4", date: "16 Oct 2026",
    items: ["Group info page, media gallery, insights, group rules, global search, file manager"],
  },
  {
    v: "Phase 3", date: "16 Oct 2026",
    items: ["Quran reader (golden Bismillah), Asma-ul-Husna video player, daily ayat/hadees, azaan reminder"],
  },
];
