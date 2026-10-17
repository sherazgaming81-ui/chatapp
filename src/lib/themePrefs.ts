"use client";
// ─── Theme Preferences: animation speed, message font size, bubble color overrides, theme of the day ───
import { useSyncExternalStore } from "react";
import { THEMES, getTheme, type Theme } from "@/lib/themes";

const LS_ANIM = "chatsapp:anim_speed"; // "slow" | "normal" | "fast" | "off"
const LS_FONT = "chatsapp:msg_font_size"; // number 12-18
const LS_BUBBLE = "chatsapp:bubble_override:"; // + themeId -> {own, ownText, other, otherText}

export type AnimSpeed = "slow" | "normal" | "fast" | "off";
export const ANIM_SPEEDS: AnimSpeed[] = ["slow", "normal", "fast", "off"];
export const ANIM_LABELS: Record<AnimSpeed, string> = { slow: "Slow 🐢", normal: "Normal", fast: "Fast ⚡", off: "Off 🚫" };

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
}
function lsDel(k: string) {
  try { localStorage.removeItem(k); } catch { /* ignore */ }
}

/* ── Reactive (overrides change → rerender pickers + chat) ── */
let tick = 0;
const listeners = new Set<() => void>();
function emit() { tick++; listeners.forEach((cb) => cb()); }
export function useThemePrefsVersion(): number {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => tick,
    () => 0,
  );
}

/* ═══════════ 13. ANIMATION SPEED ═══════════ */
export function getAnimSpeed(): AnimSpeed {
  const v = lsGet(LS_ANIM);
  return (ANIM_SPEEDS as string[]).includes(v || "") ? (v as AnimSpeed) : "normal";
}
export function setAnimSpeed(v: AnimSpeed) {
  lsSet(LS_ANIM, v);
  applyAnimSpeed();
}
export function applyAnimSpeed() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.anim = getAnimSpeed();
}

/* ═══════════ 14. MESSAGE FONT SIZE (global, 12–18px) ═══════════ */
export const FONT_MIN = 12, FONT_MAX = 18, FONT_DEFAULT = 15;
export function getMsgFontSize(): number {
  const v = parseInt(lsGet(LS_FONT) || "", 10);
  return v >= FONT_MIN && v <= FONT_MAX ? v : FONT_DEFAULT;
}
export function setMsgFontSize(n: number) {
  const c = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(n)));
  lsSet(LS_FONT, String(c));
  applyMsgFontSize();
}
export function applyMsgFontSize() {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--msg-font-size", `${getMsgFontSize()}px`);
}

/* ═══════════ 15. BUBBLE COLOR OVERRIDES (per theme) ═══════════ */
export interface BubbleOverride {
  own?: string;      // my bubble bg
  ownText?: string;  // my bubble text
  other?: string;    // their bubble bg
  otherText?: string;// their bubble text
}
export function getBubbleOverride(themeId: string): BubbleOverride {
  try {
    const raw = lsGet(LS_BUBBLE + themeId);
    if (!raw) return {};
    const o = JSON.parse(raw);
    const clean: BubbleOverride = {};
    for (const k of ["own", "ownText", "other", "otherText"] as const) {
      if (typeof o[k] === "string" && /^#[0-9a-fA-F]{6}$/.test(o[k])) clean[k] = o[k];
    }
    return clean;
  } catch { return {}; }
}
export function setBubbleOverride(themeId: string, patch: BubbleOverride) {
  const cur = getBubbleOverride(themeId);
  const next = { ...cur, ...patch };
  // empty strings → delete key
  for (const k of Object.keys(next) as (keyof BubbleOverride)[]) {
    if (!next[k]) delete next[k];
  }
  if (Object.keys(next).length === 0) lsDel(LS_BUBBLE + themeId);
  else lsSet(LS_BUBBLE + themeId, JSON.stringify(next));
  emit();
}
export function resetBubbleOverride(themeId: string) {
  lsDel(LS_BUBBLE + themeId);
  emit();
}
export function hasBubbleOverride(themeId: string): boolean {
  return Object.keys(getBubbleOverride(themeId)).length > 0;
}

/** Theme ka effective palette — overrides merge karke (ThemeCard preview + chat dono ke liye) */
export function getEffectivePalette(themeId: string) {
  const theme = getTheme(themeId);
  const ov = getBubbleOverride(themeId);
  return {
    ...theme.palette,
    bubbleOwn: ov.own || theme.palette.bubbleOwn,
    bubbleOwnText: ov.ownText || theme.palette.bubbleOwnText,
    bubbleOther: ov.other || theme.palette.bubbleOther,
    bubbleOtherText: ov.otherText || theme.palette.bubbleOtherText,
  };
}

/* ═══════════ 10. THEME OF THE DAY (deterministic) ═══════════ */
export function getThemeOfTheDay(date = new Date()): Theme {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const idx = dayOfYear % THEMES.length;
  return THEMES[idx];
}

/* ── Module init (client): prefs apply on import, prefs.ts pattern ── */
if (typeof window !== "undefined") {
  applyAnimSpeed();
  applyMsgFontSize();
}
