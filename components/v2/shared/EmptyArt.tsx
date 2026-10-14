'use client';

/**
 * EmptyArt — khaali chat / khaali list ke liye hand-designed SVG illustration.
 * Minimal line-art: chat bubbles + paper plane + sparkles. Premium, template-free.
 */
export default function EmptyArt({ size = 148, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size * 0.86}
      viewBox="0 0 200 172"
      fill="none"
      className={className}
      role="img"
      aria-label="Khaali chat illustration"
    >
      {/* soft backdrop */}
      <circle cx="100" cy="86" r="72" fill="var(--mv2-accent-soft)" opacity="0.55" />
      <circle cx="100" cy="86" r="72" fill="url(#eaGlow)" opacity="0.35" />
      <defs>
        <radialGradient id="eaGlow" cx="0.5" cy="0.42" r="0.6">
          <stop offset="0%" stopColor="var(--mv2-accent)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--mv2-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* pichla chhota bubble */}
      <g opacity="0.55">
        <rect x="118" y="96" width="58" height="38" rx="13" stroke="var(--mv2-muted)" strokeWidth="3" />
        <path d="M132 134l-3 12 13-9" stroke="var(--mv2-muted)" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="136" cy="115" r="3.4" fill="var(--mv2-muted)" />
        <circle cx="148" cy="115" r="3.4" fill="var(--mv2-muted)" />
        <circle cx="160" cy="115" r="3.4" fill="var(--mv2-muted)" />
      </g>

      {/* agla bara bubble */}
      <rect x="30" y="52" width="104" height="62" rx="18" stroke="var(--mv2-accent)" strokeWidth="4" />
      <path d="M52 114l-6 18 20-14" stroke="var(--mv2-accent)" strokeWidth="4" strokeLinejoin="round" />
      {/* typing dots */}
      <circle cx="62" cy="83" r="5" fill="var(--mv2-accent)" />
      <circle cx="82" cy="83" r="5" fill="var(--mv2-accent)" opacity="0.45" />
      <circle cx="102" cy="83" r="5" fill="var(--mv2-accent)" opacity="0.45" />

      {/* paper plane */}
      <g transform="rotate(-14 158 40)">
        <path
          d="M158 22l26 16-26 16-6-13z"
          fill="var(--mv2-accent)"
        />
        <path d="M152 38l6-16 4 13z" fill="var(--mv2-text)" opacity="0.35" />
      </g>
      {/* motion lines */}
      <path d="M118 34c8-2 14-6 18-12" stroke="var(--mv2-muted)" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
      <path d="M112 48c6 0 11-1 15-4" stroke="var(--mv2-muted)" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />

      {/* sparkles */}
      <g stroke="var(--mv2-accent)" strokeWidth="2.4" strokeLinecap="round" opacity="0.8">
        <path d="M40 26v10M35 31h10" />
        <path d="M168 84v8M164 88h8" opacity="0.6" />
      </g>
      <circle cx="52" cy="140" r="3" fill="var(--mv2-muted)" opacity="0.5" />
      <circle cx="172" cy="52" r="2.4" fill="var(--mv2-accent)" opacity="0.5" />
    </svg>
  );
}
