'use client';

import { useState } from 'react';
import { tapHaptic } from '../shared/haptics';

/** Hand-drawn line illustrations — har step ke liye unique, premium minimal art. */
function Art({ step }: { step: number }) {
  const stroke = 'var(--mv2-accent)';
  const soft = 'rgba(255,255,255,0.85)';
  return (
    <svg width="168" height="128" viewBox="0 0 168 128" fill="none" aria-hidden>
      {step === 0 && (
        <g>
          <rect x="34" y="18" width="100" height="72" rx="20" stroke={stroke} strokeWidth="4" />
          <path d="M56 90l-8 20 24-16" stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
          <circle cx="66" cy="54" r="6" fill={stroke} />
          <circle cx="88" cy="54" r="6" fill={stroke} opacity="0.45" />
          <circle cx="110" cy="54" r="6" fill={stroke} opacity="0.45" />
          <g stroke={soft} strokeWidth="3" strokeLinecap="round" opacity="0.7">
            <path d="M140 22v12M134 28h12" />
          </g>
          <circle cx="28" cy="34" r="3.5" fill={soft} opacity="0.6" />
        </g>
      )}
      {step === 1 && (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i} opacity={i === 0 ? 1 : 0.55 - i * 0.12}>
              <rect x="30" y={14 + i * 34} width="108" height="28" rx="14" stroke={i === 0 ? stroke : soft} strokeWidth="3.5" />
              <circle cx="48" cy={28 + i * 34} r="8" stroke={i === 0 ? stroke : soft} strokeWidth="3" />
              <line x1="64" y1={24 + i * 34} x2={i === 0 ? 118 : 100} y2={24 + i * 34} stroke={i === 0 ? stroke : soft} strokeWidth="3" strokeLinecap="round" />
              <line x1="64" y1={32 + i * 34} x2="92" y2={32 + i * 34} stroke={i === 0 ? stroke : soft} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
            </g>
          ))}
          <path d="M138 48l14-6-4 14" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {step === 2 && (
        <g>
          <rect x="66" y="14" width="36" height="64" rx="18" stroke={stroke} strokeWidth="4" />
          <circle cx="84" cy="34" r="7" stroke={stroke} strokeWidth="3" />
          <line x1="84" y1="41" x2="84" y2="58" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line
              key={i}
              x1={30 + i * 22} y1={96 - (i % 2 === 0 ? 10 : 0)} x2={30 + i * 22} y2={96 + (i % 2 === 0 ? 10 : 4)}
              stroke={soft} strokeWidth="4" strokeLinecap="round" opacity={0.5 + (i % 3) * 0.15}
            />
          ))}
          <path d="M126 40c6-8 16-10 22-6" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
          <path d="M148 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill={stroke} />
        </g>
      )}
      {step === 3 && (
        <g>
          <path d="M84 16l44 18v34c0 26-19 42-44 50-25-8-44-24-44-50V34z" stroke={stroke} strokeWidth="4" strokeLinejoin="round" />
          <rect x="74" y="58" width="20" height="16" rx="4" stroke={soft} strokeWidth="3.5" />
          <path d="M78 58v-6a6 6 0 0 1 12 0v6" stroke={soft} strokeWidth="3.5" />
          <circle cx="84" cy="66" r="2.5" fill={stroke} />
          <g stroke={soft} strokeWidth="3" strokeLinecap="round" opacity="0.6">
            <path d="M34 96v10M29 101h10" />
            <path d="M134 92v10M129 97h10" />
          </g>
        </g>
      )}
      {step === 4 && (
        <g>
          <circle cx="84" cy="60" r="34" stroke={stroke} strokeWidth="4" />
          <path d="M68 60l12 12 22-24" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const a = (i * Math.PI) / 4;
            const x1 = 84 + 44 * Math.cos(a), y1 = 60 + 44 * Math.sin(a);
            const x2 = 84 + 52 * Math.cos(a), y2 = 60 + 52 * Math.sin(a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={soft} strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />;
          })}
        </g>
      )}
    </svg>
  );
}

const STEPS = [
  {
    title: 'ChatsApp me khush aamdeed',
    desc: 'Apne doston se tez, khubsurat aur mehfooz tareeqe se baat karein — bilkul WhatsApp jaisa, magar apna.',
  },
  {
    title: 'Sab chats, ek nazar me',
    desc: 'Chat par swipe karein: daayein swipe = archive, baayein swipe = mute ya pin. Sab kuch ungliyon par.',
  },
  {
    title: 'Saaf-suthri voice messages',
    desc: 'Record karte waqt background noise auto-filter hoti hai. Aapki awaaz — bilkul saaf.',
  },
  {
    title: 'Privacy aapke haath me',
    desc: 'Chats lock karein, users block karein, disappearing messages lagayein. Aapka data, aapki marzi.',
  },
  {
    title: 'Sab taiyaar hai!',
    desc: 'Neeche + dabakar pehli chat shuru karein. Koi sawaal ho to Settings me dekhein.',
  },
];

/**
 * AppTour — naye user ke liye 5-step premium onboarding tour.
 * Pehli login par ek baar dikhta hai (localStorage flag).
 */
export default function AppTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;

  const next = () => {
    tapHaptic();
    if (last) onDone();
    else setStep((s) => s + 1);
  };
  const skip = () => { tapHaptic(); onDone(); };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col mv2-fade-anim"
      style={{ background: 'linear-gradient(160deg, #0b141a 0%, #10251f 55%, #0b3d31 100%)' }}
      role="dialog" aria-modal="true" aria-label="App tour">
      {/* top: skip */}
      <div className="flex justify-end px-5 pt-5 mv2-safe-top">
        {!last && (
          <button onClick={skip} className="text-white/60 text-[14px] font-medium px-3 py-2 active:text-white">
            Chhodein
          </button>
        )}
      </div>

      {/* art + text */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div key={step} className="mv2-tour-slide flex flex-col items-center">
          <div className="w-52 h-44 rounded-[28px] bg-white/[0.06] border border-white/10 backdrop-blur flex items-center justify-center mb-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <Art step={step} />
          </div>
          <h2 className="text-white text-[24px] font-bold tracking-tight mb-3">{STEPS[step].title}</h2>
          <p className="text-white/65 text-[15px] leading-relaxed max-w-[300px]">{STEPS[step].desc}</p>
        </div>
      </div>

      {/* dots */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => { setStep(i); tapHaptic(); }}
            aria-label={`Step ${i + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-7 bg-[var(--mv2-accent)]' : 'w-2 bg-white/25'}`}
          />
        ))}
      </div>

      {/* actions */}
      <div className="px-8 pb-10 mv2-safe-bottom">
        <button
          onClick={next}
          className="w-full h-[54px] rounded-full bg-[var(--mv2-accent)] text-white text-[16px] font-bold shadow-[0_10px_30px_rgba(0,168,132,0.4)] active:scale-[0.98] transition-transform"
        >
          {last ? 'Shuru karein 🚀' : 'Aage →'}
        </button>
        {!last && (
          <p className="text-center text-white/40 text-[12px] mt-3">{step + 1} / {STEPS.length}</p>
        )}
      </div>
    </div>
  );
}
