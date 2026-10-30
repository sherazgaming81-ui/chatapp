"use client";
// ─────────────────────────────────────────────────────────────
// Ludo BOARD SKIN — board ki SARI visual styling sirf yahan se.
// Design: Manus wala UI port (pawn gotiyan + wood/gold frame).
// Values Manus ke SKIN object se hain (player color/light/dark
// shades, board colors, frame palette) — PasaMessage.tsx me board
// ke liye koi hardcoded rang nahi. Geometry (PATH / HOME_CELLS
// coordinates) layout hai, skin nahi — wo PasaMessage.tsx me hai.
// CSS classes/vars (globals.css ka "Ludo — Manus design port"
// section) inhi hex values ko mirror karte hain.
// ─────────────────────────────────────────────────────────────

export const BOARD_SKIN = {
  /** player index 0..3 — red, green, yellow, blue (Manus SKIN.players.*.color) */
  playerColors: ["#E63329", "#00A651", "#FFC61A", "#2456A6"],

  /** har player ke light/dark shades — pawn gradient + dice gradient + yard label */
  playerShades: [
    { light: "#FF9A8F", dark: "#9F201C" }, // red
    { light: "#8DE3A6", dark: "#006B35" }, // green
    { light: "#FFE78C", dark: "#B77900" }, // yellow
    { light: "#91B9FF", dark: "#16366C" }, // blue
  ],

  /** yard ke andar ka chhota label */
  playerNames: ["RED", "GREEN", "YELLOW", "BLUE"],

  /** Manus frame palette — wood/gold rim */
  framePalette: {
    light: "#E2C58D",
    gold: "#D6A24A",
    honey: "#AE7137",
    mid: "#82512E",
    dark: "#4B2B1B",
  },

  /** bahari frame — Manus board-frame: layered wood gradient + dark rim border */
  frame: {
    border: "3px solid #4B2B1B",
    background:
      "linear-gradient(145deg, #E2C58D 0%, #D6A24A 22%, #AE7137 57%, #82512E 100%)",
    padding: "10px",
    borderRadius: "18px",
    shadow:
      "0 10px 0 rgba(75,43,27,0.83), 0 18px 28px rgba(75,43,27,0.22), inset 0 2px 1px rgba(255,255,255,0.62)",
  },

  /** andar wale board (15x15 grid) ki border + corner radius */
  boardBorder: "1px solid #4B2B1B",
  boardRadius: 10,
  /** har cell ki halki border (Manus board.grid) */
  cellBorder: "#C9CDD2",
  /** track cell ka rang (Manus board.track) */
  cellBg: "#FFFFFF",
  /** halki garam safed surface (yard rings waghera, Manus board.surface) */
  surfaceBg: "#FFFDF8",
  /** safe cell ka background (Manus board.safe) */
  safeCellBg: "#FFF8E4",

  /** yard ke andar ke safed box ka rang */
  yardInnerBg: "#FFFFFF",

  /**
   * Center ke 4 triangles — order: [left, top, right, bottom]
   * asal board: left red, top green, right yellow, bottom blue
   */
  centerColors: ["#E63329", "#00A651", "#FFC61A", "#2456A6"],

  /** safe cell par star ka rang (Manus: wood gold) */
  safeMarkColor: "#D6A24A",
  /** destination halo ka default rang (asal render me mover ke player rang se override hota hai) */
  haloColor: "#D6A24A",
  /** start cell par direction arrow ka fallback rang (asal render me player dark shade) */
  arrowColor: "rgba(0,0,0,0.4)",
};

export type BoardSkin = typeof BOARD_SKIN;
