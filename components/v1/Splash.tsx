// Splash — v1 splash screen for the Chat app.
// Props: { ready?: boolean }
// Example:
//   const [appReady, setAppReady] = useState(false);
//   // app taiyaar hote hi setAppReady(true) karein
//   return (
//     <>
//       <Splash ready={appReady} />
//       {/* baaqi app */}
//     </>
//   );
// Fade ~400ms me hota hai: 1.2s ke baad khud, ya ready===true par foran.
// Fade ke baad component khud null render karke unmount ho jata hai.

'use client';

import { useEffect, useState } from 'react';

type SplashProps = {
  ready?: boolean;
};

function LogoMark() {
  return (
    <svg
      width="76"
      height="76"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="animate-pulse"
    >
      <path
        d="M32 5C17.1 5 5 15.9 5 29.4c0 7.6 3.9 14.4 10 18.8-.4 2.5-1.5 6.6-4.4 9.8 0 0 6.9-.3 11.9-3.5 2.9.8 6 1.3 9.5 1.3 14.9 0 27-10.9 27-24.4S46.9 5 32 5Z"
        fill="#00a884"
      />
      <circle cx="23" cy="29" r="3.2" fill="#0b141a" />
      <circle cx="32" cy="29" r="3.2" fill="#0b141a" />
      <circle cx="41" cy="29" r="3.2" fill="#0b141a" />
    </svg>
  );
}

export default function Splash({ ready = false }: SplashProps) {
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let goneTimer: ReturnType<typeof setTimeout> | undefined;

    const startFade = () => {
      setFading(true);
      goneTimer = setTimeout(() => setGone(true), 400);
    };

    if (ready) {
      startFade();
    } else {
      fadeTimer = setTimeout(startFade, 1200);
    }

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(goneTimer);
    };
  }, [ready]);

  if (gone) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0b141a] transition-opacity duration-400"
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? 'none' : 'auto' }}
      aria-hidden="true"
    >
      <LogoMark />
      <h1 className="mt-6 px-6 text-center font-serif text-2xl tracking-wide text-white md:text-3xl">
        Madrasa-e-Tahfeez-ul-Quran Ilmuddin
      </h1>
      <p className="mt-3 text-sm tracking-wide text-[#8696a0]">
        Deeni bhaion ka apna messenger
      </p>
      <div className="mt-8 h-1 w-24 overflow-hidden rounded-full bg-[#202c33]">
        <div className="h-full w-1/2 animate-[splashslide_1s_ease-in-out_infinite] rounded-full bg-[#00a884]" />
      </div>
      <style>{`@keyframes splashslide{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}`}</style>
    </div>
  );
}
