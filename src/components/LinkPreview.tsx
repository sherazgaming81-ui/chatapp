"use client";
// B18 — URLs auto-detect → linkify + OpenGraph preview card (microlink, cached, graceful fallback)
import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

const URL_RE = /(https?:\/\/[^\s<>"']+)/gi;

export function extractUrls(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(URL_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || "")) && out.length < 3) {
    const u = m[1].replace(/[.,;:!?)\]]+$/, "");
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

// linkified text: URLs become clickable
export function LinkedText({ text, query = "" }: { text: string; query?: string }) {
  const parts: React.ReactNode[] = [];
  const re = new RegExp(URL_RE);
  let last = 0, k = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text || ""))) {
    if (m.index > last) parts.push(<span key={k++}>{text.slice(last, m.index)}</span>);
    const raw = m[1].replace(/[.,;:!?)\]]+$/, "");
    parts.push(
      <a key={k++} href={raw} target="_blank" rel="noopener noreferrer" className="text-[#5865f2] underline decoration-[#5865f2]/40 underline-offset-2 hover:decoration-[#5865f2]" onClick={(e) => e.stopPropagation()}>
        {raw}
      </a>
    );
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push(<span key={k++}>{text.slice(last)}</span>);
  void query;
  return <>{parts}</>;
}

interface OG { title: string; desc: string; img: string; domain: string }
const cache = new Map<string, OG | null>();

export function LinkPreviewCard({ url }: { url: string }) {
  const [og, setOg] = useState<OG | null | undefined>(cache.has(url) ? cache.get(url)! : undefined);

  useEffect(() => {
    if (cache.has(url)) { setOg(cache.get(url)!); return; }
    let live = true;
    (async () => {
      try {
        const r = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
        const j = await r.json();
        const d = j?.data;
        const v: OG | null = d?.title
          ? { title: d.title, desc: d.description || "", img: d.image?.url || "", domain: new URL(url).hostname.replace(/^www\./, "") }
          : null;
        cache.set(url, v);
        if (live) setOg(v);
      } catch {
        cache.set(url, null);
        if (live) setOg(null);
      }
    })();
    return () => { live = false; };
  }, [url]);

  if (og === undefined) {
    return (
      <div className="mt-2 flex animate-pulse gap-3 rounded-xl border border-black/10 bg-black/[0.03] p-3">
        <div className="h-14 w-14 shrink-0 rounded-lg bg-black/10" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3 w-3/4 rounded bg-black/10" />
          <div className="h-3 w-1/2 rounded bg-black/10" />
        </div>
      </div>
    );
  }
  if (og === null) return null; // graceful fallback — plain linkified text stays

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex gap-3 overflow-hidden rounded-xl border border-black/10 bg-white transition hover:border-[#5865f2]/50 soft-shadow"
      onClick={(e) => e.stopPropagation()}
    >
      {og.img ? (
        <img src={og.img} alt="" className="h-20 w-24 shrink-0 object-cover" loading="lazy" />
      ) : (
        <span className="grid h-20 w-24 shrink-0 place-items-center bg-[#5865f2]/10 text-[#5865f2]">
          <ExternalLink size={20} />
        </span>
      )}
      <span className="min-w-0 flex-1 py-2 pr-3">
        <span className="block text-xs font-bold uppercase tracking-wide text-[#80848e]">{og.domain}</span>
        <span className="block truncate text-sm font-bold text-[#2f3035]">{og.title}</span>
        {og.desc && <span className="block truncate text-xs text-[#5c5e66]">{og.desc}</span>}
      </span>
    </a>
  );
}
