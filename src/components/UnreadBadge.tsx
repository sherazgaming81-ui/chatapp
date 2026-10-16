"use client";
// WhatsApp-style unread badge — laal circle, count ke sath, pop animation
export default function UnreadBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  return (
    <span
      key={count}
      className="unread-pop ml-auto grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-[#ed4245] px-1 text-[11px] font-extrabold leading-none text-white"
      aria-label={`${count} unread messages`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
