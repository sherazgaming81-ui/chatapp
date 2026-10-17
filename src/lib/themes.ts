"use client";
// ─── ChatsApp AI Themes ───
// 13 AI-generated themes (Claude + DeepSeek + ChatGPT) + ChatsApp Classic.
// Har theme ki apni unique visual identity — fonts, bubbles, animations, glows!
// Theme CSS variables + data-theme attribute ke zariye apply hota hai.

export interface ThemePalette {
  // Core surfaces
  bg: string;
  bgGradient: string;
  surface: string;
  surfaceGlass: string;
  sidebar: string;
  header: string;

  // Accent
  accent: string;
  accentHover: string;
  accentSoft: string;
  accentText: string;

  // Chat bubbles
  bubbleOwn: string;
  bubbleOwnText: string;
  bubbleOther: string;
  bubbleOtherText: string;
  bubbleOwnBorder?: string;
  bubbleOtherBorder?: string;
  bubbleOwnShadow?: string;
  bubbleOtherShadow?: string;
  bubbleOwnRadius?: string;   // custom radius for own bubbles
  bubbleOtherRadius?: string; // custom radius for other bubbles

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Misc
  border: string;
  inputBg: string;
  shadow: string;
  glow?: string; // theme glow color for effects
}

export interface Theme {
  id: string;
  name: string;
  urdu?: string;
  emoji: string;
  tagline: string;
  tag?: string; // style badge e.g. "DARK+GLOW"
  dark: boolean;
  fontFamily?: string; // custom font (serif/mono themes)
  bubbleFontStyle?: string; // e.g. "italic" for obsidian-rose
  palette: ThemePalette;
  // Preview-specific (for ThemePicker cards)
  previewBg?: string;
}

export const THEMES: Theme[] = [
  // ═══════════════ 1. DEFAULT ═══════════════
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

  // ═══════════════ CLAUDE THEMES ═══════════════
  {
    id: "toxic-lime",
    name: "Toxic Lime",
    emoji: "☢️",
    tagline: "Pitch black attitude cut by razor-sharp electric lime",
    tag: "DARK+GLOW",
    dark: true,
    palette: {
      bg: "#050505",
      bgGradient: "radial-gradient(260px 200px at 50% 45%, rgba(132,255,0,.22), transparent 70%), repeating-linear-gradient(135deg, rgba(132,255,0,.05) 0 2px, transparent 2px 7px), linear-gradient(135deg, #030303, #0a0d02, #050505)",
      surface: "#0d1206",
      surfaceGlass: "rgba(13,18,6,0.8)",
      sidebar: "#080b03",
      header: "rgba(132,255,0,.07)",
      accent: "#84ff00",
      accentHover: "#6ee000",
      accentSoft: "rgba(132,255,0,0.12)",
      accentText: "#071000",
      bubbleOwn: "linear-gradient(135deg, #d9ff8a, #84ff00, #5fd700)",
      bubbleOwnText: "#071000",
      bubbleOwnBorder: "1px solid #eaff9a",
      bubbleOwnShadow: "0 0 24px rgba(132,255,0,.65)",
      bubbleOther: "#13190a",
      bubbleOtherText: "#dfffb0",
      bubbleOtherBorder: "1px solid rgba(132,255,0,.55)",
      bubbleOtherShadow: "0 0 14px rgba(132,255,0,.25)",
      textPrimary: "#e8ffb0",
      textSecondary: "#b8d97a",
      textMuted: "#7a9450",
      border: "rgba(132,255,0,.55)",
      inputBg: "rgba(255,255,255,.05)",
      shadow: "rgba(132,255,0,.25)",
      glow: "#84ff00",
    },
    previewBg: "linear-gradient(135deg, #030303, #0a0d02)",
  },
  {
    id: "deep-ocean",
    name: "Deep Ocean",
    emoji: "🌊",
    tagline: "From abyss to sunlit shallows — underwater serenity",
    tag: "CALM",
    dark: false,
    palette: {
      bg: "#e8f4fa",
      bgGradient: "linear-gradient(135deg, #000812, #012a4a, #0369a1, #38bdf8, #bde9f7)",
      surface: "#ffffff",
      surfaceGlass: "rgba(255,255,255,0.7)",
      sidebar: "#f0f8fc",
      header: "rgba(255,255,255,.12)",
      accent: "#22d3ee",
      accentHover: "#0ea5e9",
      accentSoft: "rgba(34,211,238,0.12)",
      accentText: "#032a45",
      bubbleOwn: "linear-gradient(135deg, #023e8a, #0369a1, #0891b2)",
      bubbleOwnText: "#ffffff",
      bubbleOwnBorder: "1px solid rgba(165,243,252,.5)",
      bubbleOwnShadow: "0 10px 26px rgba(0,30,70,.55), 0 0 16px rgba(34,211,238,.35)",
      bubbleOther: "rgba(255,255,255,.93)",
      bubbleOtherText: "#052a45",
      bubbleOtherBorder: "1px solid rgba(255,255,255,.9)",
      bubbleOtherShadow: "0 10px 24px rgba(0,30,60,.4)",
      textPrimary: "#052a45",
      textSecondary: "#2a5a7a",
      textMuted: "#6a9ab8",
      border: "rgba(165,243,252,.45)",
      inputBg: "rgba(255,255,255,.16)",
      shadow: "rgba(0,30,60,.3)",
      glow: "#22d3ee",
    },
    previewBg: "linear-gradient(135deg, #012a4a, #0369a1, #38bdf8)",
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    emoji: "🌅",
    tagline: "Honey and amber warmth with rays of late afternoon light",
    tag: "WARM",
    dark: false,
    palette: {
      bg: "#fff8ee",
      bgGradient: "linear-gradient(135deg, #8a3d12, #e38b1a, #ffc65c, #fff0c2, #ffd98a)",
      surface: "#ffffff",
      surfaceGlass: "rgba(255,255,255,0.7)",
      sidebar: "#fef6e8",
      header: "rgba(255,255,255,.6)",
      accent: "#f59e0b",
      accentHover: "#d97706",
      accentSoft: "rgba(245,158,11,0.12)",
      accentText: "#4a1d0a",
      bubbleOwn: "linear-gradient(135deg, #7c2d12, #c2610c, #f59e0b)",
      bubbleOwnText: "#fffbeb",
      bubbleOwnBorder: "1px solid rgba(255,230,160,.6)",
      bubbleOwnShadow: "0 12px 26px -6px rgba(124,45,18,.6)",
      bubbleOther: "rgba(255,255,255,.95)",
      bubbleOtherText: "#4a1d0a",
      bubbleOtherBorder: "1px solid #fff",
      bubbleOtherShadow: "0 12px 24px -6px rgba(124,45,18,.4)",
      textPrimary: "#4a1d0a",
      textSecondary: "#8a5a2a",
      textMuted: "#b8946a",
      border: "rgba(255,255,255,.95)",
      inputBg: "rgba(255,255,255,.78)",
      shadow: "rgba(124,45,18,.4)",
      glow: "#f59e0b",
    },
    previewBg: "linear-gradient(135deg, #e38b1a, #ffc65c, #fff0c2)",
  },
  {
    id: "sakura-storm",
    name: "Sakura Storm",
    emoji: "🌸",
    tagline: "Soft pink spring with cherry-blossom petals drifting down",
    tag: "ANIMATED",
    dark: false,
    palette: {
      bg: "#fff0f4",
      bgGradient: "linear-gradient(135deg, #ffe4ea, #ffc9d8, #ffb3cb, #ffd9e4, #fff0f4)",
      surface: "#ffffff",
      surfaceGlass: "rgba(255,255,255,0.7)",
      sidebar: "#fff2f5",
      header: "rgba(255,255,255,.62)",
      accent: "#f43f5e",
      accentHover: "#e11d48",
      accentSoft: "rgba(244,63,94,0.12)",
      accentText: "#ffffff",
      bubbleOwn: "linear-gradient(135deg, #f43f5e, #ec4899, #fb9ec0)",
      bubbleOwnText: "#ffffff",
      bubbleOwnBorder: "1px solid rgba(255,255,255,.7)",
      bubbleOwnShadow: "0 12px 24px -4px rgba(225,29,99,.45)",
      bubbleOther: "rgba(255,255,255,.95)",
      bubbleOtherText: "#4a1a2c",
      bubbleOtherBorder: "1px solid #fff",
      bubbleOtherShadow: "0 10px 22px -4px rgba(190,24,93,.28)",
      textPrimary: "#4a1a2c",
      textSecondary: "#8a4a5c",
      textMuted: "#b88a98",
      border: "rgba(255,255,255,.95)",
      inputBg: "rgba(255,255,255,.8)",
      shadow: "rgba(190,24,93,.28)",
      glow: "#f43f5e",
    },
    previewBg: "linear-gradient(135deg, #ffc9d8, #ffb3cb, #ffd9e4)",
  },
  {
    id: "desert-mirage",
    name: "Desert Mirage",
    emoji: "🏜️",
    tagline: "Sand-gold dunes and terracotta haze, shimmering in the heat",
    tag: "WARM",
    dark: false,
    palette: {
      bg: "#fef6e8",
      bgGradient: "linear-gradient(135deg, #7a2e12, #c2561f, #e8a44a, #f7d58a, #fde9b8)",
      surface: "#ffffff",
      surfaceGlass: "rgba(255,255,255,0.7)",
      sidebar: "#fdf2e0",
      header: "rgba(255,248,235,.6)",
      accent: "#e07a3a",
      accentHover: "#c2610c",
      accentSoft: "rgba(224,122,58,0.12)",
      accentText: "#ffffff",
      bubbleOwn: "linear-gradient(135deg, #7a2e12, #b4532a, #d97a3a)",
      bubbleOwnText: "#fff3df",
      bubbleOwnBorder: "1px solid rgba(255,220,170,.55)",
      bubbleOwnShadow: "0 12px 26px -6px rgba(92,31,8,.65)",
      bubbleOther: "rgba(255,248,235,.96)",
      bubbleOtherText: "#3b1604",
      bubbleOtherBorder: "1px solid rgba(255,255,255,.95)",
      bubbleOtherShadow: "0 12px 24px -6px rgba(92,31,8,.4)",
      textPrimary: "#3b1604",
      textSecondary: "#7a4a22",
      textMuted: "#a87a4a",
      border: "rgba(255,255,255,.9)",
      inputBg: "rgba(255,248,235,.7)",
      shadow: "rgba(92,31,8,.4)",
      glow: "#e07a3a",
    },
    previewBg: "linear-gradient(135deg, #c2561f, #e8a44a, #f7d58a)",
  },
  {
    id: "obsidian-rose",
    name: "Obsidian Rose",
    urdu: "🖤",
    emoji: "🌹",
    tagline: "Dark romantic gothic — a black rose beneath a crimson arch",
    tag: "GOTHIC",
    dark: true,
    fontFamily: "Georgia, 'Times New Roman', serif",
    bubbleFontStyle: "italic",
    palette: {
      bg: "#080304",
      bgGradient: "radial-gradient(420px 260px at 50% -10%, rgba(190,24,60,.4), transparent 65%), linear-gradient(135deg, #010101, #0c0408, #1d0610, #030203)",
      surface: "#140709",
      surfaceGlass: "rgba(20,7,9,0.8)",
      sidebar: "#0c0406",
      header: "rgba(255,255,255,.05)",
      accent: "#e11d48",
      accentHover: "#be123c",
      accentSoft: "rgba(225,29,72,0.14)",
      accentText: "#fde2e6",
      bubbleOwn: "linear-gradient(135deg, #2a0510, #7f1230, #4a0a1c)",
      bubbleOwnText: "#fde2e6",
      bubbleOwnBorder: "1px solid rgba(225,29,72,.6)",
      bubbleOwnShadow: "0 0 20px rgba(190,24,60,.45), 0 8px 22px rgba(0,0,0,.7)",
      bubbleOther: "linear-gradient(135deg, #120608, #1a0a0e, #100507)",
      bubbleOtherText: "#f9d0d6",
      bubbleOtherBorder: "1px solid rgba(190,24,60,.55)",
      bubbleOtherShadow: "0 8px 22px rgba(0,0,0,.7)",
      textPrimary: "#f9d0d6",
      textSecondary: "#c08088",
      textMuted: "#805058",
      border: "rgba(190,24,60,.5)",
      inputBg: "rgba(255,255,255,.05)",
      shadow: "rgba(190,24,60,.3)",
      glow: "#e11d48",
    },
    previewBg: "linear-gradient(135deg, #0c0408, #1d0610)",
  },

  // ═══════════════ DEEPSEEK THEMES ═══════════════
  {
    id: "frost-byte",
    name: "Frost Byte",
    emoji: "❄️",
    tagline: "Ultra-clean cyber ice lit by precise, surgical blue light",
    tag: "ICE CYBER",
    dark: false,
    palette: {
      bg: "#f4fbff",
      bgGradient: "linear-gradient(135deg,#f4fbff,#dcefff 38%,#eaf6ff 66%,#ffffff 88%,#e7f4ff)",
      surface: "#ffffff",
      surfaceGlass: "rgba(255,255,255,.7)",
      sidebar: "#eef6fc",
      header: "rgba(255,255,255,.66)",
      accent: "#2b7fff",
      accentHover: "#1a6fe0",
      accentSoft: "rgba(43,127,255,0.1)",
      accentText: "#ffffff",
      bubbleOwn: "linear-gradient(135deg,#8fd4ff,#2b7fff 52%,#0a4dbb)",
      bubbleOwnText: "#ffffff",
      bubbleOwnShadow: "0 14px 28px -12px rgba(43,127,255,.75)",
      bubbleOther: "rgba(255,255,255,.88)",
      bubbleOtherText: "#12315c",
      bubbleOtherBorder: "#ffffff",
      bubbleOtherShadow: "0 12px 24px -12px rgba(80,140,220,.55)",
      textPrimary: "#12315c",
      textSecondary: "#3a5a80",
      textMuted: "#7a9ab8",
      border: "rgba(255,255,255,.98)",
      inputBg: "rgba(255,255,255,.7)",
      shadow: "rgba(80,140,220,.5)",
      glow: "#2b7fff",
    },
    previewBg: "linear-gradient(135deg,#dcefff,#eaf6ff,#ffffff)",
  },
  {
    id: "ultraviolet",
    name: "Ultraviolet",
    emoji: "🟣",
    tagline: "Violet rave energy pulsing like a bassline through the room",
    tag: "RAVE PULSE",
    dark: true,
    palette: {
      bg: "#1a0033",
      bgGradient: "radial-gradient(120% 100% at 50% 118%, rgba(138,43,226,.75), transparent 62%), linear-gradient(135deg,#1a0033,#4b00b8 44%,#8a2be2 70%,#2b00a3)",
      surface: "#2a0a50",
      surfaceGlass: "rgba(40,0,80,.5)",
      sidebar: "#1e0438",
      header: "rgba(40,0,80,.48)",
      accent: "#c08bff",
      accentHover: "#a86ff0",
      accentSoft: "rgba(192,139,255,0.14)",
      accentText: "#1a0033",
      bubbleOwn: "linear-gradient(135deg,#c08bff,#8a2be2 48%,#3d00a8)",
      bubbleOwnText: "#ffffff",
      bubbleOwnShadow: "0 0 30px -6px rgba(180,80,255,.95),0 12px 26px rgba(0,0,0,.55)",
      bubbleOther: "rgba(60,20,140,.45)",
      bubbleOtherText: "#f3e9ff",
      bubbleOtherBorder: "rgba(200,150,255,.5)",
      bubbleOtherShadow: "0 0 22px -6px rgba(180,100,255,.9),0 8px 20px rgba(0,0,0,.55)",
      textPrimary: "#ffffff",
      textSecondary: "#d0b8f0",
      textMuted: "#9a80c0",
      border: "rgba(200,150,255,.38)",
      inputBg: "rgba(40,0,80,.5)",
      shadow: "rgba(138,43,226,.5)",
      glow: "#c08bff",
    },
    previewBg: "linear-gradient(135deg,#1a0033,#4b00b8,#8a2be2)",
  },

  // ═══════════════ CHATGPT THEMES ═══════════════
  {
    id: "shahi-mahal",
    name: "Shahi Mahal",
    urdu: "شاہی محل",
    emoji: "🕌",
    tagline: "The emerald court — Mughal palace luxury",
    tag: "ROYAL",
    dark: true,
    fontFamily: "\"Fraunces\", \"Iowan Old Style\", Georgia, serif",
    palette: {
      bg: "#04170f",
      bgGradient: "linear-gradient(155deg,#04170f,#0a2b20 48%,#061d16)",
      surface: "#0a2b20",
      surfaceGlass: "rgba(10,43,32,0.8)",
      sidebar: "#061d16",
      header: "rgba(4,23,15,0.85)",
      accent: "#d7b56d",
      accentHover: "#c0a05a",
      accentSoft: "rgba(215,181,109,0.14)",
      accentText: "#04170f",
      bubbleOwn: "linear-gradient(135deg,#1e6248,#348866)",
      bubbleOwnText: "#f8eec9",
      bubbleOwnBorder: "1px solid rgba(215,181,109,.38)",
      bubbleOther: "rgba(8,45,33,.82)",
      bubbleOtherText: "#f6eccd",
      bubbleOtherBorder: "1px solid rgba(215,181,109,.38)",
      bubbleOwnRadius: "20px 6px 20px 20px",
      bubbleOtherRadius: "6px 20px 20px 20px",
      textPrimary: "#f8f0d9",
      textSecondary: "#d0c8a8",
      textMuted: "#a8b79d",
      border: "rgba(215,181,109,.38)",
      inputBg: "rgba(8,45,33,.6)",
      shadow: "rgba(215,181,109,.24)",
      glow: "#d7b56d",
    },
    previewBg: "linear-gradient(155deg,#04170f,#0a2b20)",
  },
  {
    id: "eidi",
    name: "Eidi",
    urdu: "عیدی",
    emoji: "🎁",
    tagline: "Eid morning — blush tissue paper, champagne gold ribbon",
    tag: "FESTIVE",
    dark: false,
    fontFamily: "\"Fraunces\", \"Iowan Old Style\", Georgia, serif",
    palette: {
      bg: "#f9e6df",
      bgGradient: "linear-gradient(155deg,#f9e6df,#f4d7d6 48%,#eed0c0)",
      surface: "#ffffff",
      surfaceGlass: "rgba(255,255,255,0.75)",
      sidebar: "#f7e0d8",
      header: "rgba(249,230,223,0.85)",
      accent: "#c99a4b",
      accentHover: "#b08540",
      accentSoft: "rgba(201,154,75,0.12)",
      accentText: "#ffffff",
      bubbleOwn: "linear-gradient(135deg,#e6be79,#f7e4b5)",
      bubbleOwnText: "#4c2b21",
      bubbleOther: "rgba(255,255,255,.8)",
      bubbleOtherText: "#6b3646",
      bubbleOwnRadius: "20px 20px 6px 20px",
      bubbleOtherRadius: "20px 20px 20px 6px",
      textPrimary: "#59303d",
      textSecondary: "#7a5060",
      textMuted: "#987080",
      border: "rgba(201,154,75,.35)",
      inputBg: "rgba(255,255,255,.8)",
      shadow: "rgba(233,169,185,.45)",
      glow: "#e9a9b9",
    },
    previewBg: "linear-gradient(155deg,#f9e6df,#f4d7d6)",
  },
  {
    id: "angithi",
    name: "Angithi",
    urdu: "انگیٹھی",
    emoji: "🔥",
    tagline: "The winter fire — bonfire glow, cozy Sehri nights with chai",
    tag: "COZY",
    dark: true,
    fontFamily: "\"Fraunces\", \"Iowan Old Style\", Georgia, serif",
    palette: {
      bg: "#170f09",
      bgGradient: "linear-gradient(160deg,#170f09,#2a1710 55%,#130c07)",
      surface: "#241610",
      surfaceGlass: "rgba(36,22,16,0.8)",
      sidebar: "#1c120b",
      header: "rgba(23,15,9,0.85)",
      accent: "#f0b45f",
      accentHover: "#dd9f4a",
      accentSoft: "rgba(240,180,95,0.14)",
      accentText: "#2c1608",
      bubbleOwn: "linear-gradient(135deg,#e5a44a,#c56a2b)",
      bubbleOwnText: "#2c1608",
      bubbleOwnRadius: "18px 18px 5px 18px",
      bubbleOther: "rgba(58,32,17,.84)",
      bubbleOtherText: "#ffe9cd",
      bubbleOtherRadius: "18px 18px 18px 5px",
      textPrimary: "#fff1de",
      textSecondary: "#d8b898",
      textMuted: "#bda285",
      border: "rgba(240,180,95,.3)",
      inputBg: "rgba(58,32,17,.6)",
      shadow: "rgba(230,140,60,.32)",
      glow: "#f0b45f",
    },
    previewBg: "linear-gradient(160deg,#170f09,#2a1710)",
  },
  {
    id: "aatish",
    name: "Aatish",
    urdu: "آتش",
    emoji: "🌋",
    tagline: "The volcano heart — molten lava, obsidian, raw power",
    tag: "INTENSE",
    dark: true,
    fontFamily: "\"Space Grotesk\", ui-monospace, monospace",
    palette: {
      bg: "#140605",
      bgGradient: "linear-gradient(160deg,#140605,#1f0a06 52%,#0d0403)",
      surface: "#200a07",
      surfaceGlass: "rgba(32,10,7,0.8)",
      sidebar: "#180806",
      header: "rgba(20,6,5,0.85)",
      accent: "#ff7a2f",
      accentHover: "#e56a24",
      accentSoft: "rgba(255,122,47,0.14)",
      accentText: "#2a0c04",
      bubbleOwn: "linear-gradient(135deg,#ff8a3d,#e13a12)",
      bubbleOwnText: "#2a0c04",
      bubbleOwnRadius: "14px 2px 14px 2px",
      bubbleOther: "rgba(42,14,10,.84)",
      bubbleOtherText: "#ffddc9",
      bubbleOtherRadius: "2px 14px 2px 14px",
      textPrimary: "#ffe9dc",
      textSecondary: "#d8a88e",
      textMuted: "#ab7f6c",
      border: "rgba(255,122,47,.34)",
      inputBg: "rgba(42,14,10,.6)",
      shadow: "rgba(255,90,20,.36)",
      glow: "#ff7a2f",
    },
    previewBg: "linear-gradient(160deg,#140605,#1f0a06)",
  },
  {
    id: "ultra",
    name: "ULTRA",
    urdu: "الٹرا",
    emoji: "⚡",
    tagline: "The ultraviolent rave — strobe lights, lasers, warehouse party",
    tag: "RAVE",
    dark: true,
    fontFamily: "\"Space Grotesk\", ui-monospace, monospace",
    palette: {
      bg: "#080211",
      bgGradient: "linear-gradient(160deg,#080211,#150428 55%,#05020d)",
      surface: "#150828",
      surfaceGlass: "rgba(21,8,40,0.8)",
      sidebar: "#0d0418",
      header: "rgba(8,2,17,0.85)",
      accent: "#a855f7",
      accentHover: "#9333ea",
      accentSoft: "rgba(168,85,247,0.14)",
      accentText: "#ffffff",
      bubbleOwn: "linear-gradient(135deg,#7b2ff7,#ff2ea6)",
      bubbleOwnText: "#fff4ff",
      bubbleOwnRadius: "14px 2px 14px 2px",
      bubbleOther: "rgba(30,10,50,.82)",
      bubbleOtherText: "#ecddff",
      bubbleOtherRadius: "2px 14px 2px 14px",
      textPrimary: "#f6ecff",
      textSecondary: "#c8a8e8",
      textMuted: "#9b87b8",
      border: "rgba(168,85,247,.45)",
      inputBg: "rgba(30,10,50,.6)",
      shadow: "rgba(168,85,247,.4)",
      glow: "#a855f7",
    },
    previewBg: "linear-gradient(160deg,#080211,#150428)",
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

/** Theme ko CSS variables + data-theme ke zariye <html> par apply karo */
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
    s.setProperty("--th-bubble-own-border", p.bubbleOwnBorder || "none");
    s.setProperty("--th-bubble-other-border", p.bubbleOtherBorder || "1px solid rgba(0,0,0,0.07)");
    s.setProperty("--th-bubble-own-shadow", p.bubbleOwnShadow || "0 1px 2px rgba(0,0,0,0.08)");
    s.setProperty("--th-bubble-other-shadow", p.bubbleOtherShadow || "0 1px 2px rgba(0,0,0,0.08)");
    s.setProperty("--th-bubble-own-radius", p.bubbleOwnRadius || "16px 6px 16px 16px");
    s.setProperty("--th-bubble-other-radius", p.bubbleOtherRadius || "6px 16px 16px 16px");
    s.setProperty("--th-text", p.textPrimary);
    s.setProperty("--th-text-soft", p.textSecondary);
    s.setProperty("--th-text-mute", p.textMuted);
    s.setProperty("--th-border", p.border);
    s.setProperty("--th-input-bg", p.inputBg);
    s.setProperty("--th-shadow", p.shadow);
    s.setProperty("--th-glow", p.glow || p.accent);
    s.setProperty("--th-font", theme.fontFamily || "inherit");
    s.setProperty("--th-bubble-font-style", theme.bubbleFontStyle || "normal");
  } catch { /* ignore */ }
}
