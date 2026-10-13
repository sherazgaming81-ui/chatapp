// UnreadJumpButton — 'use client'
// Floating circular button that jumps the message list down to the newest
// unread messages. Renders nothing when there are no unread messages.
//
// Props:
//   unreadCount: number — number of unread messages (>0 shows the button)
//   onClick: () => void — scrolls the list to the newest messages
//
// Example:
//   <UnreadJumpButton unreadCount={unreadCount} onClick={scrollToBottom} />
'use client';

interface UnreadJumpButtonProps {
  unreadCount: number;
  onClick: () => void;
}

export default function UnreadJumpButton({ unreadCount, onClick }: UnreadJumpButtonProps) {
  if (unreadCount === 0) return null;

  const label = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <button
      onClick={onClick}
      aria-label={`${unreadCount} naye messages par jayein`}
      title={`${unreadCount} naye messages`}
      className="absolute right-4 bottom-20 z-40 w-12 h-12 rounded-full bg-[#00a884] text-white shadow-xl flex items-center justify-center hover:bg-[#06cf9c] active:scale-95 transition-transform"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="5 12 12 19 19 12" />
      </svg>
      <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-[#202c33] border-2 border-[#00a884] text-[11px] font-semibold text-white flex items-center justify-center">
        {label}
      </span>
    </button>
  );
}
