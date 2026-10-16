"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, Send, X, Square, Reply, Terminal, Pencil, Check, Plus, Smile, BarChart3, MapPin, User, Trash2, Loader2 } from "lucide-react";
import { useStore, patchUI, toast, update, getState } from "@/lib/store";
import { sendText, sendMedia, postAnnouncement, setMute, setBan, addWarn, togglePin, editMessage, sendPoll, sendLocation, sendContact, sendQuiz, sendTicTacToe, sendRiddle, sendSticker, clearChat, postSystem } from "@/lib/db";
import { isStaff } from "@/lib/types";
import EmojiPicker from "@/components/EmojiPicker";

// ───────── command palette ─────────
interface Cmd { name: string; desc: string; usage: string; staff: boolean; hint?: string }
const COMMANDS: Cmd[] = [
  { name: "elaan", desc: "Sab ko elaan bhejo", usage: "/elaan <text>", staff: true },
  { name: "mute", desc: "Member ko 1 ghante ke liye mute", usage: "/mute @naam", staff: true },
  { name: "unmute", desc: "Member ka mute hatao", usage: "/unmute @naam", staff: true },
  { name: "warn", desc: "Member ko warning do", usage: "/warn @naam <wajah>", staff: true },
  { name: "ban", desc: "Member ko group se nikalo", usage: "/ban @naam", staff: true },
  { name: "unban", desc: "Ban hatao", usage: "/unban @naam", staff: true },
  { name: "pin", desc: "Reply wale message ko pin karo", usage: "/pin", staff: true, hint: "pehle kisi message par reply karo" },
  { name: "safai", desc: "Poori chat sab ke liye saaf karo", usage: "/safai", staff: true },
  { name: "quiz", desc: "Deen Quiz shuru karo (5 sawal)", usage: "/quiz", staff: false },
  { name: "tictactoe", desc: "Kisi ko TicTacToe challenge karo", usage: "/tictactoe @naam", staff: false },
  { name: "paheli", desc: "Aaj ki paheli bhejo", usage: "/paheli", staff: false },
  { name: "help", desc: "Saare commands dekho", usage: "/help", staff: false },
];

function findMemberByName(members: { id: string; name: string }[], raw: string) {
  const q = raw.replace(/^@/, "").trim().toLowerCase();
  if (!q) return null;
  return members.find((m) => m.name.toLowerCase() === q) || members.find((m) => m.name.toLowerCase().includes(q)) || null;
}

export default function Composer({ chatId }: { chatId: string }) {
  const replyTo = useStore((s) => s.ui.replyTo);
  const editingMsg = useStore((s) => s.ui.editingMsg);
  const members = useStore((s) => s.members);
  const meId = useStore((s) => s.me);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [attachOpen, setAttachOpen] = useState(false); // B1 attachment menu
  const [emojiOpen, setEmojiOpen] = useState(false); // B8 emoji picker
  const [pollOpen, setPollOpen] = useState(false); // B5 poll creator
  const [contactOpen, setContactOpen] = useState(false); // B7 contact share
  const [locBusy, setLocBusy] = useState(false); // B6 location
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const typingSent = useRef(0);

  // A19 — per-chat drafts in localStorage
  useEffect(() => {
    try { setText(localStorage.getItem(`chatsapp:draft:${chatId}`) || ""); } catch { setText(""); }
    patchUI({ editingMsg: null, replyTo: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // B16 — entering edit mode fills composer
  useEffect(() => {
    if (editingMsg) { setText(editingMsg.text); ta.current?.focus(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingMsg?.id]);

  const replyMember = replyTo ? members.find((m) => m.id === replyTo.from) : null;
  const muted = (() => {
    const me = members.find((m) => m.id === meId);
    return me?.mutedUntil !== undefined && (me.mutedUntil === null || me.mutedUntil > Date.now());
  })();
  const banned = (() => {
    const me = members.find((m) => m.id === meId);
    return !!me?.banned;
  })();

  useEffect(() => {
    if (!recording) return;
    const iv = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [recording]);

  const send = () => {
    if (muted || banned) return;
    // B16 — edit mode: save instead of send
    if (editingMsg) {
      if (!text.trim()) return;
      editMessage(editingMsg.id, text);
      setText("");
      try { localStorage.removeItem(`chatsapp:draft:${chatId}`); } catch { /* ignore */ }
      ta.current?.focus();
      return;
    }
    if (!text.trim()) return;
    try { navigator.vibrate?.(12); } catch { /* 14 — halki haptic feedback */ }
    // command execution
    if (text.startsWith("/")) {
      execCommand(text).then((ok) => { if (ok) { setText(""); patchUI({ replyTo: null }); ta.current?.focus(); } });
      return;
    }
    sendText(chatId, text, replyTo?.id);
    setText("");
    try { localStorage.removeItem(`chatsapp:draft:${chatId}`); } catch { /* ignore */ }
    patchUI({ replyTo: null });
    ta.current?.focus();
  };

  const execCommand = async (raw: string): Promise<boolean> => {
    const parts = raw.slice(1).trim().split(/\s+/);
    const cmdName = (parts[0] || "").toLowerCase();
    const args = raw.slice(1 + parts[0].length).trim();
    const cmd = COMMANDS.find((c) => c.name === cmdName);
    if (!cmd) { toast("Aisa koi command nahi", "/help likho"); return true; }
    const me = members.find((m) => m.id === meId);
    if (cmd.staff && !isStaff(me)) { toast("Ye command staff ke liye hai", ""); return true; }
    const needUser = ["mute", "unmute", "warn", "ban", "unban"].includes(cmdName);
    const target = needUser ? findMemberByName(members, args.split(/\s+/)[0] || "") : null;
    if (needUser && !target) { toast("Member nahi mila", "Naam @ ke sath likho, jaise /mute @Ahmed"); return true; }
    switch (cmdName) {
      case "elaan":
        if (!args) { toast("Text likho", "/elaan <text>"); return true; }
        postAnnouncement(args); toast("Elaan bhej diya", ""); break;
      case "mute":
        setMute(target!.id, Date.now() + 3600e3, chatId); toast("Mute kar diya", `${target!.name} · 1 ghanta`); break;
      case "unmute":
        setMute(target!.id, undefined, chatId); toast("Unmute kar diya", target!.name); break;
      case "warn": {
        const reason = args.split(/\s+/).slice(1).join(" ") || "Group rules torhe";
        addWarn(target!.id, reason, chatId); toast("Warning de di", `${target!.name} · ${reason}`); break;
      }
      case "ban":
        setBan(target!.id, true, "", chatId); toast("Ban kar diya", target!.name); break;
      case "unban":
        setBan(target!.id, false, "", chatId); toast("Unban kar diya", target!.name); break;
      case "pin":
        if (!replyTo) { toast("Pehle reply karo", "Kisi message par reply karke /pin likho"); return true; }
        togglePin(chatId, replyTo.id); toast("Pin kar diya", ""); break;
      case "safai": {
        if (!window.confirm("Poori chat sab ke liye delete ho jayegi. Pakka saaf karni hai?")) break;
        const n = await clearChat(chatId);
        await postSystem(chatId, "🧹 Chat saaf kar di gayi");
        toast("Chat saaf ho gayi", `${n} messages delete`); break;
      }
      case "quiz":
        sendQuiz(chatId); setText(""); break;
      case "tictactoe": {
        const t = findMemberByName(members, args.split(/\s+/)[0] || "");
        if (!t) { toast("Member nahi mila", "Jaise /tictactoe @Ahmed"); return true; }
        if (t.id === meId) { toast("Khud ko challenge nahi!", "Kisi aur ko chunno"); return true; }
        sendTicTacToe(chatId, t.id); setText(""); break;
      }
      case "paheli":
        sendRiddle(chatId); setText(""); break;
      case "help":
        toast("Commands", "/elaan /mute /unmute /warn /ban /unban /pin /safai /quiz /tictactoe /paheli"); break;
    }
    return true;
  };

  // command palette visibility
  const showPalette = text.startsWith("/") && !text.includes("\n");
  const cmdFilter = showPalette ? text.slice(1).split(/\s+/)[0].toLowerCase() : "";
  const me = members.find((m) => m.id === meId);
  const cmdList = showPalette ? COMMANDS.filter((c) => (!c.staff || isStaff(me)) && c.name.startsWith(cmdFilter)) : [];
  const [cmdSel, setCmdSel] = useState(0);
  useEffect(() => { setCmdSel(0); }, [cmdFilter]);

  const pickCmd = (c: Cmd) => {
    if (c.name === "help") { execCommand("/help"); setText(""); return; }
    if (c.name === "pin" || c.name === "safai" || c.name === "quiz" || c.name === "paheli") { execCommand("/" + c.name); setText(""); return; }
    setText("/" + c.name + " ");
    ta.current?.focus();
  };

  const onType = (v: string) => {
    setText(v);
    // A19 — save draft (skip while editing)
    if (!editingMsg) {
      try { localStorage.setItem(`chatsapp:draft:${chatId}`, v); } catch { /* ignore */ }
    }
    const now = Date.now();
    if (now - typingSent.current > 2800 && v.trim()) {
      typingSent.current = now;
      try { (window as any).__sendTyping?.(chatId); } catch { /* ignore */ }
    }
  };

  // B8 — emoji cursor par insert karo
  const insertEmoji = (e: string) => {
    const el = ta.current;
    if (!el) { onType(text + e); return; }
    const s = el.selectionStart ?? text.length;
    const en = el.selectionEnd ?? text.length;
    const v = text.slice(0, s) + e + text.slice(en);
    onType(v);
    requestAnimationFrame(() => {
      try { el.focus(); el.selectionStart = el.selectionEnd = s + e.length; } catch { /* ignore */ }
    });
  };

  // B6 — location flow
  const shareLocation = () => {
    if (muted || !navigator.geolocation) { toast("Location nahi mil saki", "Browser support nahi karta"); return; }
    setLocBusy(true);
    setAttachOpen(false);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocBusy(false); sendLocation(chatId, p.coords.latitude, p.coords.longitude); },
      () => { setLocBusy(false); toast("Location nahi mili", "Permission check karo"); },
      { timeout: 12000 }
    );
  };

  // B7 — device contacts (jahan supported)
  const pickDeviceContact = async (fill: (n: string, p: string) => void) => {
    try {
      const nav = navigator as any;
      if (!nav.contacts?.select) { toast("Support nahi", "Naam + number khud likho"); return; }
      const list = await nav.contacts.select(["name", "tel"], { multiple: false });
      const c = list?.[0];
      if (c) fill(c.name?.[0] || "", c.tel?.[0] || "");
    } catch { /* user cancelled */ }
  };

  const pickImage = async (f: File | undefined) => {
    if (!f || muted) return;
    if (!f.type.startsWith("image/")) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const max = 1280;
    const sc = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.width * sc);
    cv.height = Math.round(img.height * sc);
    cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
    URL.revokeObjectURL(url);
    const blob: Blob = await new Promise((res) => cv.toBlob((b) => res(b!), "image/jpeg", 0.82));
    sendMedia(chatId, new File([blob], "photo.jpg", { type: "image/jpeg" }), "image");
  };

  const startRec = async () => {
    if (muted || banned) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const rec = new MediaRecorder(stream);
      mr.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 500 && recSecs >= 1) {
          await sendMedia(chatId, new File([blob], "voice.webm", { type: blob.type }), "voice", recSecs);
        }
        setRecording(false);
        setRecSecs(0);
      };
      rec.start();
      setRecording(true);
    } catch {
      toast("Mic nahi khula", "Microphone ki permission do");
    }
  };
  const stopRec = () => mr.current?.state !== "inactive" && mr.current?.stop();

  return (
    <div className="relative shrink-0 px-4 pb-4 pt-1">
      {showPalette && cmdList.length > 0 && (
        <div className="pop-in glass-strong absolute bottom-full left-4 right-4 z-30 mb-2 overflow-hidden rounded-xl p-1.5">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#80848e]">Commands</p>
          {cmdList.map((c, i) => (
            <button
              key={c.name}
              onClick={() => pickCmd(c)}
              onMouseEnter={() => setCmdSel(i)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${i === cmdSel ? "bg-[#5865f2] text-white" : "hover:bg-black/5"}`}
            >
              <Terminal size={16} className={`shrink-0 ${i === cmdSel ? "text-white" : "text-[#5865f2]"}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-bold ${i === cmdSel ? "text-white" : "text-[#2f3035]"}`}>/{c.name}</span>
                <span className={`block truncate text-xs ${i === cmdSel ? "text-white/75" : "text-[#80848e]"}`}>{c.desc} · {c.usage}</span>
              </span>
              {c.staff && <span className="badge-pill shrink-0" style={{ background: i === cmdSel ? "rgba(255,255,255,0.25)" : "#5865f2", color: "#fff" }}>Staff</span>}
            </button>
          ))}
        </div>
      )}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-black/[0.04] px-3 py-2 text-sm">
          <Reply size={15} className="shrink-0 text-[#5865f2]" />
          <span className="min-w-0 flex-1 truncate text-[#5c5e66]">
            <b className="text-[#2f3035]">{replyMember?.name || "Member"}</b> ko reply: {replyTo.text?.slice(0, 60) || (replyTo.type === "image" ? "📷 Photo" : replyTo.type === "voice" ? "🎙️ Voice" : replyTo.type === "poll" ? "📊 Poll" : replyTo.type === "location" ? "📍 Location" : replyTo.type === "contact" ? "👤 Contact" : "media")}
          </span>
          <button onClick={() => patchUI({ replyTo: null })} className="rounded-md p-1 text-[#80848e] hover:bg-black/10"><X size={15} /></button>
        </div>
      )}
      {editingMsg && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#5865f2]/25 bg-[#5865f2]/[0.08] px-3 py-2 text-sm">
          <Pencil size={15} className="shrink-0 text-[#5865f2]" />
          <span className="min-w-0 flex-1 truncate text-[#5c5e66]">
            <b className="text-[#2f3035]">Edit kar rahe ho</b> · 15 min ke andar
          </span>
          <button onClick={() => { patchUI({ editingMsg: null }); setText(""); }} className="rounded-md p-1 text-[#80848e] hover:bg-black/10" aria-label="Cancel edit"><X size={15} /></button>
        </div>
      )}
      {banned ? (
        <div className="rounded-lg border border-[#ed4245]/30 bg-[#ed4245]/[0.07] px-4 py-3.5 text-center text-sm font-semibold text-[#ed4245]">
          🚫 Aap ban ho — owner ne ban kiya hai
        </div>
      ) : muted ? (
        <div className="rounded-lg border border-[#ed4245]/30 bg-[#ed4245]/[0.07] px-4 py-3.5 text-center text-sm font-semibold text-[#ed4245]">
          Aap mute ho — message nahi bhej sakte
        </div>
      ) : recording ? (
        <div className="glass-strong flex items-center gap-3 rounded-lg px-4 py-3">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ed4245]" />
          <span className="text-sm font-bold tabular-nums text-[#2f3035]">{Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, "0")}</span>
          <span className="flex-1 text-sm text-[#80848e]">Recording…</span>
          <button onClick={stopRec} className="btn btn-blurple flex items-center gap-1.5 px-4 py-2 text-sm"><Square size={14} /> Bhejo</button>
        </div>
      ) : (
        <div className="glass-strong relative flex items-end gap-1.5 rounded-lg p-2 pl-2">
          <button onClick={() => { setAttachOpen((v) => !v); setEmojiOpen(false); }} className={`rounded-md p-2.5 hover:bg-black/5 ${attachOpen ? "text-[#5865f2]" : "text-[#5c5e66] hover:text-[#2f3035]"}`} title="Attach">
            <Plus size={20} className={`transition-transform ${attachOpen ? "rotate-45" : ""}`} />
          </button>
          <input ref={file} hidden type="file" accept="image/*" onChange={(e) => { pickImage(e.target.files?.[0]); e.target.value = ""; }} />
          <textarea
            ref={ta}
            rows={1}
            value={text}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (showPalette && cmdList.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                setCmdSel((s) => (e.key === "ArrowDown" ? (s + 1) % cmdList.length : (s - 1 + cmdList.length) % cmdList.length));
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (showPalette && cmdList.length > 0 && text.slice(1).trim().split(/\s+/).length === 1) {
                  pickCmd(cmdList[cmdSel]);
                  return;
                }
                send();
              }
              if (e.key === "Escape" && showPalette) { setText(""); }
            }}
            placeholder={editingMsg ? "Message edit karo…" : "Message likho…"}
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] text-[#2f3035] outline-none placeholder:text-[#80848e]"
          />
          {/* 2 — send button morph: mic ↔ send smooth transition */}
          <button
            onClick={() => { setEmojiOpen((v) => !v); setAttachOpen(false); }}
            className={`rounded-md p-2.5 hover:bg-black/5 ${emojiOpen ? "text-[#5865f2]" : "text-[#5c5e66] hover:text-[#2f3035]"}`}
            title="Emoji"
          >
            <Smile size={20} />
          </button>
          <span className="send-morph-wrap">
            <button
              key={text.trim() ? "send" : "mic"}
              onClick={() => (text.trim() ? send() : startRec())}
              className={`send-morph grid h-11 w-11 place-items-center rounded-full text-white soft-shadow transition ${text.trim() ? "bg-[#5865f2]" : "bg-[#5c5e66]/70 hover:bg-[#5c5e66]"}`}
              title={text.trim() ? (editingMsg ? "Save" : "Bhejo") : "Voice note"}
            >
              {text.trim() ? (editingMsg ? <Check size={18} /> : <Send size={18} />) : <Mic size={18} />}
            </button>
          </span>
        </div>
      )}
      {/* B1 — attachment menu: bottom sheet (mobile) / popup (web) */}
      {attachOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAttachOpen(false)} />
          <div className="pop-in fixed inset-x-4 bottom-24 z-40 rounded-2xl border border-black/10 bg-white p-2 soft-shadow md:absolute md:inset-x-auto md:bottom-full md:left-2 md:mb-2 md:w-60 md:rounded-xl">
            <AttachItem icon={<ImagePlus size={19} />} color="#5865f2" bg="#5865f2/10" label="Photo" desc="Gallery se chuno" onClick={() => { setAttachOpen(false); file.current?.click(); }} />
            <AttachItem icon={<BarChart3 size={19} />} color="#f5a623" bg="#f5a623/10" label="Poll" desc="Sawal pucho, vote karao" onClick={() => { setAttachOpen(false); setPollOpen(true); }} />
            <AttachItem icon={locBusy ? <Loader2 size={19} className="animate-spin" /> : <MapPin size={19} />} color="#23a55a" bg="#23a55a/10" label="Location" desc={locBusy ? "Location le rahe hain…" : "Apni location bhejo"} onClick={shareLocation} />
            <AttachItem icon={<User size={19} />} color="#9b7bff" bg="#9b7bff/10" label="Contact" desc="Number share karo" onClick={() => { setAttachOpen(false); setContactOpen(true); }} />
          </div>
        </>
      )}
      {/* B8 — emoji picker popup (+ B10 stickers tab) */}
      {emojiOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setEmojiOpen(false)} />
          <div className="relative z-40">
            <EmojiPicker
              onPick={insertEmoji}
              onSticker={(id) => { setEmojiOpen(false); sendSticker(chatId, id); }}
              onClose={() => setEmojiOpen(false)}
            />
          </div>
        </>
      )}
      {pollOpen && <PollModal chatId={chatId} onClose={() => setPollOpen(false)} />}
      {contactOpen && <ContactModal chatId={chatId} pickDevice={pickDeviceContact} onClose={() => setContactOpen(false)} />}
    </div>
  );
}

function AttachItem({ icon, color, bg, label, desc, onClick }: { icon: React.ReactNode; color: string; bg: string; label: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-black/5 active:scale-[0.99]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ color, background: bg.replace("/10", "") + "22" }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#2f3035]">{label}</span>
        <span className="block truncate text-xs text-[#80848e]">{desc}</span>
      </span>
    </button>
  );
}

// B5 — poll creator modal
function PollModal({ chatId, onClose }: { chatId: string; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const [dur, setDur] = useState("1d");
  const busy = useRef(false);
  const send = async () => {
    if (busy.current) return;
    const clean = opts.map((o) => o.trim()).filter(Boolean);
    if (!q.trim() || clean.length < 2) { toast("Sawal + 2 options likho", ""); return; }
    busy.current = true;
    const ms = dur === "1h" ? 3600e3 : dur === "1w" ? 7 * 86400e3 : 86400e3;
    await sendPoll(chatId, q, clean, Date.now() + ms);
    onClose();
  };
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="pop-in fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[340px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-black/10 bg-white p-5 soft-shadow">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-[#2f3035]"><BarChart3 size={19} className="text-[#f5a623]" /> Poll banao</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#80848e] hover:bg-black/5"><X size={18} /></button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sawal likho…" maxLength={140}
          className="field mt-4 w-full px-3.5 py-2.5 text-[15px]" />
        <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-[0.06em] text-[#80848e]">Options (2–5)</p>
        <div className="space-y-1.5">
          {opts.map((o, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} maxLength={60}
                className="field min-w-0 flex-1 px-3.5 py-2.5 text-[15px]" />
              {opts.length > 2 && (
                <button onClick={() => setOpts(opts.filter((_, j) => j !== i))} className="shrink-0 rounded-lg p-2.5 text-[#ed4245] hover:bg-[#ed4245]/10" aria-label="Hatao">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {opts.length < 5 && (
          <button onClick={() => setOpts([...opts, ""])} className="mt-2 text-sm font-bold text-[#5865f2] hover:underline">+ Option add karo</button>
        )}
        <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-[0.06em] text-[#80848e]">Muddat</p>
        <div className="flex gap-1.5">
          {[["1h", "1 ghanta"], ["1d", "1 din"], ["1w", "1 hafta"]].map(([v, l]) => (
            <button key={v} onClick={() => setDur(v)}
              className={`flex-1 rounded-lg border px-2 py-2 text-sm font-bold transition ${dur === v ? "border-[#5865f2] bg-[#5865f2]/10 text-[#5865f2]" : "border-black/10 text-[#5c5e66] hover:border-black/25"}`}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={send} className="btn btn-blurple mt-5 w-full py-3 text-[15px]">Poll bhejo</button>
      </div>
    </>
  );
}

// B7 — contact share modal
function ContactModal({ chatId, pickDevice, onClose }: { chatId: string; pickDevice: (fill: (n: string, p: string) => void) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const send = async () => {
    if (!name.trim()) { toast("Naam likho", ""); return; }
    await sendContact(chatId, name, phone);
    onClose();
  };
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="pop-in fixed left-1/2 top-1/2 z-50 w-[320px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-black/10 bg-white p-5 soft-shadow">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-[#2f3035]"><User size={19} className="text-[#9b7bff]" /> Contact bhejo</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#80848e] hover:bg-black/5"><X size={18} /></button>
        </div>
        <button onClick={() => pickDevice((n, p) => { setName(n); setPhone(p); })}
          className="mt-4 w-full rounded-lg border border-dashed border-[#5865f2]/40 bg-[#5865f2]/[0.05] px-3 py-2.5 text-sm font-bold text-[#5865f2] hover:bg-[#5865f2]/[0.1]">
          📱 Phone contacts se chuno
        </button>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam" maxLength={60}
          className="field mt-3 w-full px-3.5 py-2.5 text-[15px]" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Number (optional)" inputMode="tel" maxLength={20}
          className="field mt-2 w-full px-3.5 py-2.5 text-[15px]" dir="ltr" />
        <button onClick={send} className="btn btn-blurple mt-4 w-full py-3 text-[15px]">Contact bhejo</button>
      </div>
    </>
  );
}
