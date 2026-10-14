'use client';

/** v4 SVG icon set — WhatsApp-style outline icons. No emojis in chrome. */

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

export function CameraIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.4" />
    </svg>
  );
}

export function SearchIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)} strokeWidth={2.1}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.8-3.8" />
    </svg>
  );
}

/** Vertical ⋮ */
export function DotsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  );
}

export function BackIcon({ size = 24 }: { size?: number }) {
  return (
    <svg {...base(size)} strokeWidth={2.3}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function PaperclipIcon({ size = 24 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8L13.2 3.7a3.7 3.7 0 0 1 5.2 5.2l-8.3 8.3a1.85 1.85 0 0 1-2.6-2.6l7.6-7.6" />
    </svg>
  );
}

export function MicIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm7 10a7 7 0 0 1-14 0H3a9 9 0 0 0 8 8.94V22h2v-1.06A9 9 0 0 0 21 12h-2z" />
    </svg>
  );
}

/** Send = paper plane (WhatsApp style) */
export function SendIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.4 20.4l17.4-8.4L3.4 3.6l-.01 6.53L14 12 3.39 13.87z" />
    </svg>
  );
}

export function LockIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function ArchiveIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4" width="18" height="4.5" rx="1" />
      <path d="M5 8.5v9a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 17.5v-9" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function PlusIcon({ size = 26 }: { size?: number }) {
  return (
    <svg {...base(size)} strokeWidth={2.4}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function PlayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

export function PauseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function XIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...base(size)} strokeWidth={2.3}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...base(size)} strokeWidth={2.6}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function ReplyIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M9 14l-5-5 5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

export function ForwardIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </svg>
  );
}

export function CopyIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export function StarIcon({ size = 22, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round">
      <path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8z" />
    </svg>
  );
}

export function PinIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M9 4h6l-1 7 3 3v2H7v-2l3-3z" />
      <path d="M12 16v5" />
    </svg>
  );
}

export function TrashIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" />
    </svg>
  );
}

export function InfoIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function EyeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function MuteIcon({ size = 22, muted = false }: { size?: number; muted?: boolean }) {
  return (
    <svg {...base(size)}>
      <path d="M4 10v4h4l5 4V6l-5 4H4z" />
      {muted ? <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" /> : <path d="M16.5 9.5a4 4 0 0 1 0 5" />}
    </svg>
  );
}

export function BellIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function PollIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M5 20v-8M11 20V6M17 20v-5" />
      <path d="M3 20h18" />
    </svg>
  );
}

export function ContactIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6" />
    </svg>
  );
}

export function LocationIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function DocIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v4h4" />
    </svg>
  );
}

export function GalleryIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M4.5 18l5-5 3.5 3.5L16 13l3.5 3.5" />
    </svg>
  );
}

export function ChevronDown({ size = 18 }: { size?: number }) {
  return (
    <svg {...base(size)} strokeWidth={2.3}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Bottom nav: Chats (bubble) */
export function ChatsNavIcon({ size = 24 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" />
    </svg>
  );
}

/** Bottom nav: Groups (people) */
export function GroupsNavIcon({ size = 24 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.9M17.6 14.6c2.2.7 3.9 2.3 3.9 4.4" />
    </svg>
  );
}

/** Bottom nav: Settings (gear) */
export function SettingsNavIcon({ size = 24 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3.9a7.6 7.6 0 0 0-1.7-1L13 3h-2l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a7.6 7.6 0 0 0 1.7 1L11 21h2l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5z" />
    </svg>
  );
}

export function BlockIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.8 5.8l12.4 12.4" />
    </svg>
  );
}

export function ShieldIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function ClockIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function HeartIcon({ size = 22, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.6 3.5 7 5.5 5 8 5c1.6 0 3.1.8 4 2.1C12.9 5.8 14.4 5 16 5c2.5 0 4.5 2 4.5 4.6 0 3.7-3.5 6.9-8.5 10.9z" />
    </svg>
  );
}

export function DevicesIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <rect x="2" y="4" width="13" height="10" rx="1.5" />
      <path d="M6 18h6" />
      <rect x="17" y="9" width="5" height="11" rx="1.5" />
    </svg>
  );
}

export function BackupIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M12 3v10m0 0l-4-4m4 4l4-4" />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}

export function LogoutIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

export function TimerIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9.5V13l2.5 1.5M9 2h6" />
    </svg>
  );
}

export function DownloadIcon({ size = 22 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function EditIcon({ size = 18 }: { size?: number }) {
  return (
    <svg {...base(size)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
