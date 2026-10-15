// Bundled, hand-designed assets (all generated SVG — no external requests).
import type { StickerPack } from "./types";

export const svgUri = (svg: string) => "data:image/svg+xml;utf8," + encodeURIComponent(svg.replace(/\s+/g, " ").trim());
const X = 'xmlns="http://www.w3.org/2000/svg"';

export const COLORS = ["#2ccf8a", "#4cc3ff", "#ff8a5c", "#e8bd57", "#ff6f91", "#9bdc5a", "#5cd6c8", "#c79bff", "#f28b82", "#7fb7ff"];

export function avatarUri(name: string, color: string) {
  const ini = name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase() || "?";
  return svgUri(`<svg ${X} viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0b1b16" stop-opacity=".55"/></linearGradient></defs><rect width="100" height="100" fill="${color}"/><rect width="100" height="100" fill="url(#g)"/><text x="50" y="62" font-size="38" font-weight="700" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif">${ini}</text></svg>`);
}

// ───────── photo art ─────────
const SCENES = [
  (a: string, b: string) => `<rect width="400" height="300" fill="url(#s)"/><circle cx="300" cy="80" r="34" fill="#fff6d8" opacity=".9"/><path d="M0 230 L90 150 L160 210 L250 120 L400 240 V300 H0Z" fill="#0b2a22" opacity=".85"/><path d="M0 260 L120 200 L220 255 L320 190 L400 250 V300 H0Z" fill="#06150f"/>`,
  (a: string, b: string) => `<rect width="400" height="300" fill="url(#s)"/><circle cx="90" cy="70" r="22" fill="#ffe9a8"/><path d="M0 220 Q100 170 200 215 T400 200 V300 H0Z" fill="#c9923f"/><path d="M0 255 Q120 215 240 250 T400 240 V300 H0Z" fill="#a8742d"/>`,
  (a: string, b: string) => `<rect width="400" height="300" fill="url(#s)"/><g fill="#06130f"><rect x="40" y="170" width="320" height="130"/><path d="M130 170 Q200 70 270 170Z"/><rect x="196" y="40" width="8" height="60"/><rect x="60" y="110" width="22" height="100"/><path d="M60 110 L71 85 L82 110Z"/><rect x="318" y="110" width="22" height="100"/><path d="M318 110 L329 85 L340 110Z"/></g><circle cx="340" cy="46" r="18" fill="#fff3c4"/><g fill="#ffd36b" opacity=".85"><rect x="100" y="220" width="12" height="22" rx="6"/><rect x="190" y="215" width="20" height="40" rx="10"/><rect x="288" y="220" width="12" height="22" rx="6"/></g>`,
  (a: string, b: string) => `<rect width="400" height="300" fill="url(#s)"/><g fill="#fff" opacity=".85">${Array.from({ length: 28 }, (_, i) => `<circle cx="${(i * 97) % 400}" cy="${(i * 53) % 190}" r="${(i % 3) * 0.6 + 0.8}"/>`).join("")}</g><path d="M300 60a34 34 0 1 0 22 56a28 28 0 1 1 -22 -56Z" fill="#ffe9a8"/><path d="M0 240 Q100 200 200 235 T400 225 V300 H0Z" fill="#071a14"/>`,
  (a: string, b: string) => `<rect width="400" height="300" fill="url(#s)"/><g fill="#0a2b1e"><circle cx="70" cy="200" r="60"/><circle cx="150" cy="215" r="48"/><circle cx="320" cy="205" r="64"/><circle cx="250" cy="225" r="44"/></g><g fill="#ff8aa6"><circle cx="90" cy="240" r="7"/><circle cx="180" cy="252" r="6"/><circle cx="270" cy="246" r="8"/><circle cx="340" cy="250" r="6"/></g><rect y="262" width="400" height="38" fill="#05140e"/>`,
];
const PAL: [string, string][] = [["#ffb36b", "#2a1b4d"], ["#ffd88a", "#e0763f"], ["#1f3b6e", "#e8a65a"], ["#0b1b3b", "#1e5f74"], ["#a8e6cf", "#2f6f5a"], ["#ff9a8b", "#3b2a55"]];
export function photoArt(i: number, label?: string) {
  const [a, b] = PAL[i % PAL.length];
  const sc = SCENES[i % SCENES.length](a, b);
  return svgUri(`<svg ${X} viewBox="0 0 400 300"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>${sc}${label ? `<text x="16" y="284" font-size="14" fill="#fff" opacity=".8" font-family="system-ui">${label}</text>` : ""}</svg>`);
}

// ───────── wallpapers ─────────
const star = (c: string, w = 1.2) => `<rect x="16" y="16" width="48" height="48" fill="none" stroke="${c}" stroke-width="${w}"/><rect x="16" y="16" width="48" height="48" fill="none" stroke="${c}" stroke-width="${w}" transform="rotate(45 40 40)"/><circle cx="40" cy="40" r="9" fill="none" stroke="${c}" stroke-width="${w}"/><circle cx="0" cy="0" r="6" fill="none" stroke="${c}" stroke-width="${w}"/><circle cx="80" cy="0" r="6" fill="none" stroke="${c}" stroke-width="${w}"/><circle cx="0" cy="80" r="6" fill="none" stroke="${c}" stroke-width="${w}"/><circle cx="80" cy="80" r="6" fill="none" stroke="${c}" stroke-width="${w}"/>`;
const tile = (bg: string, inner: string, s = 80) => svgUri(`<svg ${X} width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><rect width="${s}" height="${s}" fill="${bg}"/>${inner}</svg>`);
const full = (inner: string, defs = "") => svgUri(`<svg ${X} viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${inner}</svg>`);

export interface Wallpaper { id: string; name: string; url: string; tile?: number; color: string }
export const WALLPAPERS: Wallpaper[] = [
  { id: "noor", name: "Noor", url: tile("#0c1d19", star("#1d4a3d")), tile: 80, color: "#0c1d19" },
  { id: "zellige", name: "Zellige", url: tile("#0d2a30", `<path d="M0 20 L20 0 L40 20 L20 40Z M40 60 L60 40 L80 60 L60 80Z M40 20 L60 0 L80 20 L60 40Z M0 60 L20 40 L40 60 L20 80Z" fill="none" stroke="#1f5a63" stroke-width="1.3"/><circle cx="20" cy="20" r="3" fill="#e8bd57" opacity=".5"/><circle cx="60" cy="60" r="3" fill="#e8bd57" opacity=".5"/>`), tile: 80, color: "#0d2a30" },
  { id: "arabesque", name: "Arabesque", url: tile("#101b33", `<g fill="none" stroke="#e8bd57" stroke-opacity=".28" stroke-width="1.2"><circle cx="0" cy="0" r="30"/><circle cx="60" cy="0" r="30"/><circle cx="0" cy="60" r="30"/><circle cx="60" cy="60" r="30"/><circle cx="30" cy="30" r="30"/></g>`, 60), tile: 60, color: "#101b33" },
  { id: "mihrab", name: "Mihrab", url: tile("#1b1410", `<path d="M10 70 V40 Q10 14 30 14 Q50 14 50 40 V70" fill="none" stroke="#c9923f" stroke-opacity=".35" stroke-width="1.4"/><path d="M20 70 V44 Q20 26 30 26 Q40 26 40 44 V70" fill="none" stroke="#c9923f" stroke-opacity=".22" stroke-width="1.2"/>`, 60), tile: 60, color: "#1b1410" },
  { id: "raat", name: "Raat", url: full(`<rect width="400" height="800" fill="url(#g)"/>${Array.from({ length: 70 }, (_, i) => `<circle cx="${(i * 131) % 400}" cy="${(i * 79) % 600}" r="${(i % 4) * 0.5 + 0.6}" fill="#fff" opacity="${0.3 + (i % 5) * 0.12}"/>`).join("")}<path d="M300 110a46 46 0 1 0 30 76a38 38 0 1 1 -30 -76Z" fill="#ffe9a8" opacity=".9"/><path d="M0 700 Q100 650 200 690 T400 670 V800 H0Z" fill="#050b14"/>`, `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1a3a"/><stop offset="1" stop-color="#143d4d"/></linearGradient>`), color: "#0b1a3a" },
  { id: "dunes", name: "Reg-e-rawan", url: full(`<rect width="400" height="800" fill="url(#g)"/><circle cx="90" cy="180" r="40" fill="#ffe3a1" opacity=".8"/><path d="M0 520 Q120 440 260 510 T400 480 V800 H0Z" fill="#b97a34" opacity=".75"/><path d="M0 620 Q140 550 280 620 T400 600 V800 H0Z" fill="#8c5522" opacity=".85"/><path d="M0 720 Q120 670 240 720 T400 700 V800 H0Z" fill="#5e3515"/>`, `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2347"/><stop offset=".6" stop-color="#d97b4a"/><stop offset="1" stop-color="#f3b46b"/></linearGradient>`), color: "#3a2347" },
  { id: "aurora", name: "Aurora", url: full(`<rect width="400" height="800" fill="#07120f"/><ellipse cx="80" cy="200" rx="220" ry="150" fill="#1c8f6a" opacity=".45" filter="url(#b)"/><ellipse cx="340" cy="480" rx="200" ry="170" fill="#2a6fb0" opacity=".38" filter="url(#b)"/><ellipse cx="120" cy="700" rx="200" ry="130" fill="#c79b3b" opacity=".28" filter="url(#b)"/>`, `<filter id="b"><feGaussianBlur stdDeviation="50"/></filter>`), color: "#07120f" },
  { id: "mauj", name: "Mauj", url: tile("#0b2230", `<path d="M0 20 Q20 0 40 20 T80 20 M0 50 Q20 30 40 50 T80 50 M0 80 Q20 60 40 80 T80 80" fill="none" stroke="#2f7f9a" stroke-opacity=".38" stroke-width="1.4"/>`), tile: 80, color: "#0b2230" },
  { id: "gulab", name: "Gulab", url: tile("#2a1320", `<g fill="#ff8aa6" opacity=".16"><circle cx="20" cy="20" r="9"/><circle cx="20" cy="20" r="4" fill="#2a1320"/><circle cx="60" cy="60" r="9"/><circle cx="60" cy="60" r="4" fill="#2a1320"/></g><path d="M40 0 V80 M0 40 H80" stroke="#ff8aa6" stroke-opacity=".08"/>`), tile: 80, color: "#2a1320" },
  { id: "dots", name: "Saada", url: tile("#101615", `<circle cx="10" cy="10" r="1.3" fill="#fff" opacity=".12"/>`, 20), tile: 20, color: "#101615" },
  { id: "plain", name: "Khaali", url: svgUri(`<svg ${X} width="4" height="4"><rect width="4" height="4" fill="#0a1311"/></svg>`), tile: 4, color: "#0a1311" },
];
export const getWallpaper = (id: string) => WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];

// ───────── chat themes ─────────
export const CHAT_THEMES = [
  { id: "zumurrud", name: "Zumurrud", out: "#0f5a43", outL: "#d3f5df", accent: "#2ccf8a", accentL: "#0f9b64" },
  { id: "neelam", name: "Neelam", out: "#1d4f8f", outL: "#d6e7ff", accent: "#5aa9ff", accentL: "#1f6fd0" },
  { id: "yaqoot", name: "Yaqoot", out: "#8a2740", outL: "#ffdbe3", accent: "#ff6f8f", accentL: "#c92c58" },
  { id: "zafran", name: "Zafran", out: "#8a5a10", outL: "#ffe9bd", accent: "#f0b84a", accentL: "#b5770a" },
  { id: "firoza", name: "Firoza", out: "#0f6670", outL: "#cdf3f5", accent: "#43d3dc", accentL: "#0c8a96" },
  { id: "sandal", name: "Sandal", out: "#6b5a43", outL: "#efe3cf", accent: "#d9bd8c", accentL: "#8c6a35" },
  { id: "siyah", name: "Siyah", out: "#2b3534", outL: "#dfe5e3", accent: "#b8c7c3", accentL: "#44524f" },
  { id: "banafsha", name: "Anar", out: "#9a3a1e", outL: "#ffdccd", accent: "#ff8a5c", accentL: "#c9481a" },
];

// ───────── stickers ─────────
function wrap(t: string): string[] {
  const w = t.split(" ");
  if (t.length <= 11 || w.length < 2) return [t];
  let best = 1, d = 99;
  for (let i = 1; i < w.length; i++) { const x = Math.abs(w.slice(0, i).join(" ").length - w.slice(i).join(" ").length); if (x < d) { d = x; best = i; } }
  return [w.slice(0, best).join(" "), w.slice(best).join(" ")];
}
export function makeSticker(t: string, e: string, bg: string, fg = "#fff") {
  const lines = wrap(t);
  const fs = Math.max(26, Math.min(40, 330 / Math.max(...lines.map((l) => l.length), 6)));
  const ty = lines.length === 1 ? 205 : 190;
  return svgUri(`<svg ${X} viewBox="0 0 256 256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${bg}" stop-opacity=".7"/></linearGradient></defs><rect x="10" y="10" width="236" height="236" rx="58" fill="#fff"/><rect x="18" y="18" width="220" height="220" rx="50" fill="url(#g)"/><text x="128" y="132" font-size="96" text-anchor="middle">${e}</text>${lines.map((l, i) => `<text x="128" y="${ty + i * (fs + 4)}" font-size="${fs}" font-weight="900" text-anchor="middle" fill="${fg}" stroke="#00000055" stroke-width="1" paint-order="stroke" font-family="Trebuchet MS,Verdana,sans-serif">${l.replace(/&/g, "&amp;")}</text>`).join("")}</svg>`);
}
const pack = (id: string, name: string, icon: string, list: [string, string, string, string?][]): StickerPack => ({ id, name, icon: makeSticker(list[0][0], list[0][1], list[0][2]), builtin: true, stickers: list.map(([t, e, bg, fg]) => makeSticker(t, e, bg, fg)) });

export const BUILTIN_PACKS: StickerPack[] = [
  pack("urdu", "Roman Urdu Mazaaq", "", [
    ["Kya baat hai!", "🤩", "#e8a21f"], ["Arey yaar!", "🤦", "#d35d6e"], ["Wah wah!", "👏", "#2e9e6b"], ["Haan bhai", "😎", "#3b7dd8"],
    ["Nahi yaar", "🙅", "#a84a4a"], ["Chai pilo", "☕", "#8a5a2b"], ["Bohat khoob", "👌", "#1f9aa6"], ["Shabash!", "💪", "#c9792b"],
    ["Aur sunao", "🗣️", "#5a6fd8"], ["Ji huzoor", "🙇", "#7a5ac8"], ["Tension nahi lene ka", "😌", "#2a9d8f"], ["Bhook lagi hai", "🍛", "#d9822b"],
    ["Mazay karo", "🥳", "#e0568a"], ["Sach me?", "😳", "#d6a21f"], ["Chal nikal", "🚪", "#7a8a8f"], ["Dhanyawaad", "🙏", "#4f9d5a"],
  ]),
  pack("eid", "Eid Mubarak", "", [
    ["Eid Mubarak", "🌙", "#1a7a55"], ["Chaand Raat", "✨", "#1c2f6e"], ["Eidi do!", "💸", "#c58b1f"], ["Meethi Eid", "🍮", "#c4507a"],
    ["Sheer Khurma", "🥣", "#9a6a2a"], ["Eid ki Namaz", "🕌", "#17806c"], ["Gale milo", "🤗", "#d1633c"], ["Naye kapde", "👕", "#3b6fd0"],
    ["Taqabbal Allah", "🤲", "#2b7d66"], ["Eid Dhamaka", "🎆", "#7a3fb0"],
  ]),
  pack("jummah", "Jummah Mubarak", "", [
    ["Jummah Mubarak", "🕌", "#117a5a"], ["Surah Kahf", "📖", "#2a5fa8"], ["Durood Shareef", "🌹", "#b8456a"], ["Ghusl & Itr", "🧴", "#b38a2d"],
    ["Khutba suno", "🎙️", "#476e6a"], ["Dua Qubool", "🤲", "#2f8f6b"], ["Masjid chalo", "🚶", "#3e7bb5"], ["Barkat wala din", "🌅", "#d98a3a"],
  ]),
  pack("dil", "Dua & Dil", "", [
    ["JazakAllah", "💚", "#1f8c63"], ["MashaAllah", "🧿", "#2a7fb8"], ["InshaAllah", "🤞", "#8a63c9"], ["Alhamdulillah", "🌿", "#3b9a58"],
    ["SubhanAllah", "✨", "#2f6fb5"], ["Ameen", "🤲", "#c28a2a"], ["Allah Hafiz", "👋", "#6a7fa0"], ["Barakallah", "🌟", "#d09a2a"],
  ]),
];

// ───────── GIFs (bundled animated SVG clips) ─────────
function gifSvg(e: string, cap: string, c1: string, c2: string, anim: string) {
  const a: Record<string, string> = {
    bounce: `<animateTransform attributeName="transform" type="translate" values="0 18;0 -18;0 18" dur=".7s" repeatCount="indefinite" calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1"/>`,
    spin: `<animateTransform attributeName="transform" type="rotate" values="0 130 100;360 130 100" dur="2s" repeatCount="indefinite"/>`,
    pulse: `<animateTransform attributeName="transform" type="scale" values="1;1.25;1" dur=".8s" repeatCount="indefinite" additive="sum"/>`,
    shake: `<animateTransform attributeName="transform" type="rotate" values="-14 130 100;14 130 100;-14 130 100" dur=".45s" repeatCount="indefinite"/>`,
    float: `<animateTransform attributeName="transform" type="translate" values="-26 0;26 0;-26 0" dur="1.6s" repeatCount="indefinite"/>`,
  };
  const stars = Array.from({ length: 8 }, (_, i) => `<circle cx="${20 + i * 31}" cy="${20 + ((i * 47) % 150)}" r="3" fill="#fff"><animate attributeName="opacity" values="0;1;0" dur="${1 + (i % 3) * 0.4}s" begin="${i * 0.2}s" repeatCount="indefinite"/></circle>`).join("");
  return svgUri(`<svg ${X} viewBox="0 0 260 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"><animate attributeName="stop-color" values="${c1};${c2};${c1}" dur="3s" repeatCount="indefinite"/></stop><stop offset="1" stop-color="${c2}"><animate attributeName="stop-color" values="${c2};${c1};${c2}" dur="3s" repeatCount="indefinite"/></stop></linearGradient></defs><rect width="260" height="200" fill="url(#g)"/>${stars}<g><text x="130" y="122" font-size="88" text-anchor="middle">${e}${a[anim]}</text></g><rect y="150" width="260" height="50" fill="#0006"/><text x="130" y="184" font-size="22" font-weight="800" fill="#fff" text-anchor="middle" font-family="Trebuchet MS,Verdana,sans-serif">${cap}</text></svg>`);
}
export interface Gif { id: string; cat: string; cap: string; url: string }
const G: [string, string, string, string, string, string][] = [
  ["Khushi", "😄", "Maza aa gaya!", "#f2a33a", "#e05a7c", "bounce"], ["Khushi", "🥳", "Party shuru!", "#7b4bd8", "#e0568a", "bounce"],
  ["Khushi", "🤩", "Kya baat hai", "#2f9a6e", "#2a7fb8", "pulse"], ["Hasi", "😂", "Hahaha!", "#d9822b", "#c94a4a", "shake"],
  ["Hasi", "🤣", "Mar gaya hasi se", "#1f8f8a", "#3b6fd0", "shake"], ["Hasi", "😜", "Mazaak tha", "#c9496a", "#7a4bc8", "spin"],
  ["Dua", "🤲", "Dua kijiye", "#17806c", "#1c2f6e", "float"], ["Dua", "🕋", "Allah Hu Akbar", "#1a2438", "#8a6a1f", "pulse"],
  ["Dua", "🌙", "Raat Mubarak", "#0b1a3a", "#2f5f9a", "float"], ["Eid", "🌙", "Eid Mubarak!", "#1a7a55", "#c58b1f", "pulse"],
  ["Eid", "🎆", "Eid Dhamaka", "#2b1a5a", "#c4507a", "bounce"], ["Eid", "🍮", "Sheer Khurma", "#9a6a2a", "#d1633c", "spin"],
  ["Chai", "☕", "Chai Time", "#8a5a2b", "#c9792b", "bounce"], ["Chai", "🍵", "Garam garam", "#3b7a52", "#a8742d", "float"],
  ["Chai", "🍛", "Khana ready", "#d9822b", "#8a3a1f", "shake"], ["Reaction", "😱", "Haye Allah!", "#4a4ab8", "#b84a8a", "shake"],
  ["Reaction", "🙄", "Haan haan", "#546e7a", "#37474f", "spin"], ["Reaction", "👍", "Pakka!", "#2e9e6b", "#2a7fb8", "bounce"],
  ["Reaction", "😴", "Neend aa rahi", "#2a3a6a", "#5a4a9a", "float"], ["Reaction", "😭", "Rona aa gaya", "#3a6ab5", "#1f3f7a", "shake"],
];
export const GIFS: Gif[] = G.map(([cat, e, cap, c1, c2, an], i) => ({ id: "gif" + i, cat, cap, url: gifSvg(e, cap, c1, c2, an) }));
export const GIF_CATS = ["Sab", ...Array.from(new Set(G.map((g) => g[0])))];

// ───────── emoji ─────────
const E = (s: string) => Array.from(s.replace(/\s/g, ""));
export const EMOJI: { id: string; name: string; icon: string; list: string[] }[] = [
  { id: "smileys", name: "Chehre", icon: "😀", list: E("😀😃😄😁😆😅😂🤣🥲☺️😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🥸🤩🥳😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🤭🤫🤥😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕🤑🤠😈👿👻💀☠️🤡💩") },
  { id: "gestures", name: "Ishaare", icon: "👍", list: E("👍👎👊✊🤛🤜👏🙌👐🤲🤝🙏✌️🤞🤟🤘👌🤌🤏👈👉👆👇☝️✋🤚🖐️🖖👋🤙💪🦾✍️🤳💅👀👁️👅👄🧠🫀🦷👶🧒👦👧🧑👨🧔👩🧓👴👵🕌🕋") },
  { id: "hearts", name: "Dil", icon: "❤️", list: E("❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💟☮️✝️☪️🕉️☸️✡️🔯🕎☯️☦️🛐⭐🌟✨⚡🔥💥🌈☀️🌙🌛🌜🌠🌌☁️❄️💧🌊") },
  { id: "food", name: "Khana", icon: "🍛", list: E("🍛🍚🍜🍲🥘🍖🍗🥩🍔🍟🍕🌭🥪🌮🌯🥙🧆🥗🍳🥞🧇🥓🍞🥐🥖🧀🍰🎂🧁🍮🍩🍪🍫🍬🍭🍿🍎🍌🍉🍇🍓🍑🥭🍍🥥🥝🍅🥕🌽🥔🧄🧅☕🍵🥛🍼🧃🥤🧋🍯🍞") },
  { id: "animals", name: "Janwar", icon: "🐪", list: E("🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐔🐧🐦🐤🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐜🐢🐍🦎🐙🦑🦀🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🐘🦛🦏🐪🐫🦒🦘🐃🐂🐄🐎🐖🐏🐑🐐🌵🌴🌳🌲🌱🌿☘️🍀🌸🌹🌺🌻🌼") },
  { id: "activity", name: "Khel", icon: "⚽", list: E("⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🏓🏸🏒🏑🥍🏏🥅⛳🏹🎣🥊🥋🎽⛸️🥌🎿🏆🥇🥈🥉🏅🎖️🎯🎮🕹️🎲♟️🧩🎨🎭🎬🎤🎧🎼🎹🥁🎷🎺🎸🪕🎻") },
  { id: "objects", name: "Cheezein", icon: "📱", list: E("📱💻⌨️🖥️🖨️🖱️💽💾📷📸📹🎥📞☎️📺📻⏰⌚🔋🔌💡🔦🕯️🧯💰💵💴💸💳💎⚖️🔧🔨⚙️🔒🔓🔑🗝️📿📚📖📝✏️🖊️📌📍📎✂️📦🎁🎈🎉🎊🕌🕋📅🗓️") },
  { id: "symbols", name: "Nishan", icon: "✅", list: E("✅❌❎⭕❗❓‼️⁉️💯🔴🟠🟡🟢🔵🟣⚫⚪🟤🔺🔻🔸🔹🔶🔷▶️⏸️⏯️⏹️⏺️⏭️⏮️🔀🔁🔂➕➖➗✖️♾️💲™️©️®️〰️➰➿🔙🔚🔛🔝🔜") },
];
export const EMOJI_KW: Record<string, string> = {
  "😂": "hasi hansi laugh funny", "😭": "ro rona cry", "😍": "pyaar love dil", "😎": "cool", "🙏": "dua shukriya please thanks", "🤲": "dua ameen", "👍": "theek ok haan like", "👎": "nahi dislike",
  "❤️": "dil love pyaar", "🔥": "aag fire", "🕌": "masjid mosque namaz", "🕋": "kaaba makkah hajj", "🌙": "chaand moon raat eid", "☕": "chai tea coffee", "🍛": "khana biryani", "🥳": "party mubarak",
  "😴": "neend sleep", "😡": "gussa angry", "🤔": "soch think", "😱": "darr shock", "🎉": "mubarak party", "📖": "kitab quran book", "📿": "tasbeeh dhikr", "💪": "taqat strong", "🤝": "haath milao deal",
  "🐪": "oont camel", "⚽": "football khel", "💰": "paisa money", "✨": "chamak sparkle", "🌹": "gulab rose", "😊": "muskurahat smile", "😢": "udaas sad",
};

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🤲"];

// ───────── profile studio assets ─────────
export const BANNERS: { id: string; name: string; css: string; anim?: boolean }[] = [
  { id: "emerald", name: "Zumurrud", css: "linear-gradient(120deg,#0f5a43,#2ccf8a,#0f5a43)", anim: true },
  { id: "sunset", name: "Shaam", css: "linear-gradient(120deg,#ff7a59,#e8bd57,#c4507a,#ff7a59)", anim: true },
  { id: "aurora", name: "Aurora", css: "linear-gradient(120deg,#0b2a3a,#2ccfa8,#3a7bd8,#0b2a3a)", anim: true },
  { id: "gold", name: "Sone ki Chamak", css: "linear-gradient(120deg,#6b4f12,#f6dd8d,#b88a1f,#6b4f12)", anim: true },
  { id: "night", name: "Raat", css: "radial-gradient(circle at 20% 30%,#1f3f7a,#0a1020 70%)" },
  { id: "rose", name: "Gulab", css: "linear-gradient(120deg,#5a1030,#ff6f91,#5a1030)", anim: true },
  { id: "mihrab", name: "Mihrab", css: `${tile("#0c1d19", star("#2ccf8a55"))}`.replace(/^/, "url(\"").replace(/$/, "\") ,linear-gradient(120deg,#0c1d19,#0c1d19)") },
  { id: "plain", name: "Saada", css: "linear-gradient(120deg,#2a3a36,#1b2926)" },
];
export const EFFECTS = [
  { id: "none", name: "Koi nahi" }, { id: "sparkle", name: "Sitaray" }, { id: "petals", name: "Gulab patti" },
  { id: "fireflies", name: "Jugnu" }, { id: "crescent", name: "Hilal Glow" }, { id: "stars", name: "Taaron ki baarish" },
];
export const FRAMES = [
  { id: "none", name: "Saada", css: "" }, { id: "gold", name: "Sunehri", css: "0 0 0 3px #e8bd57, 0 0 14px #e8bd57aa" },
  { id: "emerald", name: "Zumurrud", css: "0 0 0 3px #2ccf8a, 0 0 14px #2ccf8aaa" }, { id: "sky", name: "Neela", css: "0 0 0 3px #4cc3ff, 0 0 14px #4cc3ffaa" },
  { id: "rose", name: "Gulabi", css: "0 0 0 3px #ff6f91, 0 0 14px #ff6f91aa" }, { id: "dual", name: "Do-rang", css: "0 0 0 3px #0a1311, 0 0 0 6px #e8bd57, 0 0 18px #2ccf8a" },
];
export const NAME_STYLES = [
  { id: "plain", name: "Saada", css: "" }, { id: "gold", name: "Sunehri", css: "linear-gradient(90deg,#f6dd8d,#e8bd57,#b88a1f)" },
  { id: "emerald", name: "Zumurrud", css: "linear-gradient(90deg,#8af0c0,#2ccf8a,#17a06a)" }, { id: "sunset", name: "Shaam", css: "linear-gradient(90deg,#ffb36b,#ff6f91,#c79bff)" },
  { id: "ocean", name: "Samandar", css: "linear-gradient(90deg,#8ae0ff,#4c9bff,#5cd6c8)" },
];
export const SPECIAL_BADGES: Record<string, { name: string; icon: string; desc: string }> = {
  founder: { name: "Bani", icon: "👑", desc: "Group ke founder" },
  hafiz: { name: "Hafiz", icon: "📖", desc: "Quran hifz kiya hua" },
  early: { name: "Pehle Saathi", icon: "🌱", desc: "Pehle 10 members me se" },
  helper: { name: "Madadgar", icon: "🤝", desc: "Dosto ki madad karne wala" },
  night: { name: "Raat ka Jaagne wala", icon: "🦉", desc: "Raat ko sabse active" },
  chai: { name: "Chai Lover", icon: "☕", desc: "Chai ke bina nahi" },
};
export const ACHIEVEMENTS: { id: string; title: string; desc: string; icon: string }[] = [
  { id: "first_msg", title: "Pehla message!", desc: "Group me pehla message bheja", icon: "💬" },
  { id: "first_photo", title: "Pehli photo!", desc: "Pehli photo share ki", icon: "📸" },
  { id: "streak7", title: "7 din streak!", desc: "Lagataar 7 din active rahe", icon: "🔥" },
  { id: "first_voice", title: "Awaaz ka jaadu", desc: "Pehla voice note bheja", icon: "🎙️" },
  { id: "first_sticker", title: "Sticker Master", desc: "Pehla sticker bheja", icon: "🎭" },
  { id: "first_poll", title: "Raaye ki Dunya", desc: "Pehla poll banaya", icon: "📊" },
  { id: "tasbeeh", title: "Zaakir", desc: "Tasbeeh mukammal ki", icon: "📿" },
  { id: "profile", title: "Apni pehchan", desc: "Profile mukammal ki", icon: "🪪" },
  { id: "quiz", title: "Deen ka Aalim", desc: "Deen quiz khela", icon: "🧠" },
  { id: "reply", title: "Jawab-e-Shaandar", desc: "Kisi message ka reply kiya", icon: "↩️" },
  { id: "setup", title: "Poora Tayyar!", desc: "Setup 100% mukammal", icon: "🏆" },
  { id: "quran", title: "Quran Saathi", desc: "Quran ka verse bookmark kiya", icon: "🕌" },
];
