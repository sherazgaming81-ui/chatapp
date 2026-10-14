'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatsAppLogo, DoubleCheckIcon, CheckIcon } from '../mobile/icons';
import '../mobile/v5-mobile.css';

const DURATION = 3000;

/**
 * LoadingScreen — 3-second premium loading animation.
 * Mobile + desktop DONO isko use karte hain — bilkul identical animation.
 * 7 styles ka seamless mix (tez):
 *  0.0–0.5s  Logo Draw (stroke-draw)
 *  0.4–0.9s  Bubble Rise (bubbles float up)
 *  0.8–1.3s  Typing Dots (WhatsApp-style)
 *  1.2–1.7s  Tick March (✓ → ✓✓ → blue ✓✓)
 *  1.6–2.1s  Progress Bar (0 → 100%)
 *  2.0–2.5s  Dots Orbit (Discord-style, logo ke gird)
 *  2.4–3.0s  Fade Tagline ("Baatein, ab aur qareeb")
 * Phir fade-out aur onDone.
 */
export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0);
  const [fading, setFading] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const timeline: Array<[number, () => void]> = [
      [0, () => setPhase(0)],
      [400, () => setPhase(1)],
      [800, () => setPhase(2)],
      [1200, () => setPhase(3)],
      [1600, () => setPhase(4)],
      [2000, () => setPhase(5)],
      [2400, () => setPhase(6)],
      [DURATION, () => setFading(true)],
      [DURATION + 480, () => {
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      }],
    ];
    const timers = timeline.map(([t, fn]) => window.setTimeout(fn, t));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className={`v5-loading${fading ? ' v5-fadeout' : ''}`} aria-label="Loading ChatsApp">
      <div className="v5-load-logo-wrap">
        <ChatsAppLogo size={104} />
        {phase >= 5 && phase < 6 && (
          <div className="v5-orbit" aria-hidden>
            <span className="v5-orbit-dot" />
            <span className="v5-orbit-dot" />
            <span className="v5-orbit-dot" />
          </div>
        )}
      </div>

      <div className="v5-load-stage">
        {phase === 1 && (
          <div aria-hidden>
            <span className="v5-rise-bubble" style={{ left: '12%', width: 64, height: 34, animationDelay: '0s' }} />
            <span className="v5-rise-bubble" style={{ left: '44%', width: 88, height: 40, animationDelay: '0.25s' }} />
            <span className="v5-rise-bubble" style={{ left: '72%', width: 56, height: 30, animationDelay: '0.5s' }} />
          </div>
        )}
        {phase === 2 && (
          <div className="v5-typing-bubble" aria-hidden>
            <span className="v5-tdot" />
            <span className="v5-tdot" />
            <span className="v5-tdot" />
          </div>
        )}
        {phase === 3 && <TickMarch />}
        {phase === 4 && (
          <div className="v5-progress-track" aria-hidden>
            <div className="v5-progress-fill" />
          </div>
        )}
        {phase >= 6 && (
          <div className="v5-tagline">Baatein, ab aur qareeb</div>
        )}
      </div>

      <div className="v5-load-brand">ChatsApp</div>
    </div>
  );
}

/** Tick March: single ✓ → double ✓✓ → blue ✓✓ */
function TickMarch() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t1 = window.setTimeout(() => setStep(1), 380);
    const t2 = window.setTimeout(() => setStep(2), 760);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="v5-tickmarch" aria-hidden>
      {step === 0 && <CheckIcon size={44} color="#8696a0" />}
      {step === 1 && <DoubleCheckIcon size={48} />}
      {step === 2 && <DoubleCheckIcon size={52} blue />}
    </div>
  );
}
