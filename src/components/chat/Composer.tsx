"use client";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Mic, Paperclip, Pencil, Send, Smile, Keyboard, Timer, WifiOff, X, Reply, CircleDot, Lock } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "@/data/types";
import { useStore } from "@/data/store";
import { BUILTIN_COMMANDS, addRecentEmoji, addRecentSticker, canSend, clearQueue, deleteMessage, displayName, editMessage, execCommand, getDraft, go, isStaff, makeVoiceMessage, me, scheduleMessage, sendMessage, sendText, setDraft, setTab, toast } from "@/data/api";
import { cn, fmtDateTime, resizeImage, haptic } from "@/lib/util";
import { Btn, Hint, Sheet, inputCls, useIsDesktop } from "../ui";
import Pickers from "./Pickers";
import { AttachMenu, ContactShare, LocationShare, PollCreator, pickFileAsMessage, type AttachKind } from "./Attach";
import { Camera, MediaEditor } from "./Media";
import { RecorderBar, VideoNoteRecorder, VoiceTutorial, useRecorder } from "./Voice";
import { msgSnippet } from "./Message";
import { notifyTyping } from "@/data/engine";

export default function Composer({ replyTo, editing, onClearReply, onClearEdit, onSent }: { replyTo: Message | null; editing: Message | null; onClearReply: () => void; onClearEdit: () => void; onSent: () => void }) {
  const desktop = useIsDesktop();
  const [val, setVal] = useState("");
  const [panel, setPanel] = useState(false);
  const [attach, setAttach] = useState(false);
  const [cam, setCam] = useState(false);
  const [editor, setEditor] = useState<string | null>(null);
  const [loc, setLoc] = useState(false), [contact, setContact] = useState(false), [poll, setPoll] = useState(false);
  const [tut, setTut] = useState(false), [vnote, setVnote] = useState(false);
  const [sched, setSched] = useState(false), [schedAt, setSchedAt] = useState("");
  const [queueOpen, setQueueOpen] = useState(false);
  const [cmdIdx, setCmdIdx] = useState(0);
  const [, tick] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const photoIn = useRef<HTMLInputElement>(null), videoIn = useRef<HTMLInputElement>(null), docIn = useRef<HTMLInputElement>(null);
  const rec = useRecorder();
  const tutDone = useStore((s) => s.onboarding.voiceTutorialDone);
  const custom = useStore((s) => s.owner.commands);
  const queued = useStore((s) => s.messages.filter((m) => m.status === "queued"));
  const disappearing = useStore((s) => s.settings.disappearing);
  const role = useStore((s) => s.members.find((m) => m.id === s.me)?.role);
  const slow = useStore((s) => s.owner.slow);
  const slowUntil = useStore((s) => s.ui.slowUntil);
  const mutedUntil = useStore((s) => s.members.find((m) => m.id === s.me)?.mutedUntil);
  const banned = useStore((s) => s.members.find((m) => m.id === s.me)?.banned);
  const replySender = useStore((s) => s.members.find((m) => m.id === replyTo?.from));

  useEffect(() => { setVal(getDraft()); }, []);
  useEffect(() => { if (editing) { setVal(editing.text ?? ""); ta.current?.focus(); } else setVal(getDraft()); }, [editing]);
  useEffect(() => { if (replyTo) ta.current?.focus(); }, [replyTo]);
  useEffect(() => { const i = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { const t = ta.current; if (t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 130) + "px"; } }, [val]);
  void role; void slow; void slowUntil; void mutedUntil; void banned;
  const gate = canSend();

  const cmds = useMemo(() => {
    if (!val.startsWith("/") || val.includes(" ")) return [];
    const q = val.slice(1).toLowerCase(), staff = isStaff(me());
    return [...BUILTIN_COMMANDS.filter((c) => !c.staff || staff), ...custom.map((c) => ({ name: c.name, desc: c.desc + " (custom)", args: undefined as string | undefined }))].filter((c) => c.name.startsWith(q));
  }, [val, custom]);
  useEffect(() => setCmdIdx(0), [val]);

  const change = (v: string) => { setVal(v); if (!editing) { setDraft(v); if (v.trim()) notifyTyping(); } };
  const reset = () => { setVal(""); setDraft(""); };

  const submit = () => {
    const t = val.trim();
    if (!t) return;
    if (editing) { editMessage(editing.id, t); onClearEdit(); toast("Message edit ho gaya", "", "info", 1500); return; }
    if (t.startsWith("/")) {
      const r = execCommand(t);
      if (r.handled) {
        reset(); onSent();
        if (r.open === "poll") setPoll(true);
        else if (r.open) { setTab("khel"); go(r.open); }
        return;
      }
    }
    const m = sendText(t, replyTo?.id);
    if (m) { onClearReply(); reset(); onSent(); haptic(8); }
  };
  const pickCmd = (c: { name: string; args?: string }) => {
    if (c.args) { change(`/${c.name} `); ta.current?.focus(); }
    else { const r = execCommand("/" + c.name); reset(); onSent(); if (r.open === "poll") setPoll(true); else if (r.open) { setTab("khel"); go(r.open); } }
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (cmds.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setCmdIdx((i) => (i + 1) % cmds.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setCmdIdx((i) => (i - 1 + cmds.length) % cmds.length); return; }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) { e.preventDefault(); pickCmd(cmds[cmdIdx]); return; }
      if (e.key === "Escape") { e.preventDefault(); change(""); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && desktop) { e.preventDefault(); submit(); }
    if (e.key === "Escape" && editing) onClearEdit();
  };

  const onAttach = (k: AttachKind) => {
    if (k === "camera") setCam(true); else if (k === "photo") photoIn.current?.click(); else if (k === "video") videoIn.current?.click();
    else if (k === "doc") docIn.current?.click(); else if (k === "location") setLoc(true); else if (k === "contact") setContact(true); else setPoll(true);
  };
  const startRec = async () => { if (!gate.ok) return toast("Message nahi gaya", gate.reason, "info"); if (!tutDone) { setTut(true); return; } await rec.start(); };
  const sendRec = async () => { const r = await rec.stop(); if (r && r.dur >= 1) { sendMessage({ type: "voice", src: r.src, dur: Math.round(r.dur), peaks: r.peaks }); onSent(); } else toast("Bohat chhoti recording", "", "info", 1500); };
  const openSched = () => { const d = new Date(Date.now() + 3600e3); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); setSchedAt(d.toISOString().slice(0, 16)); setSched(true); };

  const hasText = val.trim().length > 0;
  return (
    <div className="relative z-20 border-t border-line bg-surface/95 backdrop-blur">
      {disappearing > 0 && <div className="flex items-center justify-center gap-1.5 bg-surface2 py-1 text-[11px] font-semibold text-mute"><Timer size={12} />Gayab hone wale messages ON · {disappearing === 864e5 ? "24 ghante" : disappearing === 6048e5 ? "7 din" : "90 din"}</div>}
      {queued.length > 0 && <button onClick={() => setQueueOpen(true)} className="flex w-full items-center justify-center gap-2 bg-[#c9792b]/15 py-1.5 text-xs font-bold text-[#e0953f]"><WifiOff size={13} />{queued.length} message queue me hain — net aate hi chale jayenge (dekho)</button>}
      {/* A: reply / edit bar (B17) */}
      <AnimatePresence initial={false}>
        {(replyTo || editing) && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-3 px-3 pb-1 pt-2">
              <span className="text-accent">{editing ? <Pencil size={18} /> : <Reply size={18} />}</span>
              <div className="min-w-0 flex-1 rounded-lg bg-surface2 py-1.5 pl-3 pr-2" style={{ borderLeft: "3px solid var(--accent)" }}>
                <p className="text-xs font-bold text-accent">{editing ? "Message edit ho raha hai" : displayName(replySender)}</p>
                <p className="truncate text-[13px] text-mute">{msgSnippet((editing ?? replyTo)!)}</p>
              </div>
              <button onClick={editing ? () => { onClearEdit(); } : onClearReply} className="rounded-full p-1.5 text-mute hover:bg-surface2"><X size={18} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* H11 command palette */}
      <AnimatePresence>
        {cmds.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute inset-x-2 bottom-full z-30 mb-2 max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-2xl md:inset-x-auto md:left-3 md:w-[420px]">
            <p className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-mute">Commands · ↑↓ chuno · Enter chalao</p>
            {cmds.map((c, i) => (
              <button key={c.name} onMouseEnter={() => setCmdIdx(i)} onClick={() => pickCmd(c)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left", i === cmdIdx ? "bg-accent/15" : "")}>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface2 font-mono text-accent">/</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold">/{c.name}{c.args && <span className="ml-1 font-normal text-mute">&lt;{c.args}&gt;</span>}</span><span className="block truncate text-xs text-mute">{c.desc}</span></span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {!gate.ok && !rec.rec ? (
        <div className="flex items-center justify-center gap-2 px-4 py-4 text-sm font-semibold text-mute"><Lock size={16} />{gate.reason}</div>
      ) : (
        <div className="flex items-end gap-1.5 px-2 py-2">
          {rec.rec ? <RecorderBar r={rec} onCancel={rec.cancel} onSend={sendRec} /> : (
            <>
              <button onClick={() => { setPanel((p) => !p); ta.current?.focus(); }} className="mb-1 rounded-full p-2 text-mute transition hover:text-accent" aria-label="Emoji">{panel ? <Keyboard size={24} /> : <Smile size={24} />}</button>
              <div className="relative mb-1">
                <Hint id="attach" text="Photo, poll, location yahan se" side="top"><button onClick={() => setAttach((a) => !a)} className={cn("rounded-full p-2 text-mute transition hover:text-accent", attach && "rotate-45 text-accent")} aria-label="Attach"><Paperclip size={22} /></button></Hint>
              </div>
              <div className="flex min-h-[44px] min-w-0 flex-1 items-end rounded-3xl bg-surface2 px-4 py-2.5">
                <textarea ref={ta} value={val} onChange={(e) => change(e.target.value)} onKeyDown={onKey} onFocus={() => setPanel(false)} rows={1} placeholder={editing ? "Message edit karo…" : "Message likho…  ( / se commands )"} className="max-h-[130px] min-h-[24px] w-full resize-none bg-transparent text-[16px] leading-6 outline-none placeholder:text-mute" />
              </div>
              {hasText && !editing && <button onClick={openSched} className="mb-1 rounded-full p-2 text-mute hover:text-accent" aria-label="Schedule karo" title="Baad me bhejo"><CalendarClock size={22} /></button>}
              <AnimatePresence mode="wait" initial={false}>
                {hasText ? (
                  <motion.div key="s" initial={{ scale: 0.4, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.4 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                    <Hint id="send" text="Ye dabao message bhejne ke liye" side="top"><button onClick={submit} className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-fg shadow-lg" aria-label="Bhejo"><Send size={20} className="ml-0.5" /></button></Hint>
                  </motion.div>
                ) : (
                  <motion.div key="m" initial={{ scale: 0.4 }} animate={{ scale: 1 }} exit={{ scale: 0.4 }} className="flex items-center gap-1">
                    <button onClick={() => setVnote(true)} className="rounded-full p-2 text-mute hover:text-accent" aria-label="Video note" title="Video note (gol video)"><CircleDot size={22} /></button>
                    <Hint id="mic" text="Awaaz record karne ke liye dabao" side="top"><button onClick={startRec} className="grid h-11 w-11 place-items-center rounded-full bg-accent text-accent-fg shadow-lg" aria-label="Voice note"><Mic size={21} /></button></Hint>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>{panel && <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
        <Pickers
          onEmoji={(e) => { change(val + e); addRecentEmoji(e); }}
          onSticker={(src) => { if (sendMessage({ type: "sticker", src })) { addRecentSticker(src); onSent(); } }}
          onGif={(id) => { if (sendMessage({ type: "gif", src: id })) onSent(); }} />
      </motion.div>}</AnimatePresence>

      <AttachMenu open={attach} onClose={() => setAttach(false)} onPick={onAttach} />
      <input ref={photoIn} hidden type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setEditor(await resizeImage(f, 1600, 0.88)); }} />
      <input ref={videoIn} hidden type="file" accept="video/*" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { await pickFileAsMessage("video", f); onSent(); } }} />
      <input ref={docIn} hidden type="file" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { await pickFileAsMessage("doc", f); onSent(); } }} />
      <AnimatePresence>{cam && <Camera onClose={() => setCam(false)} onCapture={(u) => { setCam(false); setEditor(u); }} />}</AnimatePresence>
      <AnimatePresence>{editor && <MediaEditor src={editor} onClose={() => setEditor(null)} onSend={(u, c) => { sendMessage({ type: "image", src: u, caption: c, size: Math.round(u.length * 0.75), replyTo: replyTo?.id }); setEditor(null); onClearReply(); onSent(); }} />}</AnimatePresence>
      <AnimatePresence>{vnote && <VideoNoteRecorder onClose={() => setVnote(false)} onSend={(p) => { sendMessage({ type: "videonote", src: p.src, dur: Math.round(p.dur) }); onSent(); }} />}</AnimatePresence>
      <LocationShare open={loc} onClose={() => setLoc(false)} />
      <ContactShare open={contact} onClose={() => setContact(false)} />
      <PollCreator open={poll} onClose={() => setPoll(false)} />
      <VoiceTutorial open={tut} onClose={() => setTut(false)} />

      <Sheet open={sched} onClose={() => setSched(false)} title="Baad me bhejo">
        <p className="mb-3 rounded-xl bg-surface2 p-3 text-sm text-mute">{val}</p>
        <input type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} className={cn(inputCls, "mb-4")} />
        <div className="mb-4 flex flex-wrap gap-2">{[["15 min", 15], ["1 ghanta", 60], ["Kal subah", 0]].map(([l, m]) => <button key={l as string} className="rounded-full bg-surface2 px-3 py-1.5 text-sm font-semibold" onClick={() => { const d = m ? new Date(Date.now() + (m as number) * 60e3) : (() => { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(7, 0, 0, 0); return t; })(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); setSchedAt(d.toISOString().slice(0, 16)); }}>{l}</button>)}</div>
        <Btn className="w-full" onClick={() => { const at = new Date(schedAt).getTime(); if (!at || at < Date.now() + 5000) return toast("Waqt aage ka chuno", "", "info"); scheduleMessage(val.trim(), at); reset(); setSched(false); toast("Schedule ho gaya", fmtDateTime(at), "info"); }}>Schedule karo</Btn>
        <button onClick={() => { setSched(false); go("scheduled"); }} className="mt-3 w-full text-center text-sm font-semibold text-accent">Schedule kiye hue messages dekho</button>
      </Sheet>

      <Sheet open={queueOpen} onClose={() => setQueueOpen(false)} title="Queue me messages">
        {queued.length === 0 ? <p className="py-6 text-center text-mute">Queue khaali hai ✅</p> : (
          <>
            <div className="mb-3 space-y-2">{queued.map((q) => <div key={q.id} className="flex items-center gap-3 rounded-xl bg-surface2 px-3 py-2.5"><p className="min-w-0 flex-1 truncate text-sm">{msgSnippet(q)}</p><button onClick={() => deleteMessage(q.id, false)} className="text-danger"><X size={18} /></button></div>)}</div>
            <Btn variant="danger" className="w-full" onClick={() => { clearQueue(); setQueueOpen(false); }}>Saari queue khaali karo</Btn>
          </>
        )}
      </Sheet>
    </div>
  );
}

function useStoreMember(id: string) { return useStore((s) => s.members.find((m) => m.id === id)); }
