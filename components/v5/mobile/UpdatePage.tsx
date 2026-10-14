'use client';

import { useRef, useState } from 'react';
import {
  ChatsAppLogo,
  ChevronRightIcon,
  CrownIcon,
  MicIcon,
  RefreshIcon,
  SlashIcon,
  SparkleIcon,
  UsersIcon,
} from './icons';
import { APP_VERSION, markVersionSeen, shouldShowUpdate } from './v5types';
import './v5-mobile.css';

interface Feature {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    icon: <UsersIcon size={44} color="#00e6a8" />,
    title: 'Sirf Ek Group',
    desc: 'Personal chats khatam — ab sab dost sirf "Madrasa Group" me. Koi uljhan nahi, sab ek jagah.',
  },
  {
    icon: <CrownIcon size={44} color="#f6c344" />,
    title: 'Owner & Member Badges',
    desc: 'sheraz ke naam ke sath golden Owner badge, baqi sab ke sath Member badge. Sab wazeh!',
  },
  {
    icon: <SparkleIcon size={44} color="#53bdeb" />,
    title: '7-Second Premium Loading',
    desc: 'Bilkul nayi cinematic loading animation — logo draw, bubbles, ticks aur tagline ke sath.',
  },
  {
    icon: <SlashIcon size={44} color="#00e6a8" />,
    title: 'Owner Commands',
    desc: 'Owner ke liye naye commands: /mute, /unmute aur /announce — seedha message box se.',
  },
  {
    icon: <MicIcon size={44} color="#f15c6d" />,
    title: 'Smart Voice Notes',
    desc: 'Record karo, pehle suno, phir bhejo ✓ ya delete karo 🗑 — WhatsApp jaisa mukammal tajurba.',
  },
];

const CHANGES = [
  'Personal/DM chats hata diye — sirf Madrasa Group',
  'Mute system: live countdown timer ke sath',
  '"Delete for everyone" — koi nishan nahi chhorta',
  'Nayi onboarding: naam, photo aur guided tour',
  '7-second premium loading animation',
  'Naye members auto-join hote hain',
  'Tez tareen — reload ki zaroorat nahi',
];

const LAST_STEP = FEATURES.length + 1; // 0..4 cards, 5 = kya badla, 6 = finale

/**
 * UpdatePage — har naye version par full-screen glassmorphism page.
 * shouldShowUpdate() se check karo; Magic Refresh dabane par reload.
 */
export default function UpdatePage({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const touchX = useRef<number | null>(null);

  const isCard = step < FEATURES.length;
  const isChangelog = step === FEATURES.length;
  const isFinale = step === LAST_STEP;

  function next() {
    if (step < LAST_STEP) setStep(s => s + 1);
  }
  function prev() {
    if (step > 0) setStep(s => s - 1);
  }

  function magicRefresh() {
    markVersionSeen();
    window.location.reload();
  }

  function skip() {
    markVersionSeen();
    onDone();
  }

  return (
    <div
      className="v5-update"
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx < -50) next();
        else if (dx > 50) prev();
      }}
    >
      {isFinale && <Confetti />}
      <ChatsAppLogo size={72} />
      <div style={{ height: 14 }} />
      <div className="v5-ver-badge">v{APP_VERSION} — Naya Update! 🎉</div>

      {/* ---- Feature cards carousel ---- */}
      {isCard && (
        <>
          <div className="v5-carousel">
            <div
              className="v5-carousel-track"
              style={{ transform: `translateX(-${step * 100}%)` }}
            >
              {FEATURES.map((f, i) => (
                <div key={f.title} className="v5-fcard" aria-hidden={i !== step}>
                  <div className="v5-fcard-icon">{f.icon}</div>
                  <div className="v5-fcard-title">{f.title}</div>
                  <div className="v5-fcard-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="v5-swipe-hint">← swipe karein →</div>
        </>
      )}

      {/* ---- Kya Badla ---- */}
      {isChangelog && (
        <div className="v5-changelog">
          <h4>Kya Badla</h4>
          <ul style={{ margin: 0, padding: 0 }}>
            {CHANGES.map(c => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Finale ---- */}
      {isFinale && (
        <div style={{ textAlign: 'center', marginTop: 26, animation: 'v5-cardin 0.5s ease' }}>
          <div style={{ fontSize: 30, fontWeight: 800 }}>Version Updated! 🎉</div>
          <div style={{ color: '#aebac1', fontSize: 14.5, marginTop: 8, lineHeight: 1.6, maxWidth: 300 }}>
            Nayi cheezein live karne ke liye ek dafa refresh karein.
          </div>
          <button className="v5-magic-btn v5-touch" onClick={magicRefresh}>
            <RefreshIcon size={22} /> Magic Refresh ✨
          </button>
          <button
            className="v5-btn-ghost v5-touch"
            onClick={skip}
            style={{ marginTop: 12 }}
          >
            Baad me
          </button>
        </div>
      )}

      {/* ---- Dots + nav ---- */}
      {!isFinale && (
        <>
          <div className="v5-onb-dots" style={{ marginTop: 18 }}>
            {Array.from({ length: LAST_STEP + 1 }, (_, i) => (
              <span key={i} className={`v5-onb-dot${i === step ? ' active' : ''}`} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 340, marginTop: 4 }}>
            {step > 0 && (
              <button
                className="v5-btn-ghost v5-touch"
                onClick={prev}
                style={{ width: 90, flexShrink: 0 }}
              >
                Peeche
              </button>
            )}
            <button className="v5-btn-primary v5-touch" onClick={next} style={{ flex: 1 }}>
              {isChangelog ? 'Khatam karo 🎉' : 'Aage'} <ChevronRightIcon size={20} />
            </button>
          </div>
          <button
            onClick={skip}
            style={{ marginTop: 14, color: '#5b6b75', fontSize: 13.5, padding: 10 }}
          >
            Skip karo
          </button>
        </>
      )}
    </div>
  );
}

/** chhota CSS confetti (finale ke liye) */
function Confetti() {
  const [pieces] = useState(() => {
    const colors = ['#00a884', '#35e0b0', '#53bdeb', '#f6c344', '#f15c6d', '#e9edef'];
    return Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      dur: 2.4 + Math.random() * 2.2,
      color: colors[i % colors.length],
      w: 6 + Math.random() * 6,
    }));
  });
  return (
    <div className="v5-confetti" aria-hidden>
      {pieces.map(p => (
        <i
          key={p.id}
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.w,
            height: p.w * 1.5,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

export { shouldShowUpdate };
