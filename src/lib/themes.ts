"use client";
// ─── ChatsApp Premium Themes ───
// 10 hand-crafted themes, Claude-level polish. Har theme ka apna mood, apna vibe!
// Theme CSS variables ke zariye apply hota hai — data-theme attribute par.

export interface ThemePalette {
  // Core surfaces
  bg: string;              // app background
  bgGradient: string;      // background gradient/mesh
  surface: string;         // cards, panels
  surfaceGlass: string;    // glassmorphism panels
  sidebar: string;         // left sidebar
  header: string;          // chat header

  // Accent
  accent: string;          // primary buttons, links, active states
  accentHover: string;
  accentSoft: string;      // light accent backgrounds
  accentText: string;      // text on accent bg

  // Chat bubbles
  bubbleOwn: string;       // user ke messages
  bubbleOwnText: string;
  bubbleOther: string;     // doosron ke messages
  bubbleOtherText: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Misc
  border: string;
  inputBg: string;
  shadow: string;
}

export interface Theme {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  dark: boolean;
  palette: ThemePalette;
}

export const THEMES: Theme[] = [
  {
    id: "default",
    name: "ChatsApp Classic",
    emoji: "💬",
    tagline: "Original Discord-light look",
    dark: false,
    palette: {
      bg: "#eef0fb",
      bgGradient: "linear-gradient(135deg, #f2f4ff 0%, #eef0fb 45%, #f6f0fb 100%)",
      surface: "#ffffff",
      surfaceGlass: "rgba(255,255,255,0.62)",
      sidebar: "#ffffff",
      header: "#ffffff",
      accent: "#5865f2",
      accentHover: "#4752c4",
      accentSoft: "rgba(88,101,242,0.08)",
      accentText: "#ffffff",
      bubbleOwn: "#d9fdd3",
      bubbleOwnText: "#1a2e1a",
      bubbleOther: "#ffffff",
      bubbleOtherText: "#2f3035",
      textPrimary: "#2f3035",
      textSecondary: "#5c5e66",
      textMuted: "#80848e",
      border: "rgba(0,0,0,0.08)",
      inputBg: "#f2f3f5",
      shadow: "rgba(0,0,0,0.08)",
    },
  },
  {
    id: "midnight-glow",
    name: "Midnight Glow",
    emoji: "🌙",
    tagline: "Deep dark + neon accents, futuristic",
    dark: true,
    palette: {
      bg: "#0a0a14",
      bgGradient: "radial-gradient(60% 50% at 20% 10%, rgba(0,255,255,0.08), transparent 70%), radial-gradient(50% 40% at 85% 90%, rgba(188,19,254,0.10), transparent 70%), linear-gradient(135deg, #0a0a14 0%, #0d0d1f 100%)",
      surface: "#131322",
      surfaceGlass: "rgba(19,19,34,0.75)",
      sidebar: "#0d0d1a",
      header: "#131322",
      accent: "#00f0ff",
      accentHover: "#00c8d8",
      accentSoft: "rgba(0,240,255,0.10)",
      accentText: "#0a0a14",
      bubbleOwn: "#00f0ff",
      bubbleOwnText: "#0a0a14",
      bubbleOther: "#1e1e32",
      bubbleOtherText: "#e8e8f0",
      textPrimary: "#f0f0f8",
      textSecondary: "#a0a0b8",
      textMuted: "#60607a",
      border: "rgba(0,240,255,0.12)",
      inputBg: "#1a1a2e",
      shadow: "rgba(0,240,255,0.15)",
    },
  },
  {
    id: "sakura-dream",
    name: "Sakura Dream",
    emoji: "🌸",
    tagline: "Soft pink + white, Japanese minimal",
    dark: false,
    palette: {
      bg: "#fff5f7",
      bgGradient: "radial-gradient(50% 40% at 15% 10%, rgba(255,183,197,0.25), transparent 70%), radial-gradient(40% 35% at 90% 85%, rgba(255,143,171,0.15), transparent 70%), linear-gradient(135deg, #fff5f7 0%, #ffeef2 100%)",
      surface: "#ffffff",
      surfaceGlass: "rgba(255,255,255,0.70)",
      sidebar: "#fff0f3",
      header: "#ffffff",
      accent: "#ff8fab",
      accentHover: "#fb6f92",
      accentSoft: "rgba(255,143,171,0.12)",
      accentText: "#ffffff",
      bubbleOwn: "#ffd6e0",
      bubbleOwnText: "#5c1a2e",
      bubbleOther: "#ffffff",
      bubbleOtherText: "#4a3a3e",
      textPrimary: "#4a2e35",
      textSecondary: "#8a6a72",
      textMuted: "#b89aa1",
      border: "rgba(255,143,171,0.20)",
      inputBg: "#fff0f3",
      shadow: "rgba(255,143,171,0.15)",
    },
  },
  {
    id: "desert-gold",
    name: "Desert Gold",
    emoji: "🏜️",
    tagline: "Warm sand + gold, premium luxury",
    dark: false,
    palette: {
      bg: "#faf6ef",
      bgGradient: "radial-gradient(55% 45% at 20% 15%, rgba(212,175,55,0.15), transparent 70%), radial-gradient(45% 40% at 85% 80%, rgba(180,130,40,0.12), transparent 70%), linear-gradient(135deg, #faf6ef 0%, #f5efe0 100%)",
      surface: "#fffdf8",
      surfaceGlass: "rgba(255,253,248,0.75)",
      sidebar: "#f7f1e3",
      header: "#fffdf8",
      accent: "#c9a227",
      accentHover: "#a8861d",
      accentSoft: "rgba(201,162,39,0.12)",
      accentText: "#ffffff",
      bubbleOwn: "#f5e6c4",
      bubbleOwnText: "#4a3a15",
      bubbleOther: "#fffdf8",
      bubbleOtherText: "#3a3226",
      textPrimary: "#3a3226",
      textSecondary: "#7a6c52",
      textMuted: "#a89a7a",
      border: "rgba(201,162,39,0.25)",
      inputBg: "#f7f1e3",
      shadow: "rgba(201,162,39,0.15)",
    },
  },
  {
    id: "ocean-depth",
    name: "Ocean Depth",
    emoji: "🌊",
    tagline: "Deep blue gradient, calm",
    dark: true,
    palette: {
      bg: "#0a1628",
      bgGradient: "radial-gradient(60% 50% at 30% 20%, rgba(0,119,182,0.20), transparent 70%), radial-gradient(50% 40% at 75% 85%, rgba(0,180,216,0.12), transparent 70%), linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)",
      surface: "#10233d",
      surfaceGlass: "rgba(16,35,61,0.75)",
      sidebar: "#0c1b30",
      header: "#10233d",
      accent: "#00b4d8",
      accentHover: "#0096c7",
      accentSoft: "rgba(0,180,216,0.12)",
      accentText: "#ffffff",
      bubbleOwn: "#0077b6",
      bubbleOwnText: "#ffffff",
      bubbleOther: "#1a3050",
      bubbleOtherText: "#d8e8f5",
      textPrimary: "#e8f2fa",
      textSecondary: "#8fb0cc",
      textMuted: "#5a7a99",
      border: "rgba(0,180,216,0.15)",
      inputBg: "#0d1e36",
      shadow: "rgba(0,180,216,0.20)",
    },
  },
  {
    id: "emerald-mosque",
    name: "Emerald Mosque",
    emoji: "🕌",
    tagline: "Islamic green + gold patterns",
    dark: false,
    palette: {
      bg: "#f0faf4",
      bgGradient: "radial-gradient(50% 40% at 20% 10%, rgba(0,150,80,0.12), transparent 70%), radial-gradient(45% 40% at 85% 85%, rgba(212,175,55,0.10), transparent 70%), linear-gradient(135deg, #f0faf4 0%, #e8f5ee 100%)",
      surface: "#ffffff",
      surfaceGlass: "rgba(255,255,255,0.70)",
      sidebar: "#eef7f1",
      header: "#ffffff",
      accent: "#009650",
      accentHover: "#007a40",
      accentSoft: "rgba(0,150,80,0.10)",
      accentText: "#ffffff",
      bubbleOwn: "#d4f0e0",
      bubbleOwnText: "#0d3a22",
      bubbleOther: "#ffffff",
      bubbleOtherText: "#2a3a30",
      textPrimary: "#1e3a2a",
      textSecondary: "#5a7a65",
      textMuted: "#8aa895",
      border: "rgba(0,150,80,0.18)",
      inputBg: "#eef7f1",
      shadow: "rgba(0,150,80,0.12)",
    },
  },
  {
    id: "cyber-punk",
    name: "Cyber Punk",
    emoji: "⚡",
    tagline: "Neon purple + black, bold",
    dark: true,
    palette: {
      bg: "#0d0014",
      bgGradient: "radial-gradient(55% 45% at 25% 15%, rgba(188,19,254,0.15), transparent 70%), radial-gradient(45% 40% at 80% 85%, rgba(255,0,128,0.12), transparent 70%), linear-gradient(135deg, #0d0014 0%, #1a0030 100%)",
      surface: "#180826",
      surfaceGlass: "rgba(24,8,38,0.78)",
      sidebar: "#12041e",
      header: "#180826",
      accent: "#bc13fe",
      accentHover: "#a010d8",
      accentSoft: "rgba(188,19,254,0.14)",
      accentText: "#ffffff",
      bubbleOwn: "#bc13fe",
      bubbleOwnText: "#ffffff",
      bubbleOther: "#251040",
      bubbleOtherText: "#f0d8ff",
      textPrimary: "#f5e8ff",
      textSecondary: "#b898d8",
      textMuted: "#7a5a99",
      border: "rgba(188,19,254,0.20)",
      inputBg: "#1e0a30",
      shadow: "rgba(188,19,254,0.25)",
    },
  },
  {
    id: "forest-whisper",
    name: "Forest Whisper",
    emoji: "🍃",
    tagline: "Natural greens, peaceful",
    dark: false,
    palette: {
      bg: "#f2f7f0",
      bgGradient: "radial-gradient(50% 40% at 20% 10%, rgba(76,140,60,0.12), transparent 70%), radial-gradient(45% 40% at 85% 85%, rgba(120,180,100,0.10), transparent 70%), linear-gradient(135deg, #f2f7f0 0%, #eaf2e6 100%)",
      surface: "#ffffff",
      surfaceGlass: "rgba(255,255,255,0.70)",
      sidebar: "#eef4ea",
      header: "#ffffff",
      accent: "#4c8c3c",
      accentHover: "#3d7030",
      accentSoft: "rgba(76,140,60,0.12)",
      accentText: "#ffffff",
      bubbleOwn: "#d8eccf",
      bubbleOwnText: "#1e3a18",
      bubbleOther: "#ffffff",
      bubbleOtherText: "#2e3a2a",
      textPrimary: "#2a3a26",
      textSecondary: "#5e7358",
      textMuted: "#8aa080",
      border: "rgba(76,140,60,0.18)",
      inputBg: "#eef4ea",
      shadow: "rgba(76,140,60,0.12)",
    },
  },
  {
    id: "sunset-bliss",
    name: "Sunset Bliss",
    emoji: "🌅",
    tagline: "Orange-pink gradient, warm",
    dark: false,
    palette: {
      bg: "#fff8f2",
      bgGradient: "radial-gradient(55% 45% at 20% 10%, rgba(255,150,80,0.18), transparent 70%), radial-gradient(45% 40% at 85% 85%, rgba(255,100,130,0.12), transparent 70%), linear-gradient(135deg, #fff8f2 0%, #ffefe6 100%)",
      surface: "#ffffff",
      surfaceGlass: "rgba(255,255,255,0.70)",
      sidebar: "#fff2e8",
      header: "#ffffff",
      accent: "#ff6b4a",
      accentHover: "#e85538",
      accentSoft: "rgba(255,107,74,0.12)",
      accentText: "#ffffff",
      bubbleOwn: "#ffd9c9",
      bubbleOwnText: "#5c2214",
      bubbleOther: "#ffffff",
      bubbleOtherText: "#4a352c",
      textPrimary: "#4a2e22",
      textSecondary: "#8a6552",
      textMuted: "#b89480",
      border: "rgba(255,107,74,0.20)",
      inputBg: "#fff2e8",
      shadow: "rgba(255,107,74,0.15)",
    },
  },
  {
    id: "arctic-frost",
    name: "Arctic Frost",
    emoji: "❄️",
    tagline: "Ice blue + white, clean",
    dark: false,
    palette: {
      bg: "#f4f9fc",
      bgGradient: "radial-gradient(50% 40% at 20% 10%, rgba(140,200,230,0.18), transparent 70%), radial-gradient(45% 40% at 85% 85%, rgba(180,220,245,0.15), transparent 70%), linear-gradient(135deg, #f4f9fc 0%, #eef5fa 100%)",
      surface: "#ffffff",
      surfaceGlass: "rgba(255,255,255,0.75)",
      sidebar: "#eef4f9",
      header: "#ffffff",
      accent: "#3a9bdc",
      accentHover: "#2d85c2",
      accentSoft: "rgba(58,155,220,0.12)",
      accentText: "#ffffff",
      bubbleOwn: "#d4eaf8",
      bubbleOwnText: "#143a5c",
      bubbleOther: "#ffffff",
      bubbleOtherText: "#2c3a4a",
      textPrimary: "#2a3a4a",
      textSecondary: "#5e7a90",
      textMuted: "#8aa4b8",
      border: "rgba(58,155,220,0.18)",
      inputBg: "#eef4f9",
      shadow: "rgba(58,155,220,0.12)",
    },
  },
  {
    id: "royal-velvet",
    name: "Royal Velvet",
    emoji: "🎭",
    tagline: "Deep purple + gold, king-like",
    dark: true,
    palette: {
      bg: "#120a1e",
      bgGradient: "radial-gradient(55% 45% at 25% 15%, rgba(120,60,180,0.18), transparent 70%), radial-gradient(45% 40% at 80% 85%, rgba(212,175,55,0.10), transparent 70%), linear-gradient(135deg, #120a1e 0%, #1e1230 100%)",
      surface: "#1d1330",
      surfaceGlass: "rgba(29,19,48,0.78)",
      sidebar: "#160d26",
      header: "#1d1330",
      accent: "#d4af37",
      accentHover: "#b8962d",
      accentSoft: "rgba(212,175,55,0.14)",
      accentText: "#1a1208",
      bubbleOwn: "#d4af37",
      bubbleOwnText: "#1a1208",
      bubbleOther: "#2a1e45",
      bubbleOtherText: "#f0e8d8",
      textPrimary: "#f5eeda",
      textSecondary: "#c0aa80",
      textMuted: "#806a50",
      border: "rgba(212,175,55,0.20)",
      inputBg: "#201636",
      shadow: "rgba(212,175,55,0.20)",
    },
  },
];

export const DEFAULT_THEME_ID = "default";
const LS_KEY = "chatsapp:theme";

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function getStoredThemeId(): string {
  try {
    return localStorage.getItem(LS_KEY) || DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function setStoredThemeId(id: string) {
  try {
    localStorage.setItem(LS_KEY, id);
  } catch { /* ignore */ }
}

/** Theme ko CSS variables ke zariye <html> par apply karo */
export function applyTheme(id: string) {
  const theme = getTheme(id);
  const p = theme.palette;
  try {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme.id);
    const s = root.style;
    s.setProperty("--th-bg", p.bg);
    s.setProperty("--th-bg-gradient", p.bgGradient);
    s.setProperty("--th-surface", p.surface);
    s.setProperty("--th-surface-glass", p.surfaceGlass);
    s.setProperty("--th-sidebar", p.sidebar);
    s.setProperty("--th-header", p.header);
    s.setProperty("--th-accent", p.accent);
    s.setProperty("--th-accent-hover", p.accentHover);
    s.setProperty("--th-accent-soft", p.accentSoft);
    s.setProperty("--th-accent-text", p.accentText);
    s.setProperty("--th-bubble-own", p.bubbleOwn);
    s.setProperty("--th-bubble-own-text", p.bubbleOwnText);
    s.setProperty("--th-bubble-other", p.bubbleOther);
    s.setProperty("--th-bubble-other-text", p.bubbleOtherText);
    s.setProperty("--th-text", p.textPrimary);
    s.setProperty("--th-text-soft", p.textSecondary);
    s.setProperty("--th-text-mute", p.textMuted);
    s.setProperty("--th-border", p.border);
    s.setProperty("--th-input-bg", p.inputBg);
    s.setProperty("--th-shadow", p.shadow);
    // Dark mode class bhi sync karo
    root.classList.toggle("dark", theme.dark);
  } catch { /* ignore */ }
}
