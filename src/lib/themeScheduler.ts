"use client";
// ─── Auto Theme Scheduler 🌙☀️ ───
// Din (6 AM – 6 PM): bright/light theme. Raat (6 PM – 6 AM): dark/cozy theme.
// Sirf DM chats par lagta hai (user ke apne local themes) — groups me owner ka faisla rehta hai.
import { useEffect, useRef } from "react";
import { THEMES, getTheme } from "@/lib/themes";
import { setChatTheme, getChatThemeId } from "@/lib/chatTheme";
import { getState } from "@/lib/store";

const LS_AUTO = "chatsapp:auto_theme"; // "1" = on
const LS_DAY = "chatsapp:auto_theme_day"; // theme id
const LS_NIGHT = "chatsapp:auto_theme_night"; // theme id

export const DAY_THEME_DEFAULT = "golden-hour";
export const NIGHT_THEME_DEFAULT = "ultraviolet";

/** Light (day) themes — scheduler dropdown ke liye */
export function dayThemes() {
  return THEMES.filter((t) => !t.dark);
}
/** Dark/cozy (night) themes — scheduler dropdown ke liye */
export function nightThemes() {
  return THEMES.filter((t) => t.dark && t.id !== "default");
}

function lsGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function lsSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
}

export function isAutoTheme(): boolean {
  return lsGet(LS_AUTO) === "1";
}
export function setAutoTheme(v: boolean) {
  lsSet(LS_AUTO, v ? "1" : "0");
  if (v) void tickAutoTheme(true);
}

export function getDayThemeId(): string {
  const v = lsGet(LS_DAY);
  return v && getTheme(v) && !getTheme(v).dark ? v : DAY_THEME_DEFAULT;
}
export function setDayThemeId(id: string) {
  if (getTheme(id)) { lsSet(LS_DAY, id); void tickAutoTheme(true); }
}
export function getNightThemeId(): string {
  const v = lsGet(LS_NIGHT);
  return v && getTheme(v) && getTheme(v).dark ? v : NIGHT_THEME_DEFAULT;
}
export function setNightThemeId(id: string) {
  if (getTheme(id)) { lsSet(LS_NIGHT, id); void tickAutoTheme(true); }
}

/** Abhi din hai? Din = subah 6:00 se shaam 5:59 tak */
export function isDayTime(now: Date = new Date()): boolean {
  const h = now.getHours();
  return h >= 6 && h < 18;
}

/** Is waqt ka scheduled theme id */
export function scheduledThemeId(now: Date = new Date()): string {
  return isDayTime(now) ? getDayThemeId() : getNightThemeId();
}

/**
 * Auto ON hai to user ke SAB DM chats par scheduled theme lagao (local only).
 * @returns true agar koi theme badli
 */
export async function tickAutoTheme(force = false): Promise<boolean> {
  if (!isAutoTheme()) return false;
  const target = scheduledThemeId();
  let changed = false;
  try {
    const chats = getState().chats || [];
    for (const c of chats as any[]) {
      if (c?.type !== "dm" || !c?.id) continue;
      const cur = getChatThemeId(c.id);
      if (cur !== target || force) {
        // force par bhi sirf tab likho jab different ho (toast spam se bacho)
        if (cur !== target) {
          await setChatTheme(c.id, target);
          changed = true;
        }
      }
    }
  } catch { /* ignore */ }
  return changed;
}

/** App root me lagao — har 60s me check karega + mount par foran */
export function useAutoThemeTicker() {
  const last = useRef<string>("");
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!alive || !isAutoTheme()) return;
      const t = scheduledThemeId();
      // Sirf tab tick karo jab scheduled theme badla ho (ya pehli baar)
      if (t !== last.current) {
        last.current = t;
        await tickAutoTheme();
      } else {
        await tickAutoTheme();
      }
    };
    void run();
    const iv = setInterval(() => { void run(); }, 60_000);
    // Tab wapas active ho to bhi check karo
    const onVis = () => { if (document.visibilityState === "visible") void run(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
}
