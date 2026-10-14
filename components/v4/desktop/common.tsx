'use client';

/**
 * v4/desktop shared bits: WhatsApp-Web-style SVG icons, atoms, backend helpers,
 * aur saari v4 CSS (animations, scrollbar, doodle wallpaper).
 * Sirf components/v4/desktop/* isay import karta hai.
 */

import { useMemo } from 'react';
import { backend } from '@/lib/backend';
import type { BackendV2, BackendV3 } from '@/lib/v2/types';

export const backendV2 = backend as unknown as BackendV2;
export const backendV3 = backend as unknown as BackendV3;

/** Backend v2/v3 call ko safely chalao — method missing ya fail ho to null. */
export async function v4call<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export function useV4() {
  return useMemo(() => backendV2, []);
}

// ---------- Icons (24px stroke, WhatsApp Web jaisa) ----------

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
  // nav / chrome
  chat: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  groups:
    'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 19v-1a4 4 0 0 0-3-3.87M15.5 3.13a3.5 3.5 0 0 1 0 6.74',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08A1.7 1.7 0 0 0 10.12 3V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56.6.26 1.3.13 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08c.26.6.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09c-.68 0-1.3.4-1.51 1.03z',
  search: 'M11 4a7 7 0 1 0 4.9 12L21 21l-1.4 1.4-5.1-5.1A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  pencil: 'M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  dots: 'M12 5.4A1.4 1.4 0 1 0 12 8.2 1.4 1.4 0 0 0 12 5.4zM12 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM12 15.8a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z',
  archive: 'M21 8v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8M1 3h22v5H1zM10 12h4',
  pin: 'M9 4h6l1 7 3 3v2H5v-2l3-3 1-7zM12 16v5',
  mute: 'M11 5 6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6',
  lock: 'M5 11h14v10H5V11zM8 11V7a4 4 0 0 1 8 0v4',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  chevDown: 'M6 9l6 6 6-6',
  chevRight: 'M9 18l6-6-6-6',
  chevLeft: 'M15 18l-6-6 6-6',
  chevUp: 'M18 15l-6-6-6 6',
  // compose
  emoji: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  plus: 'M12 5v14M5 12h14',
  mic: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10a7 7 0 0 1-14 0M12 17v4M8 21h8',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
  clip: 'M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 1 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.49-8.48',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2v11zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  image: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6',
  play: 'M6 4l14 8-14 8V4z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  poll: 'M18 20V10M12 20V4M6 20v-6',
  // message actions
  reply: 'M9 17l-5-5 5-5M4 12h9a7 7 0 0 1 7 7v0',
  forward: 'M15 17l5-5-5-5M20 12h-9a7 7 0 0 0-7 7v0',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6',
  edit: 'M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  // misc
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  timer: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 7v5l3 2M9 2h6',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  calendar: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  crown: 'M3 8l4 4 5-6 5 6 4-4-1.5 10h-15L3 8z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a2 2 0 0 0 3.4 0',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  userPlus: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6',
  contact: 'M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM8 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14 9h4M14 13h4',
  location: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
  devices: 'M5 3h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 21h8M12 17v4',
  key: 'M21 2l-2 2M12.6 11.4a5.5 5.5 0 1 0 7.8 7.8 5.5 5.5 0 0 0-7.8-7.8zm0 0L19 3m-4 1 3 3',
  chart: 'M3 3v18h18M8 17V9M13 17V5M18 17v-7',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  eyeOff: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12A3 3 0 1 1 9.88 9.88M1 1l22 22',
};

export type IconName = keyof typeof ICONS;

// ---------- tiny atoms ----------

export function RowBtn({
  icon,
  label,
  sub,
  danger,
  onClick,
}: {
  icon?: IconName;
  label: string;
  sub?: string;
  danger?: boolean;
  onClick(): void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-6 py-3.5 text-left transition-colors ${
        danger ? 'text-[#ea0038] hover:bg-[#ea0038]/[0.07]' : 'text-[#e9edef] hover:bg-[#1f2c34]'
      }`}
    >
      {icon && (
        <Icon
          d={ICONS[icon]}
          size={22}
          className={danger ? '' : 'text-[#8696a0]'}
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-tight truncate">{label}</span>
        {sub && <span className="block text-[13px] text-[#8696a0] truncate mt-0.5">{sub}</span>}
      </span>
    </button>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 pt-6 pb-2 text-[13px] font-medium text-[#00a884]">{children}</div>
  );
}

export function Toggle({ value, onToggle }: { value: boolean; onToggle(): void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`w-11 h-6 rounded-full p-[3px] transition-colors shrink-0 ${value ? 'bg-[#00a884]' : 'bg-[#374045]'}`}
      role="switch"
      aria-checked={value}
    >
      <span
        className={`block w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}

/** Simple modal shell (WhatsApp Web style). */
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
      <div className="absolute inset-0 bg-black/60 animate-[v4fade_.15s_ease-out]" onClick={onClose} />
      <div
        className={`relative bg-[#111b21] text-[#e9edef] rounded-2xl shadow-2xl border border-[#222d34] w-full ${
          wide ? 'max-w-[620px]' : 'max-w-[440px]'
        } max-h-[86vh] flex flex-col overflow-hidden animate-[v4pop_.18s_ease-out]`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222d34] shrink-0">
          <h2 className="text-[16px] font-medium truncate">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8696a0] hover:bg-[#1f2c34] hover:text-[#e9edef] transition"
            aria-label="Band karein"
          >
            <Icon d={ICONS.x} size={20} />
          </button>
        </div>
        <div className="overflow-y-auto v4scroll">{children}</div>
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
        className={`absolute z-[61] bg-[#111b21] border border-[#222d34] rounded-xl shadow-2xl py-1.5 min-w-[230px] max-w-[300px] animate-[v4pop_.15s_ease-out] ${className}`}
      >
        {children}
      </div>
    </>
  );
}

export function MenuItem({
  label,
  icon,
  sub,
  danger,
  onClick,
}: {
  label: string;
  icon?: IconName;
  sub?: string;
  danger?: boolean;
  onClick(): void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-left transition ${
        danger ? 'text-[#ea0038] hover:bg-[#ea0038]/[0.07]' : 'text-[#e9edef] hover:bg-[#1f2c34]'
      }`}
    >
      {icon && <Icon d={ICONS[icon]} size={19} className={danger ? '' : 'text-[#8696a0]'} />}
      <span className="min-w-0">
        <span className="block leading-tight truncate">{label}</span>
        {sub && <span className="block text-[12px] text-[#8696a0] truncate mt-0.5">{sub}</span>}
      </span>
    </button>
  );
}

// ---------- Doodle wallpaper ----------

const DOODLE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260'%3E%3Cg fill='none' stroke='%238696a0' stroke-opacity='0.13' stroke-width='1.4'%3E%3Cpath d='M28 34a12 12 0 0 0 12 12h14l6 7v-7h6a12 12 0 0 0 12-12v-8a12 12 0 0 0-12-12H40a12 12 0 0 0-12 12z'/%3E%3Ccircle cx='150' cy='40' r='14'/%3E%3Ccircle cx='146' cy='36' r='2.5' fill='%238696a0' stroke='none'/%3E%3Ccircle cx='156' cy='36' r='2.5' fill='%238696a0' stroke='none'/%3E%3Cpath d='M144 46q7 5 14 0'/%3E%3Crect x='200' y='90' width='26' height='20' rx='4'/%3E%3Ccircle cx='213' cy='100' r='5'/%3E%3Cpath d='M30 130l10-14 8 8 10-12 8 10'/%3E%3Crect x='24' y='108' width='52' height='40' rx='5'/%3E%3Ccircle cx='120' cy='150' r='4'/%3E%3Cpath d='M128 142l16 16M144 142l-16 16'/%3E%3Cpath d='M190 160q10-12 20 0t20 0'/%3E%3Ccircle cx='60' cy='200' r='10'/%3E%3Cpath d='M60 190v20M50 200h20'/%3E%3Cpath d='M160 210l6-12 6 12-6 12z'/%3E%3Crect x='210' y='190' width='22' height='30' rx='6'/%3E%3Ccircle cx='221' cy='196' r='2' fill='%238696a0' stroke='none'/%3E%3C/g%3E%3C/svg%3E")`;

/** v4 global styles: keyframes, scrollbar, wallpaper. */
export function V4Styles() {  return (
    <style>{`
      .v4root { font-family: "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif; }
      @keyframes v4fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes v4pop { from { opacity: 0; transform: scale(.96) translateY(6px); } to { opacity: 1; transform: none; } }
      @keyframes v4slideL { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: none; } }
      @keyframes v4msgin { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
      @keyframes v4welcomefade { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
      @keyframes v4flash { 0%,55% { filter: brightness(1.7); } 100% { filter: none; } }
      @keyframes v4typing { 0%,60%,100% { transform: translateY(0); opacity:.55; } 30% { transform: translateY(-4px); opacity:1; } }
      .v4msgin { animation: v4msgin .22s cubic-bezier(.2,.7,.3,1) both; }
      .v4flash { animation: v4flash 1.6s ease-out; }
      .v4scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .v4scroll::-webkit-scrollbar-thumb { background: #2a3942; border-radius: 3px; }
      .v4scroll::-webkit-scrollbar-track { background: transparent; }
      .v4wallpaper { background-color: #0b141a; background-image: ${DOODLE}; }
      .v4root input::placeholder, .v4root textarea::placeholder { color: #8696a0; opacity: 1; }
      .v4tail { position: relative; }
      .v4tail-out::before, .v4tail-in::before { content: ""; position: absolute; top: 0; width: 9px; height: 13px; }
      .v4tail-out::before { right: -7px; background: #005c4b; clip-path: polygon(0 0, 100% 0, 0 100%); }
      .v4tail-in::before { left: -7px; background: #1f2c34; clip-path: polygon(0 0, 100% 0, 100% 100%); }
    `}</style>
  );
}

// ---------- Hinglish date/time ----------

const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();

function dayDiff(ts: number): number {
  const d = new Date(ts);
  const now = new Date();
  return Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
}

export function fmtClock(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/** Chat list row time: waqt / Kal / hafta ka din / tareekh. */
export function fmtListHinglish(ts: number): string {
  const diff = dayDiff(ts);
  if (diff === 0) return fmtClock(ts);
  if (diff === 1) return 'Kal';
  if (diff < 7) {
    const days = ['Itwar', 'Peer', 'Mangal', 'Budh', 'Jumeraat', 'Juma', 'Hafta'];
    return days[new Date(ts).getDay()];
  }
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/** Date divider chip: AAJ / KAL / tareekh. */
export function fmtDayHinglish(ts: number): string {
  const diff = dayDiff(ts);
  if (diff === 0) return 'AAJ';
  if (diff === 1) return 'KAL';
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
}

/** Last-seen / online subtitle (Hinglish). */
export function fmtSeenHinglish(ts: number, online: boolean): string {
  if (online) return 'online';
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000) return 'abhi active tha';
  if (diff < 3600000) {
    const m = Math.floor(diff / 60000);
    return `aakhri baar ${m} min pehle`;
  }
  if (diff < 86400000) {
    const h = Math.floor(diff / 3600000);
    return `aakhri baar ${h} ghante pehle`;
  }
  return `aakhri baar ${new Date(ts).toLocaleDateString()}`;
}
