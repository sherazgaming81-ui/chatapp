/**
 * Sticker packs — CSS-only stickers (emoji + styled label, no image files).
 * Rendered by the sticker picker as a colored bubble with a big emoji + label.
 * Other packs: append new *_PACK arrays below and register them in STICKER_PACKS.
 */

export interface Sticker {
  /** unique id, e.g. "madrasa-dars" */
  id: string;
  /** big emoji shown on the sticker */
  emoji: string;
  /** short label text under/over the emoji */
  label: string;
  /** CSS background (solid or gradient) for the sticker bubble */
  bg: string;
  /** label + emoji-adjacent text color */
  fg: string;
  /** owning pack id */
  pack: string;
}

export interface StickerPack {
  id: string;
  name: string;
  icon: string;
  stickers: Sticker[];
}

/* ------------------------------------------------------------------ */
/* Pack 5: Madrasa Life 📚 — fun stickers for madrasa students         */
/* ------------------------------------------------------------------ */

export const MADRASA_PACK: Sticker[] = [
  { id: 'madrasa-dars',      emoji: '📖', label: 'Dars Time!',       bg: 'linear-gradient(135deg,#0ea5e9,#2563eb)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-hifz-done', emoji: '✅', label: 'Hifz Done!',       bg: 'linear-gradient(135deg,#22c55e,#15803d)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-chutti',    emoji: '🎉', label: 'Chutti!',          bg: 'linear-gradient(135deg,#f59e0b,#ea580c)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-ustaad',    emoji: '🧔', label: 'Ustaad Aa Gaye!',  bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-namaz',     emoji: '🕌', label: 'Namaz Time',       bg: 'linear-gradient(135deg,#10b981,#047857)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-taraweeh',  emoji: '🌙', label: 'Taraweeh!',        bg: 'linear-gradient(135deg,#1e1b4b,#4c1d95)', fg: '#fde68a', pack: 'madrasa' },
  { id: 'madrasa-dhikr',     emoji: '📿', label: 'Dhikr Time',       bg: 'linear-gradient(135deg,#14b8a6,#0f766e)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-dua',       emoji: '🤲', label: 'Dua Karo',         bg: 'linear-gradient(135deg,#38bdf8,#0284c7)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-sabaq',     emoji: '📚', label: 'Sabaq Yaad Karo',  bg: 'linear-gradient(135deg,#f43f5e,#be123c)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-mashallah', emoji: '⭐', label: 'Mashallah!',       bg: 'linear-gradient(135deg,#eab308,#a16207)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-hafiz',     emoji: '🏆', label: 'Hafiz Ban Gaya!',  bg: 'linear-gradient(135deg,#fbbf24,#d97706)', fg: '#451a03', pack: 'madrasa' },
  { id: 'madrasa-khana',     emoji: '🍽️', label: 'Khana Time!',      bg: 'linear-gradient(135deg,#fb923c,#c2410c)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-sojao',     emoji: '😴', label: 'So Jao!',          bg: 'linear-gradient(135deg,#6366f1,#4338ca)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-azaan',     emoji: '📢', label: 'Azaan Ho Rahi!',   bg: 'linear-gradient(135deg,#06b6d4,#0369a1)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-dost',      emoji: '🤝', label: 'Dost!',            bg: 'linear-gradient(135deg,#84cc16,#4d7c0f)', fg: '#ffffff', pack: 'madrasa' },
  { id: 'madrasa-himmat',    emoji: '💪', label: 'Himmat Karo!',     bg: 'linear-gradient(135deg,#ef4444,#b91c1c)', fg: '#ffffff', pack: 'madrasa' },
];

export const MADRASA_PACK_META: StickerPack = {
  id: 'madrasa',
  name: 'Madrasa Life',
  icon: '📚',
  stickers: MADRASA_PACK,
};

/** Find a sticker by id across all registered packs */
export function getSticker(id: string): Sticker | undefined {
  for (const p of STICKER_PACKS) {
    const s = p.stickers.find((x) => x.id === id);
    if (s) return s;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Pack 2: Love / Friendship ❤️ — doston ke liye pyaar bhare stickers   */
/* ------------------------------------------------------------------ */

export const LOVE_PACK: Sticker[] = [
  { id: 'love-jaan',       emoji: '❤️', label: 'Jaan!',              bg: 'linear-gradient(135deg,#e0245e,#ff7aa8)', fg: '#ffffff', pack: 'love' },
  { id: 'love-missyou',    emoji: '🥺', label: 'Miss you!',          bg: 'linear-gradient(135deg,#7b2ff7,#b98cff)', fg: '#ffffff', pack: 'love' },
  { id: 'love-bestfriends',emoji: '👯', label: 'Best friends',       bg: 'linear-gradient(135deg,#00b4d8,#90e0ef)', fg: '#083a5e', pack: 'love' },
  { id: 'love-dilse',      emoji: '💖', label: 'Dil se',             bg: 'linear-gradient(135deg,#ff6b9d,#ffa8c5)', fg: '#ffffff', pack: 'love' },
  { id: 'love-loveyou',    emoji: '💕', label: 'Love you!',          bg: 'linear-gradient(135deg,#f43f5e,#fda4af)', fg: '#ffffff', pack: 'love' },
  { id: 'love-yaad',       emoji: '🥹', label: 'Yaad aa rahi hai',   bg: 'linear-gradient(135deg,#a78bfa,#ddd6fe)', fg: '#3b1d6e', pack: 'love' },
  { id: 'love-merijaan',   emoji: '💘', label: 'Meri jaan',          bg: 'linear-gradient(135deg,#be123c,#fb7185)', fg: '#ffffff', pack: 'love' },
  { id: 'love-dosti',      emoji: '🤝', label: 'Dosti zindabad!',    bg: 'linear-gradient(135deg,#0e6b4a,#d4af37)', fg: '#ffffff', pack: 'love' },
  { id: 'love-tumbest',    emoji: '⭐', label: 'Tum best ho!',       bg: 'linear-gradient(135deg,#d4af37,#f5d76e)', fg: '#5c430a', pack: 'love' },
  { id: 'love-hug',        emoji: '🫂', label: 'Hug!',               bg: 'linear-gradient(135deg,#ff8c42,#ffb37e)', fg: '#ffffff', pack: 'love' },
  { id: 'love-salam',      emoji: '💌', label: 'Pyaar bhara salam',  bg: 'linear-gradient(135deg,#ec4899,#f9a8d4)', fg: '#ffffff', pack: 'love' },
  { id: 'love-forever',    emoji: '👫', label: 'Forever friends',    bg: 'linear-gradient(135deg,#4a90d9,#a8d5ff)', fg: '#0f2f5c', pack: 'love' },
  { id: 'love-dilkibaat',  emoji: '💝', label: 'Dil ki baat',        bg: 'linear-gradient(135deg,#c026d3,#f0abfc)', fg: '#ffffff', pack: 'love' },
  { id: 'love-duniya',     emoji: '🌍', label: 'Tum meri duniya ho',bg: 'linear-gradient(135deg,#1a1a40,#e0245e)', fg: '#ffe9a8', pack: 'love' },
  { id: 'love-sweetheart', emoji: '🍬', label: 'Sweetheart',         bg: 'linear-gradient(135deg,#ff9a9e,#fecfef)', fg: '#7a1f3d', pack: 'love' },
  { id: 'love-dost',       emoji: '🌟', label: 'Dost ho tum',        bg: 'linear-gradient(135deg,#f59e0b,#fde68a)', fg: '#5c3d00', pack: 'love' },
];

export const LOVE_PACK_META: StickerPack = {
  id: 'love',
  name: 'Love / Friendship',
  icon: '❤️',
  stickers: LOVE_PACK,
};

/* ------------------------------------------------------------------ */
/* Registry — SAB SE NICHE rakho! (TDZ: saare *_PACK_META upar define   */
/* hone chahiye, warna module crash hoga.)                              */
/* Naya pack: upar *_PACK + *_PACK_META banao, phir is array me add karo.*/
/* ------------------------------------------------------------------ */

export const STICKER_PACKS: StickerPack[] = [
  LOVE_PACK_META,
  MADRASA_PACK_META,
];
