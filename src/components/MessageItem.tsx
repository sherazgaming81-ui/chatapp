"use client";
import { useRef, useState } from "react";
import { Reply, Smile, Trash2, Play, Pause, Pin, PinOff } from "lucide-react";
import { getState, useStore, patchUI } from "@/lib/store";
import { deleteMessage, toggleReaction, togglePin } from "@/lib/db";
import { Avatar, nameColor, Badge, fmtTime, fmtDayLabel } from "@/components/ui";
import type { Member, Message } from "@/lib/types";

const QUICK = ["❤️", "👍", "😂", "🤲", "🌙"];

function VoiceBubble({ m }: { m: Message }) {
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const toggle = () => {
    if (!m.src) return;
    if (!audio.current) audio.current = new Audio(m.src);
    if (playing) audio.current.pause();
    else {
      audio.current.onended = () => setPlaying(false);
      audio.current.play().catch(() => setPlaying(false));
    }
    setPlaying(!playing);
  };
  return (
    <button onClick={toggle} className="mt-1 flex items-center gap-3 rounded-xl bg-black/[0.04] px-4 py-2.5 hover:bg-black/[0.07]">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#5865f2] text-white soft-shadow">
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </span>
      <span className="flex h-6 items-end gap-[3px]">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="w-[3px] rounded-full bg-[#5865f2]" style={{ height: `${30 + Math.abs(Math.sin(i * 1.7)) * 70}%`, opacity: playing ? 1 : 0.4 }} />
        ))}
      </span>
      <span className="text-xs tabular-nums text-[#80848e]">{m.dur ? `${Math.round(m.dur)}s` : "voice"}</span>
    </button>
  );
}

export default function MessageItem({ m, member, prevSame }: { m: Message; member?: Member; prevSame: boolean }) {
  const meId = useStore((s) => s.me);
  const messages = useStore((s) => s.messages);
  const [reactOpen, setReactOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const mine = m.from === meId;
  const replySrc = m.replyTo ? messages.find((x) => x.id === m.replyTo) : null;
  const replyMember = replySrc ? getState().members.find((x) => x.id === replySrc.from) : null;
  const staff = (getState().members.find((x) => x.id === meId)?.role || "member") !== "member";
  const pinnedIds = useStore((s) => s.pins[m.chatId] || []);
  const isPinned = pinnedIds.includes(m.id);

  if (m.deleted) {
    return (
      <div className="msg-row px-4 py-0.5">
        <p className="text-sm italic text-[#80848e]">Message delete kar diya gaya</p>
      </div>
    );
  }

  const name = member?.name || "Member";
  const color = member ? nameColor(member) : "#5c5e66";
  return (
    <div id={`msg-${m.id}`} className={`msg-row group relative px-4 ${prevSame ? "py-0.5" : "mt-[17px] py-0.5"} hover:bg-black/[0.035]`}>
      <div className="msg-actions absolute -top-4 right-4 z-10 flex overflow-hidden rounded-lg border border-black/10 bg-white soft-shadow">
        <button title="React" onClick={() => setReactOpen((v) => !v)} className="p-2 text-[#5c5e66] hover:bg-black/5 hover:text-[#2f3035]"><Smile size={16} /></button>
        <button title="Reply" onClick={() => patchUI({ replyTo: m })} className="p-2 text-[#5c5e66] hover:bg-black/5 hover:text-[#2f3035]"><Reply size={16} /></button>
        {staff && (
          <button title={isPinned ? "Unpin" : "Pin"} onClick={() => togglePin(m.chatId, m.id)} className={`p-2 hover:bg-black/5 ${isPinned ? "text-[#5865f2]" : "text-[#5c5e66] hover:text-[#2f3035]"}`}>{isPinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
        )}
        {(mine || staff) && (
          <button title="Delete" onClick={() => setConfirmDel(true)} className="p-2 text-[#5c5e66] hover:bg-[#ed4245]/10 hover:text-[#ed4245]"><Trash2 size={16} /></button>
        )}
      </div>
      {reactOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setReactOpen(false)} />
          <div className="pop-in absolute -top-12 right-4 z-30 flex gap-1 rounded-xl border border-black/10 bg-white p-1.5 soft-shadow">
            {QUICK.map((e) => (
              <button key={e} onClick={() => { toggleReaction(m.id, e); setReactOpen(false); }} className="rounded-lg p-1.5 text-xl hover:bg-black/5">{e}</button>
            ))}
          </div>
        </>
      )}
      {confirmDel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setConfirmDel(false)} />
          <div className="pop-in fixed left-1/2 top-1/2 z-50 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-black/10 bg-white p-5 soft-shadow">
            <h3 className="text-lg font-extrabold text-[#2f3035]">Message delete karein?</h3>
            <p className="mt-1 text-sm text-[#5c5e66]">Ye sab ke liye delete ho jayega.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmDel(false)} className="btn btn-ghost flex-1 px-4 py-2.5 text-sm">Rehne do</button>
              <button onClick={() => { deleteMessage(m.id); setConfirmDel(false); }} className="btn btn-danger flex-1 px-4 py-2.5 text-sm">Delete</button>
            </div>
          </div>
        </>
      )}

      {m.type === "announcement" ? (
        <div className="card my-2 border-[#5865f2]/30 bg-gradient-to-r from-[#5865f2]/[0.07] to-[#9b7bff]/[0.07] p-3.5">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-[#5865f2]">📢 Elaan · {name}</p>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#2f3035]">{m.text}</p>
        </div>
      ) : prevSame ? (
        <div className="flex gap-4">
          <span className="w-10 shrink-0 select-none pt-1 text-right text-[10px] tabular-nums text-[#80848e] opacity-0 group-hover:opacity-100">{fmtTime(m.at)}</span>
          <div className="min-w-0 flex-1">
            {replySrc && <ReplyLine replySrc={replySrc} replyMember={replyMember} />}
            <MsgBody m={m} />
            <Reactions m={m} meId={meId} />
          </div>
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="shrink-0 pt-0.5">
            <Avatar m={{ id: member?.id || m.from, name, avatar: member?.avatar, online: !!member?.online }} size={40} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[15px] font-bold" style={{ color }}>{name}</span>
              {member && <Badge role={member.role} />}
              <span className="text-[11px] font-medium text-[#80848e]">{fmtDayLabel(m.at)} {fmtTime(m.at)}{m.edited ? " · edited" : ""}</span>
            </p>
            {replySrc && <ReplyLine replySrc={replySrc} replyMember={replyMember} />}
            <MsgBody m={m} />
            <Reactions m={m} meId={meId} />
          </div>
        </div>
      )}
    </div>
  );
}

function ReplyLine({ replySrc, replyMember }: { replySrc: Message; replyMember?: Member | null }) {
  return (
    <div className="mb-1 flex items-center gap-1.5 text-[13px] text-[#80848e]">
      <Reply size={13} className="shrink-0" />
      <span className="font-semibold" style={{ color: replyMember ? nameColor(replyMember) : undefined }}>{replyMember?.name || "Member"}</span>
      <span className="truncate italic">{replySrc.deleted ? "deleted message" : replySrc.text || (replySrc.type === "image" ? "📷 Photo" : "🎙️ Voice")}</span>
    </div>
  );
}

function MsgBody({ m }: { m: Message }) {
  if (m.type === "image" && m.src) {
    return (
      <div className="mt-1">
        {m.caption && <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#2f3035]">{m.caption}</p>}
        <img src={m.src} alt="" className="mt-1.5 max-h-72 rounded-xl border border-black/10 object-cover soft-shadow" loading="lazy" draggable={false} />
      </div>
    );
  }
  if (m.type === "voice") return <VoiceBubble m={m} />;
  return <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#2f3035]">{m.text}</p>;
}

function Reactions({ m, meId }: { m: Message; meId: string }) {
  const entries = Object.entries(m.reactions).filter(([, u]) => u.length > 0);
  if (entries.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {entries.map(([emoji, users]) => {
        const mine = users.includes(meId);
        return (
          <button
            key={emoji}
            onClick={() => toggleReaction(m.id, emoji)}
            className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm ${mine ? "border-[#5865f2] bg-[#5865f2]/15" : "border-black/10 bg-black/[0.04] hover:border-black/25"}`}
          >
            <span>{emoji}</span>
            <span className="text-xs font-bold tabular-nums text-[#5c5e66]">{users.length}</span>
          </button>
        );
      })}
    </div>
  );
}
