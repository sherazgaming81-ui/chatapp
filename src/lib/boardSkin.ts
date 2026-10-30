"use client";
// ─────────────────────────────────────────────────────────────
// Ludo BOARD SKIN — board ki SARI visual styling sirf yahan se.
// User 5 designs dekh kar ek select karega: sirf is file ko badalna
// hoga, PasaMessage.tsx me board ke liye koi hardcoded rang nahi hai.
// Geometry (PATH / HOME_CELLS coordinates) layout hai, skin nahi —
// wo PasaMessage.tsx me rehti hai. Animations / glow / halo / chips /
// sounds bhi skin se independent hain; sirf rang, frame aur token
// ka look yahan se ata hai.
// ─────────────────────────────────────────────────────────────

export const BOARD_SKIN = {
  /** player index 0..3 — red, green, yellow, blue */
  playerColors: ["#e63329", "#00a651", "#f5a800", "#1e6fd9"],

  /** #39 classic frame — sunehra / lakri (wood) wala bahari frame */
  frame: {
    border: "3px solid #6b4423",
    background:
      "linear-gradient(135deg, #8b5a2b 0%, #c89b3c 28%, #f0d27a 50%, #b8860b 72%, #8b5a2b 100%)",
    padding: "10px",
    borderRadius: "14px",
    shadow: "0 10px 28px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.45)",
  },

  /** andar wale board (15x15 grid) ki border */
  boardBorder: "2px solid rgba(0,0,0,0.55)",
  /** har cell ki halki border */
  cellBorder: "rgba(0,0,0,0.25)",
  /** aam (safed) cell ka rang */
  cellBg: "#ffffff",

  /** yard ke andar ke safed box ka rang */
  yardInnerBg: "#ffffff",

  /**
   * Center ke 4 triangles — order: [left, top, right, bottom]
   * asal board: left red, top green, right yellow, bottom blue
   */
  centerColors: ["#e63329", "#00a651", "#f5a800", "#1e6fd9"],

  /** goti (token) ka look */
  token: {
    borderColor: "#ffffff",
    shadow:
      "0 2px 5px rgba(0,0,0,0.45), inset 0 -3px 5px rgba(0,0,0,0.28), inset 0 2px 3px rgba(255,255,255,0.35)",
    innerDot: "rgba(255,255,255,0.55)",
  },

  /** safe cell par star ka rang */
  safeMarkColor: "#d97706",
  /** selected token ki manzil (destination) par halo ka rang */
  haloColor: "#5865f2",
  /** start cell par direction arrow ka rang */
  arrowColor: "rgba(0,0,0,0.4)",
};

export type BoardSkin = typeof BOARD_SKIN;
