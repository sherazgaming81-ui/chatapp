"use client";
// ─── ChatsApp Wallpaper System ───
// WhatsApp-style chat backgrounds: colors, gradients, patterns, doodles,
// Islamic art, nature, textures, animated, seasonal — sab kuch!
// Per-chat wallpaper + global default. Blur, opacity, tint controls.

import { useSyncExternalStore } from "react";

const LS = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

/* ═══════════════ Types ═══════════════ */
export type WallpaperKind =
  | "color" | "gradient" | "pattern" | "doodle"
  | "islamic" | "nature" | "texture" | "animated"
  | "seasonal" | "minimal" | "custom";

export interface WallpaperDef {
  id: string;
  name: string;
  kind: WallpaperKind;
  /** CSS background value (color / gradient / url) */
  bg: string;
  /** background-size for patterns */
  bgSize?: string;
  /** base color behind pattern/svg (for preview tiles) */
  base?: string;
  /** animated keyframe name (for kind=animated) */
  anim?: string;
}

export interface WallpaperSettings {
  blur: number;      // 0–20
  opacity: number;   // 10–100
  tint: string;      // hex or "" = none
  tintOpacity: number; // 0–60
}

/* ═══════════════ SVG helpers ═══════════════ */
const svgUrl = (svg: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

const tile = (inner: string, size = 48, bg = "#ffffff") =>
  svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${bg}"/>${inner}</svg>`);

/* ═══════════════ 1. SOLID COLORS (24) ═══════════════ */
const COLORS: [string, string, string][] = [
  ["c-white", "Saaf Safed", "#ffffff"],
  ["c-cream", "Cream", "#fdf6ec"],
  ["c-sand", "Ret", "#f5e6c8"],
  ["c-peach", "Aadu", "#ffe5cc"],
  ["c-blush", "Blush", "#ffd6e0"],
  ["c-rose", "Gulab", "#ffc2d1"],
  ["c-pink", "Gulabi", "#f9a8d4"],
  ["c-lavender", "Lavender", "#e9d5ff"],
  ["c-lilac", "Lilac", "#ddd6fe"],
  ["c-sky", "Aasman", "#bae6fd"],
  ["c-ice", "Barf", "#e0f2fe"],
  ["c-mint", "Podina", "#a7f3d0"],
  ["c-sage", "Sage", "#d1fae5"],
  ["c-lime", "Neemboo", "#d9f99d"],
  ["c-lemon", "Lemon", "#fef9c3"],
  ["c-honey", "Shehed", "#fde68a"],
  ["c-apricot", "Khubani", "#fed7aa"],
  ["c-coral", "Moonga", "#fecaca"],
  ["c-periwinkle", "Neel", "#c7d2fe"],
  ["c-powder", "Powder", "#dbeafe"],
  ["c-seafoam", "Jhaag", "#ccfbf1"],
  ["c-pistachio", "Pista", "#ecfccb"],
  ["c-vanilla", "Vanilla", "#fef3c7"],
  ["c-mist", "Dhund", "#f1f5f9"],
];
const colorWalls: WallpaperDef[] = COLORS.map(([id, name, hex]) => ({
  id, name, kind: "color", bg: hex, base: hex,
}));

/* ═══════════════ 2. GRADIENTS (18) ═══════════════ */
const GRADIENTS: [string, string, string][] = [
  ["g-blurple", "Blurple Haze", "linear-gradient(135deg,#e0e7ff 0%,#c7d2fe 50%,#ddd6fe 100%)"],
  ["g-sunset", "Sunset", "linear-gradient(160deg,#ffedd5 0%,#fecaca 55%,#ddd6fe 100%)"],
  ["g-ocean", "Samandar", "linear-gradient(135deg,#e0f2fe 0%,#bae6fd 50%,#a5f3fc 100%)"],
  ["g-mint", "Tazgi", "linear-gradient(135deg,#d1fae5 0%,#a7f3d0 50%,#99f6e4 100%)"],
  ["g-peach", "Narm", "linear-gradient(135deg,#ffedd5 0%,#fed7aa 50%,#fecdd3 100%)"],
  ["g-rose", "Gulab", "linear-gradient(135deg,#ffe4e6 0%,#fecdd3 50%,#f9a8d4 100%)"],
  ["g-lavender", "Khushboo", "linear-gradient(135deg,#f5f3ff 0%,#ede9fe 50%,#ddd6fe 100%)"],
  ["g-sky", "Neela Aasman", "linear-gradient(180deg,#f0f9ff 0%,#e0f2fe 60%,#bae6fd 100%)"],
  ["g-meadow", "Hariyali", "linear-gradient(135deg,#ecfdf5 0%,#d1fae5 50%,#fef9c3 100%)"],
  ["g-honey", "Meetha", "linear-gradient(135deg,#fffbeb 0%,#fef3c7 50%,#fde68a 100%)"],
  ["g-cotton", "Rui", "linear-gradient(135deg,#fdf4ff 0%,#fae8ff 50%,#f5d0fe 100%)"],
  ["g-glacier", "Glacier", "linear-gradient(135deg,#f0fdfa 0%,#ccfbf1 50%,#e0f2fe 100%)"],
  ["g-dawn", "Fajr", "linear-gradient(180deg,#fff7ed 0%,#ffedd5 40%,#fde68a 100%)"],
  ["g-dusk", "Maghrib", "linear-gradient(180deg,#ede9fe 0%,#fce7f3 50%,#ffedd5 100%)"],
  ["g-spring", "Bahar", "linear-gradient(135deg,#f0fdf4 0%,#dcfce7 40%,#fef9c3 100%)"],
  ["g-pearl", "Moti", "linear-gradient(135deg,#ffffff 0%,#f8fafc 50%,#f1f5f9 100%)"],
  ["g-aurora", "Aurora", "linear-gradient(135deg,#ecfdf5 0%,#e0f2fe 35%,#ede9fe 70%,#fce7f3 100%)"],
  ["g-sorbet", "Sorbet", "linear-gradient(135deg,#fff7ed 0%,#fce7f3 50%,#e0f2fe 100%)"],
];
const gradientWalls: WallpaperDef[] = GRADIENTS.map(([id, name, bg]) => ({
  id, name, kind: "gradient", bg,
}));

/* ═══════════════ 3. DOODLE (WhatsApp classic style) ═══════════════ */
const doodleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220">
<rect width="220" height="220" fill="#f0ead9"/>
<g fill="none" stroke="#d8cfae" stroke-width="2" opacity="0.9">
<circle cx="30" cy="40" r="10"/><circle cx="190" cy="180" r="12"/>
<path d="M60 120 q10 -14 20 0 q10 14 20 0"/><path d="M140 60 q8 -12 16 0"/>
<rect x="150" y="30" width="18" height="18" rx="4" transform="rotate(15 159 39)"/>
<path d="M40 170 l14 -14 M54 170 l-14 -14"/>
<path d="M100 190 c6 -10 16 -10 22 0"/>
<circle cx="110" cy="100" r="4" fill="#d8cfae" stroke="none"/>
<path d="M170 120 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0"/>
<path d="M20 90 h24 M32 78 v24"/>
<path d="M90 30 c8 0 8 12 16 12"/>
</g></svg>`;
const doodleWall: WallpaperDef = {
  id: "doodle", name: "Doodle 🎨", kind: "doodle",
  bg: svgUrl(doodleSvg), bgSize: "220px 220px", base: "#f0ead9",
};

/* ═══════════════ 4. ISLAMIC GEOMETRIC (8-point star) ═══════════════ */
function islamicSvg(color: string, bg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
<rect width="96" height="96" fill="${bg}"/>
<g fill="none" stroke="${color}" stroke-width="1.6" opacity="0.85">
<path d="M48 8 L56 32 L80 32 L60 46 L68 70 L48 56 L28 70 L36 46 L16 32 L40 32 Z"/>
<circle cx="48" cy="48" r="30"/>
<path d="M48 18 v60 M18 48 h60"/>
<path d="M27 27 l42 42 M69 27 l-42 42"/>
</g></svg>`;
}
const islamicWalls: WallpaperDef[] = [
  { id: "isl-gold", name: "Sunehra", kind: "islamic", bg: svgUrl(islamicSvg("#c9a227", "#fdf8ec")), bgSize: "96px 96px", base: "#fdf8ec" },
  { id: "isl-emerald", name: "Zumurrad", kind: "islamic", bg: svgUrl(islamicSvg("#0e7c5b", "#ecfdf5")), bgSize: "96px 96px", base: "#ecfdf5" },
  { id: "isl-navy", name: "Neelam", kind: "islamic", bg: svgUrl(islamicSvg("#3b5bdb", "#eff6ff")), bgSize: "96px 96px", base: "#eff6ff" },
  { id: "isl-rose", name: "Gulnar", kind: "islamic", bg: svgUrl(islamicSvg("#c2437a", "#fdf2f8")), bgSize: "96px 96px", base: "#fdf2f8" },
  { id: "isl-teal", name: "Ferozi", kind: "islamic", bg: svgUrl(islamicSvg("#0f766e", "#f0fdfa")), bgSize: "96px 96px", base: "#f0fdfa" },
  { id: "isl-sand", name: "Sehra", kind: "islamic", bg: svgUrl(islamicSvg("#b45309", "#fffbeb")), bgSize: "96px 96px", base: "#fffbeb" },
];

/* ═══════════════ 5. NATURE (Unsplash) ═══════════════ */
const U = (id: string) => `https://images.unsplash.com/${id}?w=900&q=60&auto=format&fit=crop`;
const natureWalls: WallpaperDef[] = [
  { id: "n-mountain", name: "Pahar 🏔️", kind: "nature", bg: `url("${U("photo-1506905925346-21bda4d32df4")}")`, base: "#dbeafe" },
  { id: "n-ocean", name: "Samandar 🌊", kind: "nature", bg: `url("${U("photo-1505118380757-91f5f5632de0")}")`, base: "#bae6fd" },
  { id: "n-forest", name: "Jungle 🌲", kind: "nature", bg: `url("${U("photo-1441974231531-c6227db76b6e")}")`, base: "#bbf7d0" },
  { id: "n-desert", name: "Sehra 🏜️", kind: "nature", bg: `url("${U("photo-1509316785289-025f5b846b35")}")`, base: "#fde68a" },
  { id: "n-lake", name: "Jheel 🏞️", kind: "nature", bg: `url("${U("photo-1439066615861-d1af74d74000")}")`, base: "#e0f2fe" },
  { id: "n-flowers", name: "Phool 🌸", kind: "nature", bg: `url("${U("photo-1490750967868-88aa4486c946")}")`, base: "#fce7f3" },
  { id: "n-sky", name: "Badal ☁️", kind: "nature", bg: `url("${U("photo-1419242902214-272b3f66ee7a")}")`, base: "#e0f2fe" },
  { id: "n-beach", name: "Sahil 🏖️", kind: "nature", bg: `url("${U("photo-1507525428034-b723cf961d3e")}")`, base: "#fef3c7" },
];

/* ═══════════════ 6. DARK TEXTURES (subtle, light-friendly) ═══════════════ */
const textureWalls: WallpaperDef[] = [
  { id: "t-linen", name: "Linen", kind: "texture", bg: tile(`<path d="M0 12 h48 M0 36 h48 M12 0 v48 M36 0 v48" stroke="#e2e8f0" stroke-width="1"/>`, 48, "#f8fafc"), bgSize: "48px 48px", base: "#f8fafc" },
  { id: "t-weave", name: "Weave", kind: "texture", bg: tile(`<path d="M0 0 l48 48 M48 0 l-48 48" stroke="#e8edf3" stroke-width="1.4"/>`, 48, "#fbfcfe"), bgSize: "48px 48px", base: "#fbfcfe" },
  { id: "t-noise", name: "Noise", kind: "texture", bg: tile(`<circle cx="8" cy="10" r="1" fill="#e2e8f0"/><circle cx="30" cy="26" r="1.2" fill="#e8edf3"/><circle cx="40" cy="8" r="0.8" fill="#e2e8f0"/><circle cx="18" cy="38" r="1" fill="#edf1f6"/>`, 48, "#f8fafc"), bgSize: "48px 48px", base: "#f8fafc" },
  { id: "t-carbon", name: "Carbon", kind: "texture", bg: tile(`<rect x="6" y="6" width="14" height="14" rx="3" fill="#eef1f5"/><rect x="28" y="28" width="14" height="14" rx="3" fill="#e9edf2"/>`, 48, "#f7f9fb"), bgSize: "48px 48px", base: "#f7f9fb" },
  { id: "t-sand", name: "Sandgrain", kind: "texture", bg: tile(`<path d="M4 40 q12 -18 22 -8 t22 -10" stroke="#e7e2d4" stroke-width="1.6" fill="none"/><path d="M0 20 q14 -10 26 -4" stroke="#ece7d8" stroke-width="1.2" fill="none"/>`, 48, "#faf8f1"), bgSize: "48px 48px", base: "#faf8f1" },
  { id: "t-paper", name: "Paper", kind: "texture", bg: tile(`<path d="M0 0 h48" stroke="#eef0f3" stroke-width="8"/><path d="M0 24 h48" stroke="#f4f6f8" stroke-width="6"/>`, 48, "#fbfcfd"), bgSize: "48px 48px", base: "#fbfcfd" },
];

/* ═══════════════ 7. ANIMATED (CSS keyframes) ═══════════════ */
export const ANIM_CSS = `
@keyframes wp-aurora { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes wp-float { 0%,100%{background-position:0 0} 50%{background-position:40px 40px} }
@keyframes wp-shimmer { 0%{filter:hue-rotate(0deg)} 100%{filter:hue-rotate(30deg)} }
.wp-anim { animation: wp-aurora 14s ease infinite; background-size: 220% 220% !important; }
.wp-anim-slow { animation: wp-aurora 26s ease infinite; background-size: 220% 220% !important; }
.wp-anim-float { animation: wp-float 18s ease-in-out infinite; }
`;
const animatedWalls: WallpaperDef[] = [
  { id: "a-aurora", name: "Aurora ✨", kind: "animated", bg: "linear-gradient(120deg,#e0f2fe,#ede9fe,#fce7f3,#fef9c3,#e0f2fe)", anim: "wp-anim" },
  { id: "a-sunrise", name: "Tulu ✨", kind: "animated", bg: "linear-gradient(120deg,#fff7ed,#fed7aa,#fecdd3,#ddd6fe,#fff7ed)", anim: "wp-anim" },
  { id: "a-meadow", name: "Chaman ✨", kind: "animated", bg: "linear-gradient(120deg,#ecfdf5,#d1fae5,#e0f2fe,#fef9c3,#ecfdf5)", anim: "wp-anim-slow" },
  { id: "a-candy", name: "Mithas ✨", kind: "animated", bg: "linear-gradient(120deg,#fdf4ff,#fae8ff,#fce7f3,#e0f2fe,#fdf4ff)", anim: "wp-anim" },
  { id: "a-tide", name: "Leher ✨", kind: "animated", bg: "linear-gradient(120deg,#f0fdfa,#ccfbf1,#e0f2fe,#ede9fe,#f0fdfa)", anim: "wp-anim-slow" },
];

/* ═══════════════ 8. SEASONAL (Eid / Ramadan) ═══════════════ */
function crescentSvg(bg: string, fg: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
<rect width="140" height="140" fill="${bg}"/>
<g opacity="0.9">
<path d="M88 34 a34 34 0 1 0 18 62 a27 27 0 1 1 -18 -62" fill="${fg}"/>
<path d="M102 44 l3.5 7 7 3.5 -7 3.5 -3.5 7 -3.5 -7 -7 -3.5 7 -3.5 Z" fill="${accent}"/>
<circle cx="34" cy="104" r="2.4" fill="${accent}"/><circle cx="112" cy="108" r="2" fill="${accent}"/>
<path d="M28 40 l2.4 4.8 4.8 2.4 -4.8 2.4 -2.4 4.8 -2.4 -4.8 -4.8 -2.4 4.8 -2.4 Z" fill="${accent}" opacity="0.8"/>
</g></svg>`;
}
function lanternSvg(bg: string, fg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
<rect width="120" height="120" fill="${bg}"/>
<g opacity="0.9" stroke="${fg}" stroke-width="2" fill="none">
<path d="M60 18 v10"/><rect x="48" y="28" width="24" height="8" rx="3" fill="${fg}" stroke="none"/>
<path d="M48 36 c0 22 6 34 12 44 c6 -10 12 -22 12 -44"/>
<path d="M48 36 h24 M50 52 h20 M54 66 h12"/>
<circle cx="60" cy="88" r="3" fill="${fg}" stroke="none"/>
<path d="M30 96 q30 10 60 0" opacity="0.5"/>
</g></svg>`;
}
const seasonalWalls: WallpaperDef[] = [
  { id: "s-eidgold", name: "Eid Mubarak 🌙", kind: "seasonal", bg: svgUrl(crescentSvg("#1e3a5f", "#f5d67b", "#fbbf24")), bgSize: "140px 140px", base: "#1e3a5f" },
  { id: "s-eidgreen", name: "Eid Green 🕌", kind: "seasonal", bg: svgUrl(crescentSvg("#0b3d2e", "#d4edda", "#f5d67b")), bgSize: "140px 140px", base: "#0b3d2e" },
  { id: "s-ramadan", name: "Ramadan 🌙", kind: "seasonal", bg: svgUrl(lanternSvg("#172554", "#c7d2fe")), bgSize: "120px 120px", base: "#172554" },
  { id: "s-ramadan-teal", name: "Ramadan Teal", kind: "seasonal", bg: svgUrl(lanternSvg("#0f3b3a", "#99f6e4")), bgSize: "120px 120px", base: "#0f3b3a" },
  { id: "s-chand", name: "Chand Raat ✨", kind: "seasonal", bg: svgUrl(crescentSvg("#2b2d42", "#edf2f4", "#ffd166")), bgSize: "140px 140px", base: "#2b2d42" },
];

/* ═══════════════ 9. MINIMAL ═══════════════ */
const minimalWalls: WallpaperDef[] = [
  { id: "m-white", name: "Khaalis", kind: "minimal", bg: "#ffffff", base: "#ffffff" },
  { id: "m-ghost", name: "Ghost", kind: "minimal", bg: "#fafbfc", base: "#fafbfc" },
  { id: "m-fog", name: "Kohra", kind: "minimal", bg: "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)" },
  { id: "m-line", name: "Lakeer", kind: "minimal", bg: tile(`<path d="M0 24 h48" stroke="#eef1f4" stroke-width="1"/>`, 48, "#ffffff"), bgSize: "48px 48px", base: "#ffffff" },
  { id: "m-soft", name: "Naram", kind: "minimal", bg: "radial-gradient(ellipse at 50% 0%,#f8fafc 0%,#ffffff 70%)" },
];

/* ═══════════════ 10. PATTERN LIBRARY (52 SVG patterns) ═══════════════ */
interface PatGen { id: string; name: string; make: (c: string) => string; }
const PATTERNS: PatGen[] = [
  { id: "p-dots", name: "Nukte", make: (c) => `<circle cx="12" cy="12" r="3" fill="${c}"/><circle cx="36" cy="36" r="3" fill="${c}"/>` },
  { id: "p-dots-sm", name: "Chote Nukte", make: (c) => `<circle cx="8" cy="8" r="1.6" fill="${c}"/><circle cx="24" cy="24" r="1.6" fill="${c}"/><circle cx="40" cy="8" r="1.6" fill="${c}"/><circle cx="8" cy="40" r="1.6" fill="${c}"/><circle cx="40" cy="40" r="1.6" fill="${c}"/>` },
  { id: "p-rings", name: "Halqe", make: (c) => `<circle cx="24" cy="24" r="10" fill="none" stroke="${c}" stroke-width="2"/>` },
  { id: "p-grid", name: "Jaal", make: (c) => `<path d="M0 16 h48 M0 32 h48 M16 0 v48 M32 0 v48" stroke="${c}" stroke-width="1.2"/>` },
  { id: "p-diagonal", name: "Terchi", make: (c) => `<path d="M-12 12 l24 -24 M0 48 l48 -48 M36 60 l24 -24" stroke="${c}" stroke-width="1.4"/>` },
  { id: "p-cross", name: "Plus", make: (c) => `<path d="M24 14 v20 M14 24 h20" stroke="${c}" stroke-width="2" stroke-linecap="round"/>` },
  { id: "p-x", name: "Kate", make: (c) => `<path d="M16 16 l16 16 M32 16 l-16 16" stroke="${c}" stroke-width="2" stroke-linecap="round"/>` },
  { id: "p-zigzag", name: "Lehriya", make: (c) => `<path d="M0 32 l12 -16 12 16 12 -16 12 16" fill="none" stroke="${c}" stroke-width="2"/>` },
  { id: "p-wave", name: "Leher", make: (c) => `<path d="M0 24 q12 -14 24 0 t24 0" fill="none" stroke="${c}" stroke-width="2"/>` },
  { id: "p-scallop", name: "Kangura", make: (c) => `<path d="M0 16 a12 12 0 0 1 24 0 a12 12 0 0 1 24 0" fill="none" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-triangle", name: "Tikona", make: (c) => `<path d="M24 10 l14 24 h-28 Z" fill="none" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-square", name: "Chaukor", make: (c) => `<rect x="14" y="14" width="20" height="20" rx="3" fill="none" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-diamond", name: "Heera", make: (c) => `<path d="M24 8 l16 16 -16 16 -16 -16 Z" fill="none" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-hex", name: "Chhakona", make: (c) => `<path d="M24 8 l14 8 v16 l-14 8 -14 -8 v-16 Z" fill="none" stroke="${c}" stroke-width="1.6"/>` },
  { id: "p-star", name: "Sitara", make: (c) => `<path d="M24 10 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1 Z" fill="none" stroke="${c}" stroke-width="1.6"/>` },
  { id: "p-heart", name: "Dil", make: (c) => `<path d="M24 36 c-10 -8 -16 -14 -16 -22 a9 9 0 0 1 16 -6 a9 9 0 0 1 16 6 c0 8 -6 14 -16 22" fill="none" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-moon", name: "Chand", make: (c) => `<path d="M32 10 a18 18 0 1 0 8 34 a14 14 0 1 1 -8 -34" fill="none" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-sun", name: "Suraj", make: (c) => `<circle cx="24" cy="24" r="8" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M24 8 v6 M24 34 v6 M8 24 h6 M34 24 h6" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>` },
  { id: "p-cloud", name: "Badal", make: (c) => `<path d="M14 32 a8 8 0 0 1 2 -16 a10 10 0 0 1 19 -3 a8 8 0 0 1 -1 19 Z" fill="none" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-drop", name: "Qatra", make: (c) => `<path d="M24 8 c8 12 12 18 12 26 a12 12 0 0 1 -24 0 c0 -8 4 -14 12 -26" fill="none" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-leaf", name: "Patta", make: (c) => `<path d="M24 8 c10 8 12 20 4 32 c-12 -2 -16 -16 -4 -32" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M24 14 v22" stroke="${c}" stroke-width="1.4"/>` },
  { id: "p-flower", name: "Phool", make: (c) => `<g fill="none" stroke="${c}" stroke-width="1.6"><circle cx="24" cy="14" r="5"/><circle cx="34" cy="24" r="5"/><circle cx="24" cy="34" r="5"/><circle cx="14" cy="24" r="5"/><circle cx="24" cy="24" r="3"/></g>` },
  { id: "p-sparkle", name: "Chamak", make: (c) => `<path d="M24 8 l3 12 12 3 -12 3 -3 12 -3 -12 -12 -3 12 -3 Z" fill="none" stroke="${c}" stroke-width="1.6"/>` },
  { id: "p-bubble", name: "Bulbula", make: (c) => `<circle cx="16" cy="18" r="7" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="34" cy="32" r="4.5" fill="none" stroke="${c}" stroke-width="1.4"/>` },
  { id: "p-confetti", name: "Confetti", make: (c) => `<rect x="10" y="12" width="8" height="4" rx="1" fill="${c}" transform="rotate(24 14 14)"/><circle cx="34" cy="30" r="3" fill="${c}"/><rect x="30" y="8" width="4" height="8" rx="1" fill="${c}" transform="rotate(-18 32 12)"/>` },
  { id: "p-arrow", name: "Teer", make: (c) => `<path d="M10 24 h24 M28 16 l10 8 -10 8" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round"/>` },
  { id: "p-check", name: "Sahi", make: (c) => `<path d="M14 25 l8 8 14 -16" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>` },
  { id: "p-infinity", name: "Infinity", make: (c) => `<path d="M14 24 c0 -7 8 -7 10 0 c2 7 10 7 10 0 c0 -7 -8 -7 -10 0 c-2 7 -10 7 -10 0" fill="none" stroke="${c}" stroke-width="2"/>` },
  { id: "p-spiral", name: "Bhanwar", make: (c) => `<path d="M24 24 m0 -2 a2 2 0 0 1 2 2 a5 5 0 0 1 -5 5 a9 9 0 0 1 -9 -9 a13 13 0 0 1 13 -13" fill="none" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-quatre", name: "Chauphal", make: (c) => `<path d="M24 8 c3 8 8 13 16 16 c-8 3 -13 8 -16 16 c-3 -8 -8 -13 -16 -16 c8 -3 13 -8 16 -16" fill="none" stroke="${c}" stroke-width="1.6"/>` },
  { id: "p-paisley", name: "Kairi", make: (c) => `<path d="M30 8 c8 10 6 24 -8 32 c-4 -12 0 -24 8 -32" fill="none" stroke="${c}" stroke-width="1.8"/><circle cx="26" cy="18" r="2.4" fill="${c}"/>` },
  { id: "p-arch", name: "Mehrab", make: (c) => `<path d="M12 40 v-12 a12 12 0 0 1 24 0 v12" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M12 40 h24" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-dome", name: "Gumbad", make: (c) => `<path d="M10 34 a14 14 0 0 1 28 0" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M24 8 v6 M10 34 h28" stroke="${c}" stroke-width="1.6"/>` },
  { id: "p-minaret", name: "Minar", make: (c) => `<path d="M20 40 v-24 M28 40 v-24 M20 22 h8 M18 16 h12" stroke="${c}" stroke-width="1.8"/><path d="M24 8 l6 8 h-12 Z" fill="none" stroke="${c}" stroke-width="1.6"/>` },
  { id: "p-tasbih", name: "Tasbih", make: (c) => `<circle cx="14" cy="14" r="3.4" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="34" cy="14" r="3.4" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="14" cy="34" r="3.4" fill="none" stroke="${c}" stroke-width="1.6"/><circle cx="34" cy="34" r="3.4" fill="none" stroke="${c}" stroke-width="1.6"/>` },
  { id: "p-geo1", name: "Jali 1", make: (c) => `<path d="M0 24 h48 M24 0 v48" stroke="${c}" stroke-width="1"/><circle cx="24" cy="24" r="12" fill="none" stroke="${c}" stroke-width="1.2"/>` },
  { id: "p-geo2", name: "Jali 2", make: (c) => `<rect x="8" y="8" width="32" height="32" fill="none" stroke="${c}" stroke-width="1.2" transform="rotate(45 24 24)"/><rect x="14" y="14" width="20" height="20" fill="none" stroke="${c}" stroke-width="1"/>` },
  { id: "p-fishscale", name: "Machli", make: (c) => `<path d="M0 12 a12 12 0 0 1 24 0 a12 12 0 0 1 24 0 M0 36 a12 12 0 0 1 24 0 a12 12 0 0 1 24 0" fill="none" stroke="${c}" stroke-width="1.6"/>` },
  { id: "p-honey", name: "Shehed", make: (c) => `<path d="M24 6 l10 6 v12 l-10 6 -10 -6 v-12 Z" fill="none" stroke="${c}" stroke-width="1.5"/>` },
  { id: "p-brick", name: "Eent", make: (c) => `<path d="M0 12 h48 M0 36 h48 M24 12 v12 M12 24 v12 M36 24 v12" stroke="${c}" stroke-width="1.2"/>` },
  { id: "p-chevron", name: "Chevron", make: (c) => `<path d="M8 18 l16 12 16 -12 M8 32 l16 12 16 -12" fill="none" stroke="${c}" stroke-width="2"/>` },
  { id: "p-circles", name: "Daire", make: (c) => `<circle cx="24" cy="24" r="16" fill="none" stroke="${c}" stroke-width="1.4"/><circle cx="24" cy="24" r="7" fill="${c}" opacity="0.55"/>` },
  { id: "p-halfmoon", name: "Adha Chand", make: (c) => `<path d="M30 8 a17 17 0 1 0 6 32 a13 13 0 1 1 -6 -32" fill="${c}" opacity="0.7"/>` },
  { id: "p-smile", name: "Muskurahat", make: (c) => `<circle cx="24" cy="24" r="14" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M15 28 q9 8 18 0" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/><circle cx="18" cy="20" r="1.6" fill="${c}"/><circle cx="30" cy="20" r="1.6" fill="${c}"/>` },
  { id: "p-music", name: "Naghma", make: (c) => `<path d="M20 34 v-18 l14 -4 v18" fill="none" stroke="${c}" stroke-width="1.8"/><circle cx="16" cy="34" r="4" fill="none" stroke="${c}" stroke-width="1.8"/><circle cx="30" cy="30" r="4" fill="none" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-book", name: "Kitab", make: (c) => `<path d="M14 10 h12 a6 6 0 0 1 6 6 v22 h-12 a6 6 0 0 0 -6 6 Z" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M14 10 v28" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-pen", name: "Qalam", make: (c) => `<path d="M30 8 l10 10 -18 18 -8 2 2 -8 Z" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M26 12 l10 10" stroke="${c}" stroke-width="1.4"/>` },
  { id: "p-envelope", name: "Khat", make: (c) => `<rect x="10" y="14" width="28" height="20" rx="3" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M10 16 l14 10 14 -10" fill="none" stroke="${c}" stroke-width="1.8"/>` },
  { id: "p-gift", name: "Tohfa", make: (c) => `<rect x="12" y="18" width="24" height="20" rx="2" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M24 18 v20 M12 26 h24" stroke="${c}" stroke-width="1.6"/><path d="M24 18 c-6 0 -8 -6 -4 -8 c3 -2 4 4 4 8 c0 -4 1 -10 4 -8 c4 2 2 8 -4 8" fill="none" stroke="${c}" stroke-width="1.6"/>` },
  { id: "p-balloon", name: "Gubbara", make: (c) => `<ellipse cx="24" cy="18" rx="10" ry="12" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M24 30 v10 M20 40 h8" stroke="${c}" stroke-width="1.6"/>` },
  { id: "p-umbrella", name: "Chhata", make: (c) => `<path d="M8 26 a16 12 0 0 1 32 0" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M24 14 v18 a4 4 0 0 0 8 0" fill="none" stroke="${c}" stroke-width="1.8"/>` },
];
const patternWalls: WallpaperDef[] = PATTERNS.map((p) => {
  const stroke = "#c3cbdd";
  return {
    id: p.id, name: p.name, kind: "pattern",
    bg: tile(p.make(stroke), 48, "#fbfcfe"),
    bgSize: "48px 48px", base: "#fbfcfe",
  };
});

/* ═══════════════ ALL + categories ═══════════════ */
export const WALLPAPER_CATS = [
  { id: "color", label: "Rang 🎨" },
  { id: "gradient", label: "Gradient 🌈" },
  { id: "pattern", label: "Patterns ✨" },
  { id: "doodle", label: "Doodle 🖍️" },
  { id: "islamic", label: "Islamic 🕌" },
  { id: "nature", label: "Nature 🏔️" },
  { id: "texture", label: "Texture 🧵" },
  { id: "animated", label: "Animated ⚡" },
  { id: "seasonal", label: "Seasonal 🌙" },
  { id: "minimal", label: "Minimal 🤍" },
  { id: "custom", label: "Apni 📤" },
] as const;

export const ALL_WALLPAPERS: WallpaperDef[] = [
  ...colorWalls,
  ...gradientWalls,
  ...patternWalls,
  doodleWall,
  ...islamicWalls,
  ...natureWalls,
  ...textureWalls,
  ...animatedWalls,
  ...seasonalWalls,
  ...minimalWalls,
];

export const wallpapersByKind = (kind: WallpaperKind): WallpaperDef[] =>
  ALL_WALLPAPERS.filter((w) => w.kind === kind);

export const getWallpaperDef = (id: string): WallpaperDef | undefined =>
  ALL_WALLPAPERS.find((w) => w.id === id);

export const DEFAULT_WALLPAPER_ID = "m-white";

/* ═══════════════ Storage: per-chat + global ═══════════════ */
const K_GLOBAL = "chatsapp:wallpaper";
const K_CUSTOM = "chatsapp:wallpaper:custom";
const K_BLUR = "chatsapp:wallpaperblur";
const K_OPACITY = "chatsapp:wallpaper:opacity";
const K_TINT = "chatsapp:wallpaper:tint";
const K_TINT_OP = "chatsapp:wallpaper:tintop";
const chatKey = (chatId: string) => `chatsapp:wp:${chatId}`;

const listeners = new Set<() => void>();
let tick = 0;
function emit() { tick++; listeners.forEach((l) => { try { l(); } catch { /* ignore */ } }); }

export function getGlobalWallpaper(): string { return LS.get(K_GLOBAL) || DEFAULT_WALLPAPER_ID; }
export function setGlobalWallpaper(id: string) { LS.set(K_GLOBAL, id); emit(); }

/** Is chat ka wallpaper — pehle per-chat, phir global default */
export function getChatWallpaper(chatId: string | undefined): string {
  if (chatId) {
    const v = LS.get(chatKey(chatId));
    if (v) return v;
  }
  return getGlobalWallpaper();
}
export function setChatWallpaper(chatId: string, id: string) {
  LS.set(chatKey(chatId), id); emit();
}
export function clearChatWallpaper(chatId: string) {
  LS.del(chatKey(chatId)); emit();
}
/** Sab chats ka wallpaper ek sath set karo */
export function setAllWallpaper(id: string) {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("chatsapp:wp:")) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
  setGlobalWallpaper(id);
}
export function resetWallpapers() {
  try {
    const kill: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("chatsapp:wp:") || k === K_GLOBAL)) kill.push(k);
    }
    kill.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
  LS.set(K_BLUR, "0"); LS.set(K_OPACITY, "100"); LS.set(K_TINT, ""); LS.set(K_TINT_OP, "0");
  emit();
}

export function getCustomWallpaper(): string | null { return LS.get(K_CUSTOM); }
export function setCustomWallpaper(dataUrl: string | null) {
  if (dataUrl) LS.set(K_CUSTOM, dataUrl); else LS.del(K_CUSTOM);
  emit();
}

/* ── settings: blur / opacity / tint ── */
export function getSettings(): WallpaperSettings {
  const blur = Math.min(20, Math.max(0, parseInt(LS.get(K_BLUR) || "0", 10) || 0));
  const opacity = Math.min(100, Math.max(10, parseInt(LS.get(K_OPACITY) || "100", 10) || 100));
  const tint = LS.get(K_TINT) || "";
  const tintOpacity = Math.min(60, Math.max(0, parseInt(LS.get(K_TINT_OP) || "0", 10) || 0));
  return { blur, opacity, tint, tintOpacity };
}
export function setSettings(patch: Partial<WallpaperSettings>) {
  const cur = getSettings();
  const next = { ...cur, ...patch };
  LS.set(K_BLUR, String(Math.min(20, Math.max(0, Math.round(next.blur)))));
  LS.set(K_OPACITY, String(Math.min(100, Math.max(10, Math.round(next.opacity)))));
  LS.set(K_TINT, next.tint || "");
  LS.set(K_TINT_OP, String(Math.min(60, Math.max(0, Math.round(next.tintOpacity)))));
  emit();
}

/** Reactive hook — koi bhi wallpaper change ho to rerender */
export function useWallpaperVersion(): number {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => tick,
    () => 0,
  );
}

/** Random wallpaper 🎲 */
export function randomWallpaper(): WallpaperDef {
  const pool = ALL_WALLPAPERS.filter((w) => w.kind !== "custom");
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ═══════════════ Render helpers ═══════════════ */
/** Wallpaper ki base style (bg image/color). Custom ke liye dataURL. */
export function wallpaperBg(id: string): React.CSSProperties {
  if (id === "custom") {
    const custom = getCustomWallpaper();
    if (custom) return { backgroundImage: `url(${custom})`, backgroundSize: "cover", backgroundPosition: "center" };
    return { backgroundColor: "#f1f5f9" };
  }
  const def = getWallpaperDef(id);
  if (!def) return {};
  const style: React.CSSProperties = { backgroundImage: def.bg };
  if (def.kind === "color" || def.kind === "minimal") {
    // solid colors: bg is hex — backgroundImage galat hoga, backgroundColor use karo
    if (def.bg.startsWith("#")) {
      return { backgroundColor: def.bg };
    }
  }
  if (def.bgSize) style.backgroundSize = def.bgSize;
  if (def.kind === "nature" || id === "custom") {
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }
  return style;
}

/** Chat background layer ke liye poori style: wallpaper + opacity + blur */
export function wallpaperLayerStyle(chatId: string | undefined): React.CSSProperties {
  const id = getChatWallpaper(chatId);
  const s = getSettings();
  const base = wallpaperBg(id);
  const style: React.CSSProperties = {
    ...base,
    opacity: s.opacity / 100,
  };
  if (s.blur > 0) {
    style.filter = `blur(${s.blur}px)`;
    style.transform = "scale(1.1)"; // blur edges chhupao
  }
  return style;
}

/** Tint overlay ki style (agar tint set hai) */
export function tintLayerStyle(): React.CSSProperties | null {
  const s = getSettings();
  if (!s.tint || s.tintOpacity <= 0) return null;
  return { backgroundColor: s.tint, opacity: s.tintOpacity / 100 };
}

/** Animated wallpaper ke liye CSS class */
export function wallpaperAnimClass(id: string): string {
  const def = getWallpaperDef(id);
  return def?.anim || "";
}

/** Tile preview ke liye style (picker grid) */
export function wallpaperTileStyle(id: string): React.CSSProperties {
  if (id === "custom") {
    const custom = getCustomWallpaper();
    if (custom) return { backgroundImage: `url(${custom})`, backgroundSize: "cover", backgroundPosition: "center" };
    return { backgroundColor: "#f1f5f9" };
  }
  const def = getWallpaperDef(id);
  if (!def) return {};
  if (def.bg.startsWith("#")) return { backgroundColor: def.bg };
  const style: React.CSSProperties = { backgroundImage: def.bg };
  if (def.bgSize) {
    // tile me pattern chota dikhao
    style.backgroundSize = def.kind === "pattern" ? "24px 24px" : def.kind === "doodle" ? "110px 110px" : def.kind === "islamic" ? "48px 48px" : def.kind === "seasonal" ? "70px 70px" : "cover";
  } else if (def.kind === "nature") {
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }
  if (def.base) style.backgroundColor = def.base;
  return style;
}
