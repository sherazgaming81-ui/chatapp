"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { Reply, Smile, Trash2, Play, Pause, Pin, PinOff, Pencil, Info, X, Check, CheckCheck, Star, StarOff, MapPin, User, Navigation, FileText, FileAudio, FileVideo, FileArchive, File as FileIcon, Download } from "lucide-react";
import { getState, useStore, patchUI, toast } from "@/lib/store";
import { deleteMessage, hardDeleteMessage, toggleReaction, togglePin, toggleStar, hideMessageForMe } from "@/lib/db";
import { Avatar, nameColor, Badge, fmtTime, fmtDayLabel } from "@/components/ui";
import PollMessage from "@/components/PollMessage";
import QuizMessage from "@/components/QuizMessage";
import TicTacToeMessage from "@/components/TicTacToeMessage";
import RiddleMessage from "@/components/RiddleMessage";
import StickerMessage from "@/components/StickerMessage";
import { LinkedText, LinkPreviewCard, extractUrls } from "@/components/LinkPreview";
import { fmtSize } from "@/lib/db";
import type { Member, Message } from "@/lib/types";

/* ───────── File card: icon + naam + size + download, audio/video inline player ───────── */
function FileCard({ m }: { m: Message }) {
  const name = m.fileName || "file";
  const size = m.fileSize || 0;
  const mime = m.mimeType || "";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const isAudio = mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "webm"].includes(ext);
  const isVideo = mime.startsWith("video/") || ["mp4", "mov", "avi", "mkv"].includes(ext);
  const isPdf = mime === "application/pdf" || ext === "pdf";
  const isZip = ["zip", "rar", "7z", "tar", "apk"].includes(ext);
  const Icon = isAudio ? FileAudio : isVideo ? FileVideo : isPdf ? FileText : isZip ? FileArchive : FileIcon;
  const iconColor = isAudio ? "#9b7bff" : isVideo ? "#5865f2" : isPdf ? "#ed4245" : isZip ? "#f5a623" : "#5c5e66";
  return (
    <div className="mt-1 w-64 max-w-full">
      {(isAudio || isVideo) && m.src ? (
        <div className="overflow-hidden rounded-xl">
          {isVideo ? (
            <video src={m.src} controls className="max-h-64 w-full bg-black" preload="metadata" />
          ) : (
            <audio src={m.src} controls className="w-full" preload="metadata" />
          )}
        </div>
      ) : null}
      <a
        href={m.src} download={name} target="_blank" rel="noopener noreferrer"
        className="mt-1 flex items-center gap-3 rounded-xl bg-black/[0.04] p-3 transition hover:bg-black/[0.07]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white soft-shadow" style={{ color: iconColor }}>
          <Icon size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-[#2f3035]">{name}</span>
          <span className="block text-xs text-[#80848e]">{fmtSize(size)}{ext ? ` · ${ext.toUpperCase()}` : ""}</span>
        </span>
        <Download size={18} className="shrink-0 text-[#5865f2]" />
      </a>
    </div>
  );
}

const QUICK = ["❤️", "👍", "😂", "🤲", "🌙"];
const EMPTY_ARR: string[] = [];
const EDIT_WINDOW = 15 * 60e3; // B16 — 15 min

// A11 — animated ticks: single grey (sent) → double grey (delivered) → double Blurple (read)
function Ticks({ m, inverted = false }: { m: Message; inverted?: boolean }) {
  const [, force] = useState(0);
  const readers = (m.readBy || []).filter((id) => id !== m.from);
  useEffect(() => {
    if (readers.length === 0 && Date.now() - m.at < 4000) {
      const t = setTimeout(() => force((x) => x + 1), Math.max(50, 4000 - (Date.now() - m.at)));
      return () => clearTimeout(t);
    }
  }, [m.id, m.at, readers.length]);
  const age = Date.now() - m.at;
  const st = m.status || (readers.length > 0 ? "read" : age < 3000 ? "sent" : "delivered");
  const cSent = inverted ? "text-[#54656f]" : "text-[#80848e]";
  const cRead = inverted ? "text-[#53bdeb]" : "text-[#5865f2]";
  const cDel = inverted ? "text-[#54656f]" : "text-[#80848e]";
  if (st === "sent") return <Check size={13} className={`inline ${cSent}`} />;
  return (
    <span key={st} className="tick-pop">
      <CheckCheck size={15} className={`inline ${st === "read" ? cRead : cDel}`} />
    </span>
  );
}

// A5 — search highlight helper
function Hi({ text, q }: { text: string; q: string }) {
  const needle = q.trim().toLowerCase();
  if (!needle || !text) return <>{text}</>;
  const low = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0, k = 0;
  for (;;) {
    const j = low.indexOf(needle, i);
    if (j === -1) { out.push(text.slice(i)); break; }
    out.push(text.slice(i, j));
    out.push(<mark key={k++} className="search-hl">{text.slice(j, j + needle.length)}</mark>);
    i = j + needle.length;
    if (i >= text.length) break;
  }
  return <>{out}</>;
}

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
          <span
            key={i}
            className={`w-[3px] rounded-full bg-[#5865f2] ${playing ? "wavebar" : ""}`}
            style={{ height: `${30 + Math.abs(Math.sin(i * 1.7)) * 70}%`, opacity: playing ? 1 : 0.4, animationDelay: `${(i % 8) * 0.09}s` }}
          />
        ))}
      </span>
      <span className="text-xs tabular-nums text-[#80848e]">{m.dur ? `${Math.round(m.dur)}s` : "voice"}</span>
    </button>
  );
}

/* 18 — blur-up image: pehle dhundla placeholder, load par clear */
function BlurImage({ src, onOpen }: { src: string; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <button onClick={onOpen} className="mt-1.5 block cursor-zoom-in" title="Bara dekho">
      <span className={`block overflow-hidden rounded-xl border border-black/10 soft-shadow ${loaded ? "" : "skel"}`}>
        <img
          src={src}
          alt=""
          onLoad={() => setLoaded(true)}
          className={`max-h-72 w-auto object-cover transition hover:brightness-[0.97] ${loaded ? "blur-up done" : "blur-up"}`}
          loading="lazy"
          draggable={false}
        />
      </span>
    </button>
  );
}

export default function MessageItem({ m, member, prevSame, query = "" }: { m: Message; member?: Member; prevSame: boolean; query?: string }) {
  const meId = useStore((s) => s.me);
  const messages = useStore((s) => s.messages);
  const infoOpen = useStore((s) => s.ui.infoMsg === m.id);
  const selectedMsgs = useStore((s) => s.ui.selectedMsgs);
  const isSelected = selectedMsgs.includes(m.id);
  const selectMode = selectedMsgs.length > 0;
  const toggleSelect = () => {
    const cur = getState().ui.selectedMsgs;
    const next = cur.includes(m.id) ? cur.filter((id) => id !== m.id) : [...cur, m.id];
    patchUI({ selectedMsgs: next });
  };
  // Ctrl/Cmd+click (PC) se select toggle
  const onSelectClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      toggleSelect();
    } else if (selectMode) {
      e.stopPropagation();
      toggleSelect();
    }
  };
  // Mobile: long-press (600ms) se select mode
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTouchStartLP = () => {
    lpTimer.current = setTimeout(() => {
      toggleSelect();
      try { navigator.vibrate?.(30); } catch { /* ignore */ }
    }, 600);
  };
  const onTouchEndLP = () => {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
  };
  const [reactOpen, setReactOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  // 3 — emoji burst: reaction lagao to chhota confetti burst 🎉
  const [bursts, setBursts] = useState<{ id: number; emoji: string }[]>([]);
  const burstSeq = useRef(0);
  const fireBurst = (emoji: string) => {
    const id = ++burstSeq.current;
    setBursts((b) => [...b, { id, emoji }]);
    try { import("@/lib/sound").then((s) => s.playTick()).catch(() => {}); } catch { /* ignore */ }
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 750);
  };
  const react = (emoji: string) => {
    toggleReaction(m.id, emoji);
    fireBurst(emoji);
    setReactOpen(false);
  };
  const [deleting, setDeleting] = useState(false); // B15
  const mine = m.from === meId;
  const replySrc = m.replyTo ? messages.find((x) => x.id === m.replyTo) : null;
  const replyMember = replySrc ? getState().members.find((x) => x.id === replySrc.from) : null;
  const staff = (getState().members.find((x) => x.id === meId)?.role || "member") !== "member";
  const pinnedIds = useStore((s) => s.pins[m.chatId] || EMPTY_ARR);
  const starred = useStore((s) => s.starred.includes(m.id));
  const isPinned = pinnedIds.includes(m.id);
  const canEdit = mine && m.type === "text" && !m.deleted && Date.now() - m.at < EDIT_WINDOW; // B16

  // A3 — swipe right to reply (mobile touch) · 11 — swipe LEFT = options
  const tx = useRef<number | null>(null);
  const ty = useRef<number | null>(null);
  const [actionsPinned, setActionsPinned] = useState(false); // 11 — mobile par swipe-left se actions khulen
  const onTouchStart = (e: React.TouchEvent) => {
    tx.current = e.touches[0].clientX;
    ty.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (tx.current === null || ty.current === null) return;
    const dx = e.changedTouches[0].clientX - tx.current;
    const dy = e.changedTouches[0].clientY - ty.current;
    tx.current = ty.current = null;
    if (m.deleted) return;
    if (dx > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) patchUI({ replyTo: m });
    else if (dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.5) setActionsPinned(true); // 11 — swipe left = options
  };

  // 14 — right-click se bhi context menu kholo (desktop)
  const [ctxOpen, setCtxOpen] = useState(false);
  const onContextMenu = (e: React.MouseEvent) => {
    if (m.deleted) return;
    e.preventDefault();
    setCtxOpen(true);
  };
  useEffect(() => {
    if (!ctxOpen) return;
    const close = () => setCtxOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxOpen]);

  // 1 — naya message slide-in (sirf taaza messages, dobara render par nahi)
  const [fresh] = useState(() => Date.now() - m.at < 8000);
  const slideCls = fresh ? "msg-slide-in" : "";

  const doDelete = () => {
    setConfirmDel(false);
    setDeleting(true); // B15 — shrink+fade, phir remove
    setTimeout(() => deleteMessage(m.id), 210);
  };
  // AUDIT FIX — delete-for-me: sirf apni taraf se hatao (server untouched)
  const doDeleteForMe = () => {
    setConfirmDel(false);
    hideMessageForMe(m.id);
    toast("Message hata diya", "Sirf aapke liye");
  };

  if (m.deleted) {
    return (
      <div className="msg-row group flex items-center gap-2 px-4 py-0.5">
        <p className="flex-1 text-sm italic text-[#80848e]">Message delete kar diya gaya</p>
        {(mine || staff) && (
          <button
            onClick={() => hardDeleteMessage(m.id)}
            title="Hamesha ke liye hatao"
            className="rounded-lg p-1.5 text-[#80848e] opacity-0 transition hover:bg-[#ed4245]/10 hover:text-[#ed4245] group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  }

  const name = member?.name || "Member";
  const color = member ? nameColor(member) : "#5c5e66";
  const timeLabel = `${fmtDayLabel(m.at)} ${fmtTime(m.at)}`;
  return (
    <div
      id={`msg-${m.id}`}
      onTouchStart={(e) => { onTouchStart(e); onTouchStartLP(); }}
      onTouchEnd={(e) => { onTouchEnd(e); onTouchEndLP(); }}
      onTouchMove={onTouchEndLP}
      onContextMenu={onContextMenu}
      onClick={onSelectClick}
      className={`msg-row msg-time-tip group relative px-4 ${prevSame ? "py-0.5" : "mt-[17px] py-0.5"} hover:bg-black/[0.035] ${deleting ? "deleting" : ""} ${slideCls} ${isSelected ? "bg-[#5865f2]/[0.08]" : ""}`}
      data-time={timeLabel}
    >
      {/* multi-select checkbox */}
      {selectMode && (
        <button
          onClick={(e) => { e.stopPropagation(); toggleSelect(); }}
          className={`absolute left-1 top-1/2 z-10 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full border-2 transition ${isSelected ? "border-[#5865f2] bg-[#5865f2] text-white" : "border-black/20 bg-white"}`}
          aria-label={isSelected ? "Deselect" : "Select"}
        >
          {isSelected && <Check size={14} strokeWidth={3} />}
        </button>
      )}
      {/* 11 — swipe-left par mobile action sheet khulti hai */}
      {actionsPinned && (
        <>
          <div className="fixed inset-0 z-20 md:hidden" onClick={() => setActionsPinned(false)} />
          <div className="swipe-actions-bar pop-in fixed bottom-20 left-4 right-4 z-30 flex justify-around rounded-2xl border border-black/10 bg-white p-2 soft-shadow md:hidden">
            <button onClick={() => { patchUI({ replyTo: m }); setActionsPinned(false); }} className="flex flex-col items-center gap-1 rounded-xl p-2.5 text-[#5c5e66] active:bg-black/5"><Reply size={20} /><span className="text-[10px] font-bold">Reply</span></button>
            <button onClick={() => { react("❤️"); setActionsPinned(false); }} className="flex flex-col items-center gap-1 rounded-xl p-2.5 text-[#5c5e66] active:bg-black/5"><span className="text-xl">❤️</span><span className="text-[10px] font-bold">React</span></button>
            <button onClick={() => { toggleStar(m.id); setActionsPinned(false); }} className="flex flex-col items-center gap-1 rounded-xl p-2.5 text-[#5c5e66] active:bg-black/5"><Star size={20} /><span className="text-[10px] font-bold">Star</span></button>
            {(mine || staff) && (
              <button onClick={() => { setActionsPinned(false); setConfirmDel(true); }} className="flex flex-col items-center gap-1 rounded-xl p-2.5 text-[#ed4245] active:bg-black/5"><Trash2 size={20} /><span className="text-[10px] font-bold">Delete</span></button>
            )}
            {/* TASK 2: member dusre ka msg bhi "mere liye" hata sakta hai */}
            {!mine && !staff && (
              <button onClick={() => { setActionsPinned(false); setConfirmDel(true); }} className="flex flex-col items-center gap-1 rounded-xl p-2.5 text-[#5c5e66] active:bg-black/5"><Trash2 size={20} /><span className="text-[10px] font-bold">Hatao</span></button>
            )}
          </div>
        </>
      )}
      {/* 14 — glassmorphism context menu (hover + right-click) */}
      <div className={`msg-actions ctx-glass absolute -top-4 z-10 flex overflow-hidden rounded-2xl ${mine ? "right-4" : "left-14"} ${(actionsPinned || ctxOpen) ? "!opacity-100" : ""}`}>
        <button title="React" onClick={() => setReactOpen((v) => !v)} className="p-2 text-[#5c5e66] hover:bg-black/5 hover:text-[#2f3035]"><Smile size={16} /></button>
        <button title="Reply" onClick={() => patchUI({ replyTo: m })} className="p-2 text-[#5c5e66] hover:bg-black/5 hover:text-[#2f3035]"><Reply size={16} /></button>
        <button title={starred ? "Unstar" : "Star"} onClick={() => toggleStar(m.id)} className={`p-2 hover:bg-black/5 ${starred ? "text-[#f5a623]" : "text-[#5c5e66] hover:text-[#2f3035]"}`}>{starred ? <StarOff size={16} /> : <Star size={16} />}</button>
        {(mine || staff) && (
          <button title="Dekha kisne" onClick={() => patchUI({ infoMsg: m.id })} className="p-2 text-[#5c5e66] hover:bg-black/5 hover:text-[#2f3035]"><Info size={16} /></button>
        )}
        {canEdit && (
          <button title="Edit" onClick={() => patchUI({ editingMsg: m, replyTo: null })} className="p-2 text-[#5c5e66] hover:bg-black/5 hover:text-[#2f3035]"><Pencil size={16} /></button>
        )}
        {staff && (
          <button title={isPinned ? "Unpin" : "Pin"} onClick={() => togglePin(m.chatId, m.id)} className={`p-2 hover:bg-black/5 ${isPinned ? "text-[#5865f2]" : "text-[#5c5e66] hover:text-[#2f3035]"}`}>{isPinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
        )}
        {/* TASK 2: delete button sab messages par — options permission ke hisab se */}
        <button title="Delete" onClick={() => setConfirmDel(true)} className="p-2 text-[#5c5e66] hover:bg-[#ed4245]/10 hover:text-[#ed4245]"><Trash2 size={16} /></button>
        <button title="Select" onClick={() => { setCtxOpen(false); toggleSelect(); }} className={`p-2 hover:bg-black/5 ${isSelected ? "text-[#5865f2]" : "text-[#5c5e66] hover:text-[#2f3035]"}`}><Check size={16} /></button>
      </div>
      {reactOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setReactOpen(false)} />
          <div className="pop-in absolute -top-12 right-4 z-30 flex gap-1 rounded-xl border border-black/10 bg-white p-1.5 soft-shadow">
            {QUICK.map((e) => (
              <button key={e} onClick={() => react(e)} className="rounded-lg p-1.5 text-xl hover:bg-black/5">{e}</button>
            ))}
          </div>
        </>
      )}
      {/* 3 — emoji burst overlay */}
      {bursts.map((b) => (
        <span key={b.id} className="emoji-burst" aria-hidden>
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className={`eb-p eb-p${i}`}>{b.emoji}</span>
          ))}
        </span>
      ))}
      {confirmDel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setConfirmDel(false)} />
          <div className="pop-in fixed left-1/2 top-1/2 z-50 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-black/10 bg-white p-5 soft-shadow">
            <h3 className="text-lg font-extrabold text-[#2f3035]">Message delete karein?</h3>
            <p className="mt-1 text-sm text-[#5c5e66]">{(mine || staff) ? "Apne liye hatao ya sab ke liye delete karo." : "Ye message sirf aapke liye hatayega."}</p>
            <div className="mt-4 space-y-2">
              <button onClick={doDeleteForMe} className="btn btn-ghost w-full px-4 py-2.5 text-sm">Mere liye hatao</button>
              {(mine || staff) && (
                <button onClick={doDelete} className="btn btn-danger w-full px-4 py-2.5 text-sm">Sab ke liye delete</button>
              )}
              <button onClick={() => setConfirmDel(false)} className="w-full px-4 py-2 text-sm font-semibold text-[#80848e] hover:text-[#2f3035]">Rehne do</button>
            </div>
          </div>
        </>
      )}
      {infoOpen && <SeenByModal m={m} onClose={() => patchUI({ infoMsg: null })} />}

      {m.type === "announcement" ? (
        <div className="card my-2 border-[#5865f2]/30 bg-gradient-to-r from-[#5865f2]/[0.07] to-[#9b7bff]/[0.07] p-3.5">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.08em] text-[#5865f2]">📢 Elaan · {name}</p>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#2f3035]">{m.text}</p>
        </div>
      ) : m.type === "text" ? (
        /* 6 — WhatsApp-style bubble (tails ke sath) */
        <>
        <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
          <div className={`bubble ${mine ? "bubble-mine" : "bubble-theirs"}`}>
            {!mine && !prevSame && (
              <p className="bubble-name" style={{ color }}>{name}</p>
            )}
            {replySrc && (
              <div className={`mb-1.5 rounded-lg px-2.5 py-1.5 ${mine ? "bg-black/15" : "bg-black/[0.05]"}`}>
                <p className="text-xs font-bold" style={{ color: mine ? "#111b21" : (replyMember ? nameColor(replyMember) : "#5865f2") }}>{replyMember?.name || "Member"}</p>
                <p className={`truncate text-xs italic ${mine ? "text-[#111b21]/70" : "text-[#80848e]"}`}>{replySrc.deleted ? "deleted message" : replySrc.text || "Message"}</p>
              </div>
            )}
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {query ? <Hi text={m.text} q={query} /> : <LinkedText text={m.text} />}
            </p>
            {extractUrls(m.text).slice(0, 1).map((u) => <LinkPreviewCard key={u} url={u} mine={mine} />)}
            <span className="mt-1 flex items-center justify-end gap-1">
              <span className="bubble-time">{fmtTime(m.at)}{m.edited ? " · edited" : ""}</span>
              {mine && <Ticks m={m} inverted />}
            </span>
          </div>
        </div>
        <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
          <Reactions m={m} meId={meId} onReact={fireBurst} />
        </div>
        </>
      ) : prevSame ? (
        <div className="flex gap-4">
          <span className="w-10 shrink-0 select-none pt-1 text-right text-[10px] tabular-nums text-[#80848e] opacity-0 group-hover:opacity-100">{fmtTime(m.at)}{mine && <> <Ticks m={m} /></>}</span>
          <div className="min-w-0 flex-1">
            {replySrc && <ReplyLine replySrc={replySrc} replyMember={replyMember} />}
            <MsgBody m={m} query={query} mine={mine} />
            <Reactions m={m} meId={meId} onReact={fireBurst} />
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
              <span className="text-[11px] font-medium text-[#80848e]">{fmtDayLabel(m.at)} {fmtTime(m.at)}{m.edited ? " · edited" : ""}{mine && <> <Ticks m={m} /></>}</span>
            </p>
            {replySrc && <ReplyLine replySrc={replySrc} replyMember={replyMember} />}
            <MsgBody m={m} query={query} mine={mine} />
            <Reactions m={m} meId={meId} onReact={fireBurst} />
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
      <span className="truncate italic">{replySrc.deleted ? "deleted message" : replySrc.text || (replySrc.type === "image" ? "📷 Photo" : replySrc.type === "voice" ? "🎙️ Voice" : replySrc.type === "file" ? `📁 ${replySrc.fileName || "File"}` : replySrc.type === "poll" ? "📊 Poll" : replySrc.type === "quiz" ? "🧠 Quiz" : replySrc.type === "tictactoe" ? "⭕❌ TicTacToe" : replySrc.type === "riddle" ? "🧩 Paheli" : replySrc.type === "sticker" ? "🎨 Sticker" : replySrc.type === "gif" ? "🎞️ GIF" : replySrc.type === "location" ? "📍 Location" : replySrc.type === "contact" ? "👤 Contact" : "Message")}</span>
    </div>
  );
}

/* ───────── GIF message: animated, rounded corners, tap → fullscreen ───────── */
function GifMessage({ m }: { m: Message }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  // src must be a real URL — m.text is the title ("GIF"), never a URL
  const url = m.src && /^https?:\/\//i.test(m.src) ? m.src : null;
  if (!url || error) return <p className="text-sm italic text-[#80848e]">GIF load nahi hua</p>;
  return (
    <button
      onClick={() => patchUI({ viewer: { msgId: m.id } })}
      className="relative mt-1 block w-56 max-w-full cursor-zoom-in overflow-hidden rounded-xl soft-shadow transition hover:brightness-95 active:scale-[0.98]"
      title="Bada dekho"
    >
      {!loaded && <span className="block aspect-[4/3] w-full animate-pulse bg-black/10" />}
      <img
        src={url}
        alt="GIF"
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`block h-auto w-full object-cover ${loaded ? "" : "hidden"}`}
        loading="lazy"
      />
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
        GIF
      </span>
    </button>
  );
}

function MsgBody({ m, query = "", mine = false }: { m: Message; query?: string; mine?: boolean }) {
  if (m.type === "image" && m.src) {
    return (
      <div className="mt-1">
        {m.caption && <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#2f3035]"><Hi text={m.caption} q={query} /></p>}
        <BlurImage src={m.src} onOpen={() => patchUI({ viewer: { msgId: m.id } })} />
      </div>
    );
  }
  if (m.type === "voice") return <VoiceBubble m={m} />;
  if (m.type === "poll") return <PollMessage m={m} />;
  if (m.type === "quiz") return <QuizMessage m={m} />;
  if (m.type === "tictactoe") return <TicTacToeMessage m={m} />;
  if (m.type === "riddle") return <RiddleMessage m={m} />;
  if (m.type === "sticker") return <StickerMessage m={m} />;
  if (m.type === "gif") return <GifMessage m={m} />;
  if (m.type === "location") return <LocationCard m={m} />;
  if (m.type === "contact") return <ContactCard m={m} />;
  if (m.type === "file") return <FileCard m={m} />;
  const urls = extractUrls(m.text);
  return (
    <>
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#2f3035]">
        {query ? <Hi text={m.text} q={query} /> : <LinkedText text={m.text} />}
      </p>
      {urls.slice(0, 1).map((u) => <LinkPreviewCard key={u} url={u} mine={mine} />)}
    </>
  );
}

// B6 — location card with OSM map tile preview
function tileXY(lat: number, lng: number, z: number) {
  const n = Math.pow(2, z);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}
function LocationCard({ m }: { m: Message }) {
  let lat = 0, lng = 0;
  try { const d = JSON.parse(m.caption || "{}"); lat = +d.lat || 0; lng = +d.lng || 0; } catch { /* ignore */ }
  const z = 15;
  const { x, y } = tileXY(lat, lng, z);
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 block w-full max-w-xs overflow-hidden rounded-xl border border-black/10 bg-white soft-shadow transition hover:border-[#5865f2]/50">
      <span className="relative block h-36 w-full bg-[#e8e4d8]">
        <img src={`https://tile.openstreetmap.org/${z}/${x}/${y}.png`} alt="Map" className="h-full w-full object-cover" loading="lazy" draggable={false} />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[#ed4245] drop-shadow">
          <MapPin size={30} fill="currentColor" stroke="#fff" strokeWidth={1.5} />
        </span>
      </span>
      <span className="flex items-center gap-2.5 px-3.5 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#5865f2]/10 text-[#5865f2]"><Navigation size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[#2f3035]">Location</span>
          <span className="block truncate text-xs tabular-nums text-[#80848e]">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
        </span>
        <span className="shrink-0 text-xs font-bold text-[#5865f2]">Kholo →</span>
      </span>
      <span className="block px-3.5 pb-2 text-[10px] text-[#80848e]">© OpenStreetMap contributors</span>
    </a>
  );
}

// B7 — contact card
function ContactCard({ m }: { m: Message }) {
  let name = "Contact", phone = "";
  try { const d = JSON.parse(m.caption || "{}"); name = d.name || name; phone = String(d.phone || ""); } catch { /* ignore */ }
  return (
    <div className="mt-1.5 flex w-full max-w-xs items-center gap-3 rounded-xl border border-black/10 bg-white p-3.5 soft-shadow">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#5865f2]/10 text-[#5865f2]">
        <User size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-[#2f3035]">{name}</span>
        {phone && <span className="block truncate text-xs tabular-nums text-[#5c5e66]" dir="ltr">{phone}</span>}
      </span>
      {phone && (
        <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn btn-blurple shrink-0 px-3 py-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
          Call
        </a>
      )}
    </div>
  );
}

function Reactions({ m, meId, onReact }: { m: Message; meId: string; onReact?: (emoji: string) => void }) {  const entries = Object.entries(m.reactions).filter(([k, u]) => u.length > 0 && !k.startsWith("__poll_"));
  if (entries.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {entries.map(([emoji, users]) => {
        const mine = users.includes(meId);
        return (
          <button
            key={emoji}
            onClick={() => { toggleReaction(m.id, emoji); onReact?.(emoji); }}
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

// A17 — seen-by list modal
function SeenByModal({ m, onClose }: { m: Message; onClose: () => void }) {
  const members = getState().members;
  const readers = (m.readBy || []).filter((id) => id !== m.from);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="pop-in fixed left-1/2 top-1/2 z-50 max-h-[70vh] w-[320px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-black/10 bg-white p-5 soft-shadow">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-[#2f3035]">Dekha</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#80848e] hover:bg-black/5"><X size={18} /></button>
        </div>
        <p className="mt-0.5 text-sm text-[#80848e]">{readers.length === 0 ? "Abhi kisi ne nahi dekha" : `${readers.length} ne dekha`}</p>
        <div className="mt-3 space-y-1">
          {readers.map((id) => {
            const mb = members.find((x) => x.id === id);
            if (!mb) return null;
            return (
              <div key={id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-black/[0.03]">
                <Avatar m={mb} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#2f3035]">{mb.name}</span>
                <span className="text-xs font-bold text-[#5865f2]">✓ Dekh liya</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
