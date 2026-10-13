'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0b141a] text-center px-6">
      <div className="w-16 h-16 rounded-full bg-[#ff5c8a]/15 flex items-center justify-center mb-5">
        <span className="text-3xl">⚠️</span>
      </div>
      <h1 className="text-white text-xl font-semibold mb-2">Kuch ghalat ho gaya</h1>
      <p className="text-[#8696a0] text-sm max-w-sm mb-6">
        Page khulne me masla aaya. Dobara try karein — agar phir bhi na khule to logout karke login karein.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="bg-[#00a884] text-[#0b141a] font-semibold rounded-full px-6 py-2.5 hover:bg-[#06cf9c] transition"
        >
          Dobara try karein
        </button>
        <button
          onClick={() => (window.location.href = '/')}
          className="bg-[#202c33] text-white rounded-full px-6 py-2.5 hover:bg-[#2a3942] transition"
        >
          Home
        </button>
      </div>
      {error?.digest && (
        <p className="text-[#8696a0]/60 text-xs mt-6">Code: {error.digest}</p>
      )}
    </div>
  );
}
