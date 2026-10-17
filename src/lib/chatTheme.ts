"use client";
// ─── Per-Chat Theme System ───
// GROUPS: owner ka theme Supabase `group_settings` me `theme_<chatId>` key par —
//         realtime se sab members ko foran dikhe (no reload).
// DMS (1-on-1): har user apna LOCAL theme dekhta hai — `chatsapp:dtheme:<chatId>`
//         localStorage me, Supabase me KABHI nahi likha jata. Dusre user ko
//         tumhara theme nahi dikhega, tumhe uska nahi.

import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { getTheme, DEFAULT_THEME_ID } from "@/lib/themes";
import { getEffectivePalette } from "@/lib/themePrefs";
import { getState } from "@/lib/store";

const LS_PREFIX = "chatsapp:ctheme:"; // groups (Supabase-synced cache)
const LS_DM_PREFIX = "chatsapp:dtheme:"; // DMs — LOCAL ONLY, kabhi Supabase me nahi
const gkey = (chatId: string) => `theme_${chatId}`;

/** Chat DM hai ya group? (store ke chats se) */
export function isDMChat(chatId?: string | null): boolean {
  if (!chatId) return false;
  try {
    const chats = getState().chats || [];
    return chats.some((c: any) => c.id === chatId && c.type === "dm");
  } catch { return false; }
}

/** Chat ke liye sahi localStorage key (DM vs group alag) */
const lsKey = (chatId: string) => (isDMChat(chatId) ? LS_DM_PREFIX : LS_PREFIX) + chatId;

/* ── Reactive store (useSyncExternalStore pattern) ── */
let tick = 0;
const listeners = new Set<() => void>();
function emit() {
  tick++;
  listeners.forEach((cb) => cb());
}
export function useChatThemeVersion(): number {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => tick,
    () => 0,
  );
}

/* ── In-memory cache (Supabase fetch se pehle instant) ── */
const cache = new Map<string, string>();

/** Chat ka theme id — cache/localStorage se foran (default: "default").
 *  DM: sirf is user ka local theme. Group: owner ka synced theme. */
export function getChatThemeId(chatId?: string | null): string {
  if (!chatId) return DEFAULT_THEME_ID;
  const c = cache.get(chatId);
  if (c) return c;
  try {
    const v = localStorage.getItem(lsKey(chatId));
    if (v && getTheme(v)) { cache.set(chatId, v); return v; }
  } catch { /* ignore */ }
  return DEFAULT_THEME_ID;
}

/** Chat ka theme lao.
 *  DM → sirf localStorage (koi Supabase call nahi).
 *  Group → Supabase se (owner ka synced theme). */
export async function loadChatTheme(chatId: string): Promise<string> {
  if (isDMChat(chatId)) { emit(); return getChatThemeId(chatId); }
  try {
    const { data } = await supabase()
      .from("group_settings")
      .select("value")
      .eq("key", gkey(chatId))
      .maybeSingle();
    const tid = (data?.value as any)?.theme;
    const themeId = tid && getTheme(tid) ? tid : DEFAULT_THEME_ID;
    cache.set(chatId, themeId);
    try { localStorage.setItem(lsKey(chatId), themeId); } catch { /* ignore */ }
    emit();
    return themeId;
  } catch {
    return getChatThemeId(chatId);
  }
}

/** Chat ka theme badlo.
 *  DM → SIRF local (is user ke liye) — Supabase me KABHI nahi likhte.
 *  Group → Supabase + cache (realtime sab members ko sync karega). */
export async function setChatTheme(chatId: string, themeId: string): Promise<boolean> {
  if (!getTheme(themeId)) return false;
  const dm = isDMChat(chatId);
  cache.set(chatId, themeId);
  try { localStorage.setItem(lsKey(chatId), themeId); } catch { /* ignore */ }
  emit();
  if (dm) return true; // DM: local only — dusre user ko kabhi nahi jayega
  try {
    const { error } = await supabase()
      .from("group_settings")
      .upsert({ key: gkey(chatId), value: { theme: themeId, at: Date.now() } }, { onConflict: "key" });
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}

/** Realtime se aya remote theme change — cache update + rerender.
 *  (Sirf groups ke liye hota hai; DM kabhi Supabase me nahi likhta — defensive guard.) */
export function onRemoteThemeChange(chatId: string, themeId: string) {
  if (isDMChat(chatId)) return;
  const tid = themeId && getTheme(themeId) ? themeId : DEFAULT_THEME_ID;
  if (cache.get(chatId) === tid) return;
  cache.set(chatId, tid);
  try { localStorage.setItem(lsKey(chatId), tid); } catch { /* ignore */ }
  emit();
}

/** Theme ki CSS variables — chat container par inline style ke liye
 *  (bubble color overrides feature 15 yahan merge hote hain) */
export function themeCssVars(themeId: string): Record<string, string> {
  const theme = getTheme(themeId);
  const p = getEffectivePalette(themeId);
  return {
    "--th-bg": p.bg,
    "--th-bg-gradient": p.bgGradient,
    "--th-surface": p.surface,
    "--th-surface-glass": p.surfaceGlass,
    "--th-sidebar": p.sidebar,
    "--th-header": p.header,
    "--th-accent": p.accent,
    "--th-accent-hover": p.accentHover,
    "--th-accent-soft": p.accentSoft,
    "--th-accent-text": p.accentText,
    "--th-bubble-own": p.bubbleOwn,
    "--th-bubble-own-text": p.bubbleOwnText,
    "--th-bubble-other": p.bubbleOther,
    "--th-bubble-other-text": p.bubbleOtherText,
    "--th-bubble-own-border": p.bubbleOwnBorder || "none",
    "--th-bubble-other-border": p.bubbleOtherBorder || "1px solid rgba(0,0,0,0.07)",
    "--th-bubble-own-shadow": p.bubbleOwnShadow || "0 1px 2px rgba(0,0,0,0.08)",
    "--th-bubble-other-shadow": p.bubbleOtherShadow || "0 1px 2px rgba(0,0,0,0.08)",
    "--th-bubble-own-radius": p.bubbleOwnRadius || "16px 6px 16px 16px",
    "--th-bubble-other-radius": p.bubbleOtherRadius || "6px 16px 16px 16px",
    "--th-text": p.textPrimary,
    "--th-text-soft": p.textSecondary,
    "--th-text-mute": p.textMuted,
    "--th-border": p.border,
    "--th-input-bg": p.inputBg,
    "--th-shadow": p.shadow,
    "--th-glow": p.glow || p.accent,
    "--th-font": theme.fontFamily || "inherit",
    "--th-bubble-font-style": theme.bubbleFontStyle || "normal",
  };
}

/* ── Feature 16: Most-used theme stats 📊 ── */
const LS_USAGE = "chatsapp:theme_usage";

/** Theme lagane par count barhao (DM + group dono me track hota hai) */
export function trackThemeUsage(themeId: string) {
  try {
    const raw = localStorage.getItem(LS_USAGE);
    const counts: Record<string, number> = raw ? JSON.parse(raw) : {};
    counts[themeId] = (counts[themeId] || 0) + 1;
    localStorage.setItem(LS_USAGE, JSON.stringify(counts));
    emit(); // picker rerender — Popular section foran update
  } catch { /* ignore */ }
}

/** {themeId: count} — localStorage se */
export function getThemeUsage(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_USAGE);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Usage ke hisab se sorted theme ids (zyada use → pehle). limit default 6 */
export function getPopularThemeIds(limit = 6): string[] {
  const counts = getThemeUsage();
  return Object.entries(counts)
    .filter(([id, c]) => c > 0 && getTheme(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
