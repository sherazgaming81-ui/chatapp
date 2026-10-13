export function Ticks({ state }: { state: 'sent' | 'delivered' | 'read' }) {
  const color = state === 'read' ? 'text-[#53bdeb]' : 'text-[#8696a0]';
  if (state === 'sent') {
    return (
      <svg width="16" height="11" viewBox="0 0 16 11" className={color}>
        <path d="M1.5 6l3 3 7-8" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" className={color}>
      <path
        d="M1.5 6.5l2.5 2.5 5-5.5M7 9l2.5 2.5L15 5"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
