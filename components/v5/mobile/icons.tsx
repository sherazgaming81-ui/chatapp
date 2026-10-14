'use client';

type P = { size?: number; color?: string; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

function I({ size = 24, color, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg {...base(size)} style={color ? { color } : undefined} className={className}>
      {children}
    </svg>
  );
}

export const MicIcon = (p: P) => (
  <I {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" stroke="none" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <path d="M12 17v4" />
  </I>
);

export const SendIcon = (p: P) => (
  <I {...p}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7z" />
  </I>
);

export const CheckIcon = (p: P) => (
  <I {...p}>
    <path d="M20 6 9 17l-5-5" />
  </I>
);

export const DoubleCheckIcon = (p: P & { blue?: boolean }) => (
  <svg
    width={p.size ?? 24}
    height={p.size ?? 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke={p.blue ? '#53bdeb' : 'currentColor'}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={p.className}
  >
    <path d="M18 6 7 17l-4-4" />
    <path d="M22 10l-7.5 7.5L13 16" />
  </svg>
);

export const TrashIcon = (p: P) => (
  <I {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </I>
);

export const StopIcon = (p: P) => (
  <svg width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24" fill="currentColor" className={p.className}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const PlayIcon = (p: P) => (
  <svg width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24" fill="currentColor" className={p.className}>
    <path d="M7 4.5v15l13-7.5-13-7.5z" />
  </svg>
);

export const PauseIcon = (p: P) => (
  <svg width={p.size ?? 24} height={p.size ?? 24} viewBox="0 0 24 24" fill="currentColor" className={p.className}>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

export const CameraIcon = (p: P) => (
  <I {...p}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </I>
);

export const ImageIcon = (p: P) => (
  <I {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </I>
);

export const BellIcon = (p: P) => (
  <I {...p}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </I>
);

export const BellOffIcon = (p: P) => (
  <I {...p}>
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    <path d="M8.7 3A6 6 0 0 1 18 8c0 4 .7 6.4 1.6 7.7" />
    <path d="M6.3 6.3C6.1 6.9 6 7.4 6 8c0 7-3 9-3 9h14" />
    <path d="m2 2 20 20" />
  </I>
);

export const CrownIcon = (p: P) => (
  <svg width={p.size ?? 12} height={p.size ?? 12} viewBox="0 0 24 24" fill="currentColor" className={p.className}>
    <path d="M2 8l4.5 4L12 4l5.5 8L22 8l-2 11H4L2 8z" />
  </svg>
);

export const ShieldIcon = (p: P) => (
  <I {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </I>
);

export const XIcon = (p: P) => (
  <I {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </I>
);

export const PlusIcon = (p: P) => (
  <I {...p}>
    <path d="M12 5v14M5 12h14" />
  </I>
);

export const ChevronRightIcon = (p: P) => (
  <I {...p}>
    <path d="m9 18 6-6-6-6" />
  </I>
);

export const RefreshIcon = (p: P) => (
  <I {...p}>
    <path d="M23 4v6h-6" />
    <path d="M20.5 15a9 9 0 1 1-1.4-8.4L23 10" />
  </I>
);

export const SlashIcon = (p: P) => (
  <I {...p}>
    <path d="M16 3h5v5" />
    <path d="M8 3H3v5" />
    <path d="m21 3-7 7" />
    <path d="m3 3 7 7" />
  </I>
);

export const UsersIcon = (p: P) => (
  <I {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.9" />
    <path d="M16 3.1a4 4 0 0 1 0 7.8" />
  </I>
);

export const GiftIcon = (p: P) => (
  <I {...p}>
    <path d="M20 12v10H4V12" />
    <rect x="2" y="7" width="20" height="5" />
    <path d="M12 22V7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </I>
);

export const SparkleIcon = (p: P) => (
  <I {...p}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
  </I>
);

export const LockIcon = (p: P) => (
  <I {...p}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </I>
);

export const InfoIcon = (p: P) => (
  <I {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </I>
);

/** ChatsApp logo — stroke-drawn chat bubble with lightning bolt (for logo-draw animation). */
export function ChatsAppLogo({ size = 88, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={`v5-logo-draw ${className}`}
    >
      <path
        className="v5-draw-stroke"
        d="M50 8c-24 0-40 15.5-40 36 0 11 5 20.6 12.8 27.2L20 88l16.4-7.3C40.6 82 45.2 82.5 50 82.5c24 0 40-15.5 40-36.5S74 8 50 8z"
        stroke="#00a884"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="v5-logo-fill"
        d="M55 30 38 52h10l-3 16 17-22H52l3-16z"
        fill="#00a884"
      />
    </svg>
  );
}
