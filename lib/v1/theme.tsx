// lib/v1/theme.tsx — v1 theme system for the Chat app.
// Props/API:
//   <ThemeProvider> ...app... </ThemeProvider>   // root me ek dafa wrap karein
//   const { mode, setMode, accent, setAccent, wallpaper, setWallpaper } = useTheme();
// Example:
//   import { ThemeProvider, useTheme } from '@/lib/v1/theme';
//   export default function RootLayout({ children }) {
//     return <ThemeProvider>{children}</ThemeProvider>;
//   }
//   // kisi bhi child me:
//   const { mode, setMode } = useTheme();
//   setMode(mode === 'dark' ? 'light' : 'dark');
// Theme document.documentElement par CSS variables lagata hai:
//   --chat-bg, --chat-panel, --chat-header, --chat-accent, --chat-muted, --chat-text,
//   --chat-wallpaper (+ data-theme / data-wallpaper attributes).
// localStorage key: 'chat-theme-v1'. Wallpapers sirf CSS gradients hain, koi image nahi.

'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

export type ThemeMode = 'light' | 'dark';
export type WallpaperKind = 'default' | 'dots' | 'waves' | 'none';

export const DEFAULT_ACCENT = '#00a884';
const STORAGE_KEY = 'chat-theme-v1';

// Accent choices — user ko dikhane ke liye Hinglish naam ke saath.
export const ACCENTS: { value: string; name: string }[] = [
  { value: '#00a884', name: 'Sabz (default)' },
  { value: '#3b82f6', name: 'Neela' },
  { value: '#a855f7', name: 'Jamuni' },
  { value: '#f59e0b', name: 'Narangi' },
];

export const WALLPAPERS: { value: WallpaperKind; name: string }[] = [
  { value: 'default', name: 'Sadha' },
  { value: 'dots', name: 'Nuqte' },
  { value: 'waves', name: 'Lehren' },
  { value: 'none', name: 'Khaali' },
];

const PALETTES: Record<ThemeMode, Record<string, string>> = {
  dark: {
    '--chat-bg': '#0b141a',
    '--chat-panel': '#111b21',
    '--chat-header': '#202c33',
    '--chat-muted': '#8696a0',
    '--chat-text': '#e9edef',
  },
  light: {
    '--chat-bg': '#e5ddd5',
    '--chat-panel': '#ffffff',
    '--chat-header': '#f0f2f5',
    '--chat-muted': '#667781',
    '--chat-text': '#111b21',
  },
};

// Wallpaper ko CSS background-image string me badlein (sirf gradients, koi image nahi).
export function wallpaperBackground(wallpaper: WallpaperKind, mode: ThemeMode): string {
  if (wallpaper === 'none' || wallpaper === 'default') return 'none';
  const dot = mode === 'dark' ? 'rgba(255,255,255,0.055)' : 'rgba(17,27,33,0.06)';
  if (wallpaper === 'dots') {
    return `radial-gradient(${dot} 1.2px, transparent 1.3px)`;
  }
  // waves — naram lehren, accent ke halke rang me
  const tint = mode === 'dark' ? 'rgba(0,168,132,0.10)' : 'rgba(0,128,105,0.09)';
  const tint2 = mode === 'dark' ? 'rgba(0,168,132,0.06)' : 'rgba(0,128,105,0.05)';
  return (
    `radial-gradient(60% 45% at 50% 0%, ${tint}, transparent 70%), ` +
    `radial-gradient(75% 55% at 50% 115%, ${tint2}, transparent 70%)`
  );
}

// Chat surface par wallpaper lagane ke liye tayyar style object.
// Example: <div style={wallpaperStyle(wallpaper, mode)} className="bg-[var(--chat-bg)]" />
export function wallpaperStyle(wallpaper: WallpaperKind, mode: ThemeMode): CSSProperties {
  return {
    backgroundImage: wallpaperBackground(wallpaper, mode),
    backgroundSize: wallpaper === 'dots' ? '22px 22px' : 'cover',
  };
}

type ThemeValue = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  accent: string;
  setAccent: (a: string) => void;
  wallpaper: WallpaperKind;
  setWallpaper: (w: WallpaperKind) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

type StoredTheme = {
  mode?: unknown;
  accent?: unknown;
  wallpaper?: unknown;
};

function loadStored(): { mode: ThemeMode; accent: string; wallpaper: WallpaperKind } {
  const fallback = { mode: 'dark' as ThemeMode, accent: DEFAULT_ACCENT, wallpaper: 'default' as WallpaperKind };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as StoredTheme;
    return {
      mode: parsed.mode === 'light' || parsed.mode === 'dark' ? parsed.mode : fallback.mode,
      accent: typeof parsed.accent === 'string' && parsed.accent ? parsed.accent : fallback.accent,
      wallpaper:
        parsed.wallpaper === 'default' ||
        parsed.wallpaper === 'dots' ||
        parsed.wallpaper === 'waves' ||
        parsed.wallpaper === 'none'
          ? parsed.wallpaper
          : fallback.wallpaper,
    };
  } catch {
    return fallback;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(loadStored);
  const [mode, setMode] = useState<ThemeMode>(stored.mode);
  const [accent, setAccent] = useState<string>(stored.accent);
  const [wallpaper, setWallpaper] = useState<WallpaperKind>(stored.wallpaper);

  // CSS variables + data attributes documentElement par lagayein.
  useEffect(() => {
    const root = document.documentElement;
    const palette = PALETTES[mode];
    for (const [key, value] of Object.entries(palette)) {
      root.style.setProperty(key, value);
    }
    root.style.setProperty('--chat-accent', accent);
    root.style.setProperty('--chat-wallpaper', wallpaperBackground(wallpaper, mode));
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-wallpaper', wallpaper);
  }, [mode, accent, wallpaper]);

  // Har tabdeeli ko save karein.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, accent, wallpaper }));
    } catch {
      // storage na mile to khamoshi se ignore karein
    }
  }, [mode, accent, wallpaper]);

  return (
    <ThemeContext.Provider
      value={{ mode, setMode, accent, setAccent, wallpaper, setWallpaper }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme ko <ThemeProvider> ke andar use karein.');
  }
  return ctx;
}
