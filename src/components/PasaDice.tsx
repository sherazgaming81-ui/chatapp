"use client";
// Ludo dice — Manus design port: player ke rang ki gradient 3D dice,
// safed pips, roll par tumble/flicker (flicker value parent deta hai),
// aur timer ke liye SVG countdown ring (10s). Rang boardSkin se.
import { BOARD_SKIN } from "@/lib/boardSkin";

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]],
};

interface PasaDiceProps {
  /** dice kis player ke rang ki ho (aam tor par jis ne roll kiya / jis ki bari) */
  playerIdx: number;
  /** dikhai dene wali value (rolling ke doran parent flicker values deta hai) */
  value: number | null;
  rolling: boolean;
  disabled: boolean;
  /** timer on ho to bachi hui seconds (float), warna null — ring nahi dikhegi */
  remainingSeconds: number | null;
  onRoll: () => void;
}

export default function PasaDice({ playerIdx, value, rolling, disabled, remainingSeconds, onRoll }: PasaDiceProps) {
  const color = BOARD_SKIN.playerColors[playerIdx] || BOARD_SKIN.playerColors[0];
  const shade = BOARD_SKIN.playerShades[playerIdx] || BOARD_SKIN.playerShades[0];
  const face = value !== null && value >= 1 && value <= 6 ? value : 1;
  const countdown = remainingSeconds === null ? 0 : Math.max(0, Math.min(1, remainingSeconds / 10));
  const CIRC = 2 * Math.PI * 36;

  return (
    <div className={`ludo-dice-wrap${rolling ? " ludo-dice-wrap--rolling" : ""}`}>
      {remainingSeconds !== null && (
        <svg className="ludo-countdown-ring" viewBox="0 0 80 80" aria-hidden="true">
          <circle className="ludo-countdown-ring__track" cx="40" cy="40" r="36" />
          <circle
            className="ludo-countdown-ring__progress"
            cx="40" cy="40" r="36"
            style={{ stroke: color, strokeDasharray: `${CIRC}`, strokeDashoffset: `${CIRC * (1 - countdown)}` }}
          />
        </svg>
      )}
      <button
        type="button"
        className="ludo-dice-button"
        onClick={onRoll}
        disabled={disabled}
        aria-label={rolling ? "Pasa ghum raha hai" : "Pasa phenko"}
        style={{
          background: `linear-gradient(150deg, ${shade.light} 0%, ${color} 52%, ${shade.dark} 100%)`,
          boxShadow: `0 9px 0 ${shade.dark}, 0 13px 18px rgba(75,43,27,0.21)`,
        }}
      >
        <span className="ludo-dice-face">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <rect x="3" y="3" width="94" height="94" rx="23" fill="none" stroke="#FFFFFF" strokeWidth="3" opacity="0.48" />
            {(PIPS[face] || PIPS[1]).map(([cx, cy], index) => (
              <circle key={`${face}-${index}`} cx={cx} cy={cy} r="7.6" fill="#FFFFFF" />
            ))}
          </svg>
        </span>
      </button>
      <span className="ludo-dice-shadow" aria-hidden="true" />
    </div>
  );
}
