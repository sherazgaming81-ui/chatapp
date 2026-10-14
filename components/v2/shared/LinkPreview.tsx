'use client';

import { useEffect, useState } from 'react';

export interface LinkMeta {
  title: string;
  description: string;
  image: string;
  domain: string;
}

const cache = new Map<string, LinkMeta>();

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;

/** Text me se URLs nikalein (pehle 3) */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(URL_RE)) {
    const u = m[1].replace(/[.,;:!?)]+$/, '');
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
      if (out.length >= 3) break;
    }
  }
  return out;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * useLinkPreview — microlink.io (free, CORS-open) se title/description/image.
 * Fail ho to domain-only fallback. Result module-level cache hota hai.
 */
export function useLinkPreview(url: string | null): LinkMeta | null {
  const [meta, setMeta] = useState<LinkMeta | null>(() => (url ? cache.get(url) || null : null));

  useEffect(() => {
    if (!url) {
      setMeta(null);
      return;
    }
    const hit = cache.get(url);
    if (hit) {
      setMeta(hit);
      return;
    }
    const domain = domainOf(url);
    const fallback: LinkMeta = { title: domain, description: url, image: '', domain };
    let alive = true;
    setMeta(fallback);
    fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j?.data) return;
        const d = j.data;
        const m: LinkMeta = {
          title: d.title || domain,
          description: d.description || url,
          image: d.image?.url || '',
          domain,
        };
        cache.set(url, m);
        setMeta(m);
      })
      .catch(() => {
        if (alive) {
          cache.set(url, fallback);
          setMeta(fallback);
        }
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return meta;
}

/**
 * LinkPreviewCard — WhatsApp-style link card: image + title + description + domain.
 */
export function LinkPreviewCard({
  url,
  compact = false,
  mine = false,
  onOpen,
}: {
  url: string;
  compact?: boolean;
  mine?: boolean;
  onOpen?: (url: string) => void;
}) {
  const meta = useLinkPreview(url);
  if (!meta) return null;
  const open = () => {
    if (onOpen) onOpen(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  };
  const titleCls = mine ? 'text-white' : 'text-[var(--mv2-text)]';
  const descCls = mine ? 'text-white/70' : 'text-[var(--mv2-muted)]';
  return (
    <button
      onClick={open}
      className={`w-full text-left rounded-lg overflow-hidden border active:opacity-80 transition-opacity ${
        mine ? 'border-white/20 bg-black/20' : 'border-black/10 bg-black/10'
      } ${compact ? 'mt-1.5' : 'mt-2'}`}
    >
      {meta.image && (
        <img
          src={meta.image}
          alt=""
          loading="lazy"
          className={`w-full object-cover ${compact ? 'max-h-28' : 'max-h-36'}`}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <span className="block px-2.5 py-2 border-l-[3px] border-[var(--mv2-accent)]">
        <span className={`block text-[13px] font-semibold truncate ${titleCls}`}>{meta.title}</span>
        <span className={`block text-[12px] truncate mt-0.5 ${descCls}`}>{meta.description}</span>
        <span className={`block text-[11px] mt-0.5 truncate ${mine ? 'text-white/80' : 'text-[var(--mv2-accent)]'}`}>🌐 {meta.domain}</span>
      </span>
    </button>
  );
}
