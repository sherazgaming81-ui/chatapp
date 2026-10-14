'use client';

import { useState } from 'react';

const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😐','😑','🙄','😴','😷','🤒','🤕',
  '😢','😭','😡','😱','👍','👎','👏','🙏','👋','🤝','💪','✌️','🤞','👌',
  '❤️','💔','💯','🔥','🎉','🎊','✨','⭐','💡','✅','❌','❓','❗',
  '🙂','🙃','😉','😌','😜','🤪','😝','🤑','🤗','🤭','🤫','🤥','😬',
  '🥳','😈','👻','💀','🤖','🎃','😺','🙈','🐶','🌹','🍕','⚽','🚗','✈️',
];

interface Sticker { id: string; label: string; svg: string }

function face(bg: string, eyes: string, mouth: string, extra = ''): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="${bg}"/><circle cx="36" cy="42" r="6" fill="#222"/>${eyes}<path d="${mouth}" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>${extra}</svg>`;
}

const STICKERS: Sticker[] = [
  { id: 'happy', label: 'Khush', svg: face('#ffd93b', '', 'M32 62 Q50 78 68 62') },
  { id: 'laugh', label: 'Hansi', svg: face('#ffd93b', '<path d="M30 38 q6 6 12 0 M58 38 q6 6 12 0" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>', 'M30 60 Q50 82 70 60 Q50 68 30 60 Z') },
  { id: 'cool', label: 'Cool', svg: face('#ffd93b', '', 'M35 66 h30', '<rect x="26" y="34" width="48" height="14" rx="7" fill="#222"/><rect x="30" y="37" width="14" height="8" rx="4" fill="#7dd3fc"/>') },
  { id: 'love', label: 'Pyaar', svg: face('#ffb3c7', '', 'M35 64 Q50 74 65 64', '<path d="M30 34 c-4-8-16-4-12 6 l12 10 z" fill="#e11d48"/><path d="M70 34 c4-8 16-4 12 6 l-12 10 z" fill="#e11d48"/>') },
  { id: 'sad', label: 'Udaas', svg: face('#a8d8ff', '', 'M35 68 Q50 58 65 68', '<path d="M36 30 q4 6 0 12" stroke="#4a90d9" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M64 30 q-4 6 0 12" stroke="#4a90d9" stroke-width="4" fill="none" stroke-linecap="round"/>') },
  { id: 'angry', label: 'Gussa', svg: face('#ff9a7a', '<path d="M28 32 l14 6 M72 32 l-14 6" stroke="#7c2d12" stroke-width="5" stroke-linecap="round"/>', 'M38 68 Q50 60 62 68') },
  { id: 'wow', label: 'Hairan', svg: face('#d9c2ff', '', '', '<ellipse cx="50" cy="64" rx="10" ry="12" fill="#222"/>') },
  { id: 'sleep', label: 'Neend', svg: face('#c9e7ff', '<path d="M30 42 q6 5 12 0 M58 42 q6 5 12 0" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>', 'M44 66 q6 4 12 0', '<text x="74" y="26" font-size="20" fill="#64748b">z</text><text x="84" y="14" font-size="14" fill="#94a3b8">z</text>') },
  { id: 'party', label: 'Party', svg: face('#ffd93b', '', 'M32 62 Q50 78 68 62', '<path d="M50 4 l10 14 h-20 z" fill="#e11d48"/><rect x="47" y="14" width="6" height="8" fill="#f59e0b"/>') },
  { id: 'thumbs', label: 'Shabash', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#ffd93b"/><circle cx="36" cy="42" r="6" fill="#222"/><circle cx="64" cy="42" r="6" fill="#222"/><path d="M35 64 Q50 74 65 64" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M78 30 c8-2 10 6 4 10 l-6 14 c-3 6-12 4-12-2 l2-10 c1-6 6-10 12-12z" fill="#fff" stroke="#222" stroke-width="3"/></svg>` },
  { id: 'ok', label: 'Theek', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#b8f0c0"/><circle cx="38" cy="44" r="9" fill="none" stroke="#166534" stroke-width="5"/><circle cx="68" cy="40" r="9" fill="none" stroke="#166534" stroke-width="5"/><path d="M50 62 l6 6 12-14" stroke="#166534" stroke-width="6" fill="none" stroke-linecap="round"/></svg>` },
  { id: 'no', label: 'Nahi', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#ffc9c9"/><path d="M32 32 l36 36 M68 32 l-36 36" stroke="#b91c1c" stroke-width="8" stroke-linecap="round"/></svg>` },
];

/**
 * StickerPicker — keyboard ke upar panel: Emoji | GIF | Stickers tabs.
 * - Emoji: native unicode, onEmojiPick se input me insert hota hai.
 * - Stickers: built-in SVG faces, onStickerSend(svg) — parent image ki tarah bhejta hai.
 * - GIF: local-only policy — koi external API nahi, placeholder.
 */
export default function StickerPicker({
  onEmojiPick,
  onStickerSend,
  onClose,
}: {
  onEmojiPick: (emoji: string) => void;
  onStickerSend: (svg: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');

  const tabs = [
    { id: 'emoji' as const, label: 'Emoji' },
    { id: 'gif' as const, label: 'GIF' },
    { id: 'sticker' as const, label: 'Stickers' },
  ];

  return (
    <div className="bg-[var(--mv2-sheet)] border-t border-[var(--mv2-divider)] mv2-pop-anim">
      <div className="flex items-center px-2 pt-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 h-11 text-[14px] font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-[var(--mv2-accent)] text-[var(--mv2-accent)]' : 'border-transparent text-[var(--mv2-muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button onClick={onClose} aria-label="Band karein" className="w-11 h-11 flex items-center justify-center text-[var(--mv2-muted)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="h-[280px] overflow-y-auto px-3 py-2 mv2-safe-bottom">
        {tab === 'emoji' && (
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => onEmojiPick(e)}
                className="aspect-square flex items-center justify-center text-[26px] active:scale-125 transition-transform"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {tab === 'gif' && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-14 h-14 rounded-2xl bg-[var(--mv2-accent-soft)] flex items-center justify-center mb-3">
              <span className="text-[24px] font-bold text-[var(--mv2-accent)]">GIF</span>
            </div>
            <p className="text-[var(--mv2-text)] text-[15px] font-medium mb-1">GIF jald aa raha hai</p>
            <p className="text-[var(--mv2-muted)] text-[13px]">Filhal emoji ya stickers use karein 🎨</p>
          </div>
        )}

        {tab === 'sticker' && (
          <div className="grid grid-cols-4 gap-3">
            {STICKERS.map((s) => (
              <button
                key={s.id}
                onClick={() => onStickerSend(s.svg)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl active:bg-[var(--mv2-accent-soft)]"
              >
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(s.svg)}`} alt={s.label} className="w-16 h-16" draggable={false} />
                <span className="text-[11px] text-[var(--mv2-muted)]">{s.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
