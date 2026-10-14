'use client';

/**
 * v2/desktop shared bits: icons, backendV2 safe-call helper, tiny UI atoms.
 * Do NOT import anything v1-specific here beyond types.
 */

import { useMemo } from 'react';
import { backend } from '@/lib/backend';
import type { BackendV2 } from '@/lib/v2/types';

export const backendV2 = backend as unknown as BackendV2;

/** BackendV2 call ko safely chalao — method missing ya fail ho to null. */
export async function v2call<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export function useV2() {
  return useMemo(() => backendV2, []);
}

// ---------- Icons (24px, stroke style, WhatsApp-Web jaisa) ----------

export function Icon({
  d,
  size = 22,
  className = '',
  filled = false,
}: {
  d: string | string[];
  size?: number;
  className?: string;
  filled?: boolean;
}) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={filled ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

export const ICONS = {
  search: 'M11 4a7 7 0 1 0 4.9 12L21 21l-1.4 1.4-5.1-5.1A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  plus: 'M12 5v14M5 12h14',
  users:
    'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.87M15.5 3.13a3.5 3.5 0 0 1 0 6.74',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08A1.7 1.7 0 0 0 10.12 3V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56.6.26 1.3.13 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08c.26.6.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09c-.68 0-1.3.4-1.51 1.03z',
  mic: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10a7 7 0 0 1-14 0M12 17v4M8 21h8',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
  emoji:
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  clip: 'M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 1 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.49-8.48',
  camera:
    'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  x: 'M18 6 6 18M6 6l12 12',
  chevDown: 'M6 9l6 6 6-6',
  chevRight: 'M9 18l6-6-6-6',
  reply: 'M9 17l-5-5 5-5M4 12h9a7 7 0 0 1 7 7v0',
  forward: 'M15 17l5-5-5-5M20 12h-9a7 7 0 0 0-7 7v0',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z',
  pin: 'M9 4h6l1 7 3 3v2H5v-2l3-3 1-7zM12 16v5',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  edit: 'M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  mute: 'M11 5 6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6',
  lock: 'M5 11h14v10H5V11zM8 11V7a4 4 0 0 1 8 0v4',
  check: 'M20 6 9 17l-5-5',
  image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6',
  play: 'M6 4l14 8-14 8V4z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  crown: 'M3 8l4 4 5-6 5 6 4-4-1.5 10h-15L3 8z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a2 2 0 0 0 3.4 0',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  timer: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 7v5l3 2M9 2h6',
  poll: 'M18 20V10M12 20V4M6 20v-6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  userPlus: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
};

// ---------- tiny atoms ----------

export function RowBtn({
  icon,
  label,
  sub,
  danger,
  onClick,
}: {
  icon?: string;
  label: string;
  sub?: string;
  danger?: boolean;
  onClick(): void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
        danger ? 'text-[#ea0038] hover:bg-[var(--v2-danger-bg)]' : 'text-[var(--v2-text)] hover:bg-[var(--v2-hover)]'
      }`}
    >
      {icon && <Icon d={ICONS[icon as keyof typeof ICONS]} size={20} className={danger ? '' : 'text-[var(--v2-muted)]'} />}
      <span className="min-w-0">
        <span className="block text-[14px] leading-tight truncate">{label}</span>
        {sub && <span className="block text-[12px] text-[var(--v2-muted)] truncate mt-0.5">{sub}</span>}
      </span>
    </button>
  );
}

/** Section heading inside panels/modals. */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 pt-5 pb-2 text-[12.5px] font-semibold uppercase tracking-wide text-[var(--v2-accent)]">
      {children}
    </div>
  );
}

/** Simple modal shell. */
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose(): void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={`relative bg-[var(--v2-panel)] text-[var(--v2-text)] rounded-2xl shadow-2xl border border-[var(--v2-border)] w-full ${
          wide ? 'max-w-[640px]' : 'max-w-[440px]'
        } max-h-[86vh] flex flex-col overflow-hidden animate-[v2pop_.18s_ease-out]`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--v2-border)] shrink-0">
          <h2 className="text-[16px] font-semibold truncate">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--v2-muted)] hover:bg-[var(--v2-hover)] transition"
            aria-label="Band karein"
          >
            <Icon d={ICONS.x} size={20} />
          </button>
        </div>
        <div className="overflow-y-auto v2scroll">{children}</div>
      </div>
    </div>
  );
}

/** Popover anchored absolutely (parent needs relative). */
export function Popover({
  onClose,
  children,
  className = '',
}: {
  onClose(): void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      <div
        className={`absolute z-[61] bg-[var(--v2-panel)] border border-[var(--v2-border)] rounded-xl shadow-2xl py-1.5 min-w-[220px] max-w-[300px] animate-[v2pop_.15s_ease-out] ${className}`}
      >
        {children}
      </div>
    </>
  );
}
