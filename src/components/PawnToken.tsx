"use client";
// Ludo pawn (goti) — Manus design port: SVG pawn jisme gradient body,
// gol head, base rim, chamak (highlight), number badge plate aur drop
// shadow hai. Rang src/lib/boardSkin.ts (BOARD_SKIN) se ate hain.
// SVG gradient/filter ids har pawn ke liye unique hain (useId suffix) —
// ek page par kai game cards / kai pawns hon to id clash nahi hota.
import { useId, type CSSProperties } from "react";
import { BOARD_SKIN } from "@/lib/boardSkin";

interface PawnTokenProps {
  /** 0 = red, 1 = green, 2 = yellow, 3 = blue */
  playerIdx: number;
  number: number;
  className?: string;
}

export default function PawnToken({ playerIdx, number, className = "" }: PawnTokenProps) {
  const color = BOARD_SKIN.playerColors[playerIdx] || BOARD_SKIN.playerColors[0];
  const shade = BOARD_SKIN.playerShades[playerIdx] || BOARD_SKIN.playerShades[0];
  const label = BOARD_SKIN.playerNames[playerIdx] || "";
  const white = BOARD_SKIN.cellBg;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradientId = `pawn-g-${playerIdx}-${number}-${uid}`;
  const rimId = `pawn-r-${playerIdx}-${number}-${uid}`;
  const shadowId = `pawn-s-${playerIdx}-${number}-${uid}`;

  return (
    <svg
      className={`pawn-svg ${className}`}
      viewBox="0 0 52 68"
      role="img"
      aria-label={`${label} pawn ${number}`}
      focusable="false"
      style={{ "--token-color": color } as CSSProperties}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade.light} />
          <stop offset="38%" stopColor={color} />
          <stop offset="100%" stopColor={shade.dark} />
        </linearGradient>
        <linearGradient id={rimId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade.light} />
          <stop offset="100%" stopColor={shade.dark} />
        </linearGradient>
        <filter id={shadowId} x="-40%" y="-25%" width="180%" height="175%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="1.6" floodColor={BOARD_SKIN.framePalette.dark} floodOpacity="0.36" />
        </filter>
      </defs>
      <g filter={`url(#${shadowId})`} stroke={white} strokeWidth="2.2" strokeLinejoin="round">
        <ellipse cx="26" cy="57" rx="21" ry="8" fill={`url(#${rimId})`} />
        <path d="M13 54c.8-7.6 5.8-12.3 8-18.2.9-2.4 1.1-5.5 1.1-8.5h7.8c0 3 .2 6.1 1.1 8.5C35.2 41.7 40.2 46.4 41 54c-6.2 3.3-21.8 3.3-28 0Z" fill={`url(#${gradientId})`} />
        <circle cx="26" cy="18" r="11.5" fill={`url(#${gradientId})`} />
        <ellipse cx="21.4" cy="12.8" rx="4.2" ry="2.4" fill={white} opacity="0.78" stroke="none" />
        <path d="M8 55c6.2 5.1 29.8 5.1 36 0" fill="none" stroke={shade.light} strokeWidth="1.4" opacity="0.9" />
        <rect x="19.2" y="39" width="13.6" height="10.4" rx="4" fill={white} stroke={shade.dark} strokeWidth="1.1" />
        <text x="26" y="46.6" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="7.5" fontWeight="900" fill={shade.dark} stroke="none">{number}</text>
      </g>
    </svg>
  );
}
