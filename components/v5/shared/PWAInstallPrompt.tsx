'use client';

// PWAInstallPrompt — onboarding ke BAAD dikhta hai.
// 2 glassmorphism cards: "Download App" (PWA install) aur "Stay on Website",
// phir Chrome se install karne ka tareeqa, aur "Samajh gaya" button.
// v6 me add hua (user request).

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWA_CHOICE_KEY = 'v6_pwa_choice';

export function hasPWAChoice(): boolean {
  try {
    return localStorage.getItem(PWA_CHOICE_KEY) === '1';
  } catch {
    return false;
  }
}

function markPWAChoice(): void {
  try {
    localStorage.setItem(PWA_CHOICE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function PWAInstallPrompt({ onDone }: { onDone: () => void }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // Agar pehle se installed (standalone mode) hai to seedha done
    if (window.matchMedia('(display-mode: standalone)').matches) {
      markPWAChoice();
      onDone();
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [onDone]);

  async function handleInstall() {
    if (deferred) {
      try {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === 'accepted') {
          setInstalled(true);
        }
        setDeferred(null);
      } catch {
        /* ignore */
      }
    }
    // Chahe install ho ya prompt na aaya ho — how-to dikhao
    setShowHowTo(true);
  }

  function handleStay() {
    setShowHowTo(true);
  }

  function handleDone() {
    markPWAChoice();
    onDone();
  }

  return (
    <div className="h-dvh w-full flex flex-col items-center justify-center bg-[#0b141a] px-5 relative overflow-hidden">
      {/* background glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#00a884]/15 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#00a884]/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#00a884] to-[#008069] flex items-center justify-center shadow-[0_8px_32px_rgba(0,168,132,0.4)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.5 14.1c-.2.6-1.3 1.2-1.9 1.2-.5.1-1.1.2-3.7-.8-3.1-1.3-5.1-4.5-5.3-4.7-.1-.2-1.2-1.7-1.2-3.2s.8-2.3 1-2.6c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5-.3.6-.6.8-.4 1.1.6 1.1 1.4 1.9 2.5 2.4.3.2.5.1.7-.1l.8-.9c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.4 0 .1 0 .5-.4 1.8z" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-2">
          ChatsApp apne phone me rakho
        </h2>
        <p className="text-[#8696a0] text-sm text-center mb-8 leading-relaxed">
          App install karo — tez khulegi, notifications behtar milengi,
          bilkul asli app jaisa feel.
        </p>

        {!showHowTo ? (
          <div className="grid grid-cols-2 gap-4">
            {/* Download App card */}
            <button
              onClick={handleInstall}
              className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-3xl p-6 flex flex-col items-center gap-3 hover:bg-white/[0.12] hover:border-[#00a884]/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            >
              <span className="text-4xl">📲</span>
              <span className="text-white font-semibold text-[15px]">Download App</span>
              <span className="text-[#8696a0] text-xs text-center leading-relaxed">
                Phone me install karo
              </span>
            </button>

            {/* Stay on Website card */}
            <button
              onClick={handleStay}
              className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-3xl p-6 flex flex-col items-center gap-3 hover:bg-white/[0.12] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
            >
              <span className="text-4xl">🌐</span>
              <span className="text-white font-semibold text-[15px]">Website par raho</span>
              <span className="text-[#8696a0] text-xs text-center leading-relaxed">
                Browser me hi chalao
              </span>
            </button>
          </div>
        ) : (
          <div className="backdrop-blur-xl bg-white/[0.07] border border-white/[0.12] rounded-3xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
            {installed ? (
              <>
                <p className="text-white font-semibold text-[15px] mb-2 text-center">
                  🎉 Mubarak ho! App install ho gayi
                </p>
                <p className="text-[#8696a0] text-[13px] text-center leading-relaxed">
                  Ab home screen se seedha ChatsApp kholo.
                </p>
              </>
            ) : (
              <>
                <p className="text-white font-semibold text-[15px] mb-3">
                  📌 Baad me app chahiye to:
                </p>
                <ol className="text-[#aebac1] text-[13.5px] leading-relaxed space-y-2.5 list-none">
                  <li className="flex gap-2.5">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-[#00a884]/20 text-[#00a884] text-xs font-bold flex items-center justify-center">1</span>
                    <span>Chrome me <b className="text-white">⋮ (teen dots)</b> dabao — upar right corner me</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-[#00a884]/20 text-[#00a884] text-xs font-bold flex items-center justify-center">2</span>
                    <span><b className="text-white">"Add to Home screen"</b> ya <b className="text-white">"Install app"</b> chuno</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-[#00a884]/20 text-[#00a884] text-xs font-bold flex items-center justify-center">3</span>
                    <span><b className="text-white">"Install"</b> dabao — bas, app tayyar!</span>
                  </li>
                </ol>
              </>
            )}

            <button
              onClick={handleDone}
              className="w-full mt-6 bg-[#00a884] hover:bg-[#06cf9c] active:scale-[0.98] text-[#0b141a] font-bold text-[15px] rounded-full py-3.5 transition-all duration-200"
            >
              Samajh gaya ✓
            </button>
          </div>
        )}

        {!showHowTo && (
          <p className="text-[#667781] text-xs text-center mt-6">
            Dono me same ChatsApp — farq sirf khulne ke tareeqe ka hai
          </p>
        )}
      </div>
    </div>
  );
}
