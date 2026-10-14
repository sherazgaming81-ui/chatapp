'use client';

/**
 * TypingDots — WhatsApp-style animated "..." typing indicator.
 * Mobile + desktop dono use kar sakte hain (CSS var based).
 */
export default function TypingDots({ color = 'var(--mv2-muted)', size = 7 }: { color?: string; size?: number }) {
  return (
    <span className="mv2-typing" aria-label="likh raha hai" style={{ ['--td-color' as string]: color, ['--td-size' as string]: `${size}px` }}>
      <span />
      <span />
      <span />
    </span>
  );
}
