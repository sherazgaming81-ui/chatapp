"use client";
// Profile Studio assets — light/white theme, sab free.

export interface BannerDef { id: string; name: string; css: string; anim?: boolean }
export interface EffectDef { id: string; name: string }
export interface FrameDef { id: string; name: string; css: string }
export interface NameStyleDef { id: string; name: string; css?: string }

export const BANNERS: BannerDef[] = [
  { id: "blurple", name: "Blurple", css: "linear-gradient(135deg,#5865f2,#9b7bff)" },
  { id: "sunset", name: "Sunset", css: "linear-gradient(135deg,#ff9a6b,#ff6f91,#c79bff)" },
  { id: "ocean", name: "Ocean", css: "linear-gradient(135deg,#4cc3ff,#5865f2)" },
  { id: "mint", name: "Mint", css: "linear-gradient(135deg,#3be39a,#4cc3ff)" },
  { id: "gold", name: "Gold", css: "linear-gradient(135deg,#e8bd57,#ff8a5c)" },
  { id: "rose", name: "Rose", css: "linear-gradient(135deg,#ff9ab5,#ff6f91)" },
  { id: "lavender", name: "Lavender", css: "linear-gradient(135deg,#c79bff,#9b7bff)" },
  { id: "mono", name: "Mono", css: "linear-gradient(135deg,#8a8d98,#2f3035)" },
  { id: "aurora", name: "Aurora", css: "linear-gradient(135deg,#3be39a,#4cc3ff,#c79bff,#ff9ab5)", anim: true },
  { id: "ember", name: "Ember", css: "linear-gradient(135deg,#ff8a5c,#ff6f91,#e8bd57)", anim: true },
];

export const EFFECTS: EffectDef[] = [
  { id: "none", name: "Koi nahi" },
  { id: "sparkle", name: "Sparkle ✨" },
  { id: "petals", name: "Petals 🌸" },
  { id: "fireflies", name: "Fireflies" },
  { id: "rain", name: "Rain" },
  { id: "crescent", name: "Crescent 🌙" },
];

export const FRAMES: FrameDef[] = [
  { id: "none", name: "Koi nahi", css: "none" },
  { id: "gold-ring", name: "Gold ring", css: "0 0 0 3px #e8bd57" },
  { id: "blurple-ring", name: "Blurple ring", css: "0 0 0 3px #5865f2" },
  { id: "rainbow", name: "Rainbow", css: "0 0 0 3px #ff6f91, 0 0 0 6px #e8bd57, 0 0 0 9px #3be39a" },
  { id: "glow", name: "Glow", css: "0 0 18px 4px #9b7bff88" },
  { id: "double", name: "Double", css: "0 0 0 2px #fff, 0 0 0 5px #5865f2" },
];

export const NAME_STYLES: NameStyleDef[] = [
  { id: "plain", name: "Plain" },
  { id: "grad-blurple", name: "Blurple", css: "linear-gradient(90deg,#5865f2,#9b7bff)" },
  { id: "grad-gold", name: "Gold", css: "linear-gradient(90deg,#b8860b,#e8bd57)" },
  { id: "grad-fire", name: "Fire", css: "linear-gradient(90deg,#ff8a5c,#ff6f91)" },
  { id: "grad-mint", name: "Mint", css: "linear-gradient(90deg,#14a96f,#4cc3ff)" },
  { id: "grad-rose", name: "Rose", css: "linear-gradient(90deg,#ff6f91,#c79bff)" },
];
