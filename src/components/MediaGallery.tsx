"use client";
// D5 Media Gallery + I13 File Manager — Photos / Audio / Links (real data only)
import { useMemo, useState } from "react";
import { Images, Mic, Link2, Download, ExternalLink, SearchX } from "lucide-react";
import { useStore, patchUI } from "@/lib/store";
import { Avatar, fmtFull } from "@/components/ui";
import { extractUrls, LinkPreviewCard } from "@/components/LinkPreview";
import type { Message } from "@/lib/types";

type Tab = "photos" | "audio" | "links";

function senderName(members: any[], id: string) {
  return members.find((x: any) => x.id === id)?.name || "Member";
}

function PhotoGrid({ items, members }: { items: Message[]; members: any[] }) {
  if (items.length === 0) return <Empty label="Koi photo nahi" />;
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {items.map((m) => (
        <button
          key={m.id}
          onClick={() => patchUI({ viewer: { msgId: m.id } })}
          className="group relative aspect-square overflow-hidden rounded-xl bg-black/[0.05] transition active:scale-95"
          title={`${senderName(members, m.from)} · ${fmtFull(m.at)}`}
        >
          <img src={m.src} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
          <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-4 text-left text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
            {senderName(members, m.from)}
          </span>
        </button>
      ))}
    </div>
  );
}

function AudioList({ items, members }: { items: Message[]; members: any[] }) {
  if (items.length === 0) return <Empty label="Koi audio nahi" />;
  return (
    <div className="space-y-2">
      {items.map((m) => (
        <div key={m.id} className="rounded-2xl border border-black/[0.07] bg-white/60 p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <Avatar m={{ id: m.from, name: senderName(members, m.from), online: false }} size={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-[#2f3035]">{senderName(members, m.from)}</p>
              <p className="text-[11px] text-[#80848e]">{fmtFull(m.at)}{m.dur ? ` · ${Math.round(m.dur)}s` : ""}</p>
            </div>
            <a href={m.src} download={`chatsapp-audio-${m.id}.mp3`} className="rounded-lg p-2 text-[#5865f2] hover:bg-[#5865f2]/10" aria-label="Download">
              <Download size={16} />
            </a>
          </div>
          <audio controls src={m.src} preload="none" className="w-full" style={{ height: 36 }} />
        </div>
      ))}
    </div>
  );
}

function LinksList({ items, members }: { items: { msg: Message; url: string }[]; members: any[] }) {
  if (items.length === 0) return <Empty label="Koi link nahi" />;
  return (
    <div className="space-y-2">
      {items.map(({ msg, url }) => {
        let domain = "";
        try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { domain = url; }
        return (
          <div key={msg.id + url} className="rounded-2xl border border-black/[0.07] bg-white/60 p-3">
            <div className="mb-1 flex items-center gap-2">
              <Link2 size={14} className="shrink-0 text-[#5865f2]" />
              <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#2f3035]">{domain}</p>
              <a href={url} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-[#5865f2] hover:bg-[#5865f2]/10" aria-label="Kholo">
                <ExternalLink size={15} />
              </a>
            </div>
            <LinkPreviewCard url={url} />
            <p className="mt-1.5 text-[11px] text-[#80848e]">
              {members.find((x: any) => x.id === msg.from)?.name || "Member"} · {fmtFull(msg.at)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <SearchX size={28} className="text-[#a0a3ab]" />
      <p className="text-sm font-bold text-[#80848e]">{label} 📭</p>
    </div>
  );
}

export default function MediaGallery({ chatId, mode }: { chatId: string; mode: "media" | "files" }) {
  const messages = useStore((s) => s.messages);
  const members = useStore((s) => s.members);
  const [tab, setTab] = useState<Tab>("photos");

  const photos = useMemo(
    () => messages.filter((m) => m.chatId === chatId && m.type === "image" && m.src && !m.deleted).slice().reverse(),
    [messages, chatId]
  );
  const audios = useMemo(
    () => messages.filter((m) => m.chatId === chatId && m.type === "voice" && m.src && !m.deleted).slice().reverse(),
    [messages, chatId]
  );
  const links = useMemo(() => {
    const out: { msg: Message; url: string }[] = [];
    const seen = new Set<string>();
    for (const m of [...messages].reverse()) {
      if (m.chatId !== chatId || m.deleted || m.type !== "text" || !m.text) continue;
      for (const u of extractUrls(m.text)) {
        if (seen.has(u)) continue;
        seen.add(u);
        out.push({ msg: m, url: u });
      }
    }
    return out;
  }, [messages, chatId]);

  const tabs: { id: Tab; label: string; icon: any; count: number }[] = [
    { id: "photos", label: "Photos", icon: Images, count: photos.length },
    { id: "audio", label: "Audio", icon: Mic, count: audios.length },
    { id: "links", label: "Links", icon: Link2, count: links.length },
  ];

  return (
    <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
      <div className="mx-auto max-w-md">
        {/* I13 — counts by type */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-2xl border p-3 text-center transition active:scale-[0.98] ${tab === t.id ? "border-[#5865f2]/40 bg-[#5865f2]/[0.08]" : "border-black/[0.07] bg-white/60 hover:bg-white"}`}
            >
              <t.icon size={18} className={`mx-auto ${tab === t.id ? "text-[#5865f2]" : "text-[#80848e]"}`} />
              <p className="mt-1 text-base font-extrabold tabular-nums text-[#2f3035]">{t.count}</p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#80848e]">{t.label}</p>
            </button>
          ))}
        </div>

        {mode === "files" && tab === "photos" && photos.length > 0 && (
          <div className="mb-3 flex items-center justify-between rounded-2xl bg-[#5865f2]/[0.07] px-3 py-2">
            <p className="text-xs font-bold text-[#5865f2]">{photos.length} photos</p>
            <p className="text-[11px] text-[#80848e]">Download ke liye photo kholo 👆</p>
          </div>
        )}

        {tab === "photos" && <PhotoGrid items={photos} members={members} />}
        {tab === "audio" && <AudioList items={audios} members={members} />}
        {tab === "links" && <LinksList items={links} members={members} />}

        {mode === "files" && tab === "photos" && photos.length > 0 && (
          <div className="mt-3 space-y-2">
            {photos.slice(0, 20).map((m) => (
              <div key={m.id} className="flex items-center gap-2.5 rounded-2xl border border-black/[0.07] bg-white/60 p-2.5">
                <img src={m.src} alt="" className="h-11 w-11 rounded-xl object-cover" loading="lazy" draggable={false} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-[#2f3035]">Photo · {senderName(members, m.from)}</p>
                  <p className="text-[11px] text-[#80848e]">{fmtFull(m.at)}</p>
                </div>
                <a href={m.src} download={`chatsapp-photo-${m.id}.jpg`} className="rounded-lg p-2 text-[#5865f2] hover:bg-[#5865f2]/10" aria-label="Download">
                  <Download size={16} />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
