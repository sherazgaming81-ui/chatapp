'use client';

import { useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { tapHaptic, errorHaptic } from './haptics';

/**
 * ProfilePicButton — premium custom profile-photo upload button.
 * Mobile + desktop dono ke liye. Koi generic camera icon nahi:
 * hand-drawn "aperture" motif, glass badge, hover par expand hota pill,
 * upload ke waqt progress ring. Clean, unique, apna design.
 */
export default function ProfilePicButton({
  photoURL,
  name,
  size = 72,
  onUpload,
  label = 'Badlein',
}: {
  photoURL?: string;
  name: string;
  size?: number;
  onUpload: (file: File) => Promise<void>;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const pick = () => {
    if (busy) return;
    tapHaptic();
    inputRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setFailed(false);
    try {
      await onUpload(f);
    } catch {
      setFailed(true);
      errorHaptic();
      setTimeout(() => setFailed(false), 1600);
    }
    setBusy(false);
  };

  return (
    <span className="group relative inline-block shrink-0" style={{ width: size, height: size }}>
      {/* avatar + fine ring */}
      <span
        className={`block w-full h-full rounded-full overflow-hidden transition-all duration-300 group-hover:scale-[1.03] group-active:scale-[0.98] ${
          failed ? 'mv2-shake ring-2 ring-[var(--mv2-danger)]' : 'ring-2 ring-[var(--mv2-accent)]/25 group-hover:ring-[var(--mv2-accent)]/70'
        }`}
      >
        <Avatar name={name} photoURL={photoURL} size={size} />
      </span>

      {/* glass aperture badge -> hover par pill */}
      <button
        onClick={pick}
        disabled={busy}
        aria-label="Profile photo badlein"
        className="absolute -bottom-1 -right-1 h-9 max-w-[36px] group-hover:max-w-[118px] rounded-full
          flex items-center gap-1.5 pl-[7px] pr-[7px] overflow-hidden whitespace-nowrap
          bg-black/70 backdrop-blur-md border border-white/25 text-white
          shadow-[0_4px_14px_rgba(0,0,0,0.45)]
          transition-all duration-300 ease-out
          hover:bg-[var(--mv2-accent)] hover:border-[var(--mv2-accent)]
          active:scale-90 disabled:opacity-90"
      >
        {busy ? (
          <svg width="20" height="20" viewBox="0 0 24 24" className="mv2-spin shrink-0">
            <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" />
            <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <ApertureMark />
        )}
        <span className="text-[12.5px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 pr-1">
          {busy ? '...' : label}
        </span>
      </button>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </span>
  );
}

/** Hand-drawn aperture motif — 6 shutter blades ka swirl. Unique, template-free. */
function ApertureMark() {
  const blades = Array.from({ length: 6 }, (_, i) => {
    const a = (i * 60 * Math.PI) / 180;
    const b = a + 0.62;
    return {
      x1: 12 + 2.4 * Math.cos(a),
      y1: 12 + 2.4 * Math.sin(a),
      x2: 12 + 7.6 * Math.cos(b),
      y2: 12 + 7.6 * Math.sin(b),
    };
  });
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
      <circle cx="12" cy="12" r="9" strokeWidth="1.4" opacity="0.9" />
      {blades.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
      ))}
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
