"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, Send, X, Square, Reply, Terminal, Pencil, Check, Plus, Smile, BarChart3, MapPin, User, Trash2, Loader2, FileUp } from "lucide-react";
import { useStore, patchUI, toast, update, getState } from "@/lib/store";
import { sendText, sendMedia, sendFile, postAnnouncement, setMute, setBan, addWarn, togglePin, editMessage, sendPoll, sendLocation, sendContact, clearChat, postSystem } from "@/lib/db";
import { isStaff } from "@/lib/types";
import EmojiPicker from "@/components/EmojiPicker";

// ───────── command palette ─────────
interface Cmd { name: string; alias?: string; desc: string; usage: string; staff: boolean; hint?: string }
const COMMANDS: Cmd[] = [
  { name: "announce", alias: "elaan", desc: "Send an announcement to everyone", usage: "/announce <text>", staff: true },
  { name: "mute", desc: "Mute a member for 1 hour", usage: "/mute @name", staff: true },
  { name: "unmute", desc: "Remove a member's mute", usage: "/unmute @name", staff: true },
  { name: "warn", desc: "Warn a member", usage: "/warn @name <reason>", staff: true },
  { name: "ban", desc: "Remove a member from the group", usage: "/ban @name", staff: true },
  { name: "unban", desc: "Remove a ban", usage: "/unban @name", staff: true },
  { name: "pin", desc: "Pin the replied-to message", usage: "/pin", staff: true, hint: "reply to a message first" },
  { name: "clear", alias: "safai", desc: "Clear the whole chat for everyone", usage: "/clear", staff: true },
  { name: "help", desc: "See all commands", usage: "/help", staff: false },
];

function findMemberByName(members: { id: string; name: string }[], raw: string) {
  const q = raw.replace(/^@/, "").trim().toLowerCase();
  if (!q) return null;
  return members.find((m) => m.name.toLowerCase() === q) || members.find((m) => m.name.toLowerCase().includes(q)) || null;
}

// UI-11 — image process: Standard = max 1280 + JPEG 0.82 (tez) · HD = max 2560 + JPEG 0.92 (saaf)
export async function processImage(f: File, quality: "standard" | "hd"): Promise<File> {
  const img = new Image();
  const url = URL.createObjectURL(f);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const max = quality === "hd" ? 2560 : 1280;
  const sc = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.width * sc);
  cv.height = Math.round(img.height * sc);
  cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(url);
  const blob: Blob = await new Promise((res) => cv.toBlob((b) => res(b!), "image/jpeg", quality === "hd" ? 0.92 : 0.82));
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
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
  const [photoFile, setPhotoFile] = useState<File | null>(null); // UI-11 — photo send options (caption + quality)
  const [locBusy, setLocBusy] = useState(false); // B6 location
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const doc = useRef<HTMLInputElement>(null);
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
    const cmd = COMMANDS.find((c) => c.name === cmdName || c.alias === cmdName);
    if (!cmd) { toast("No such command", "Type /help"); return true; }
    const me = members.find((m) => m.id === meId);
    if (cmd.staff && !isStaff(me)) { toast("This command is for staff only", ""); return true; }
    const needUser = ["mute", "unmute", "warn", "ban", "unban"].includes(cmd.name);
    const target = needUser ? findMemberByName(members, args.split(/\s+/)[0] || "") : null;
    if (needUser && !target) { toast("Member not found", "Use the name with @, e.g. /mute @Ahmed"); return true; }
    switch (cmd.name) {
      case "announce":
        if (!args) { toast("Write the announcement text", "/announce <text>"); return true; }
        postAnnouncement(args); toast("Announcement sent", ""); break;
      case "mute":
        setMute(target!.id, Date.now() + 3600e3, chatId); toast("Muted", `${target!.name} · 1 hour`); break;
      case "unmute":
        setMute(target!.id, undefined, chatId); toast("Unmuted", target!.name); break;
      case "warn": {
        const reason = args.split(/\s+/).slice(1).join(" ") || "Broke group rules";
        addWarn(target!.id, reason, chatId); toast("Warning sent", `${target!.name} · ${reason}`); break;
      }
      case "ban":
        setBan(target!.id, true, "", chatId); toast("Banned", target!.name); break;
      case "unban":
        setBan(target!.id, false, "", chatId); toast("Unbanned", target!.name); break;
      case "pin":
        if (!replyTo) { toast("Reply first", "Reply to a message, then type /pin"); return true; }
        togglePin(chatId, replyTo.id); toast("Pinned", ""); break;
      case "clear": {
        const arg = args.trim().toLowerCase();
        if (arg === "all" || arg === "") {
          if (!window.confirm("The whole chat will be deleted for everyone. Are you sure?")) break;
          const n = await clearChat(chatId);
          await postSystem(chatId, "🧹 Chat cleared");
          toast("Chat cleared", `${n} messages deleted`); break;
        }
        const num = parseInt(arg, 10);
        if (!isNaN(num) && num > 0) {
          if (!window.confirm(`The last ${num} messages will be deleted for everyone. Are you sure?`)) break;
          const n = await clearChat(chatId, num);
          await postSystem(chatId, "🧹 Chat cleared");
          toast("Chat cleared", `${n} messages deleted`); break;
        }
        toast("Invalid command", "/clear, /clear all, or /clear 50"); break;
      }
      case "help":
        toast("Commands", "/announce /mute /unmute /warn /ban /unban /pin /clear [all|N]"); break;
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
    if (c.name === "pin" || c.name === "clear") { execCommand("/" + c.name); setText(""); return; }
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
    if (muted || !navigator.geolocation) { toast("Couldn't get your location", "Your browser doesn't support it"); return; }
    setLocBusy(true);
    setAttachOpen(false);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocBusy(false); sendLocation(chatId, p.coords.latitude, p.coords.longitude); },
      () => { setLocBusy(false); toast("Location not found", "Check location permission"); },
      { timeout: 12000 }
    );
  };

  // B7 — device contacts (jahan supported)
  const pickDeviceContact = async (fill: (n: string, p: string) => void) => {
    try {
      const nav = navigator as any;
      if (!nav.contacts?.select) { toast("Not supported", "Enter the name and number manually"); return; }
      const list = await nav.contacts.select(["name", "tel"], { multiple: false });
      const c = list?.[0];
      if (c) fill(c.name?.[0] || "", c.tel?.[0] || "");
    } catch { /* user cancelled */ }
  };

  // Paste (Ctrl+V) ke liye: Standard quality, baghair caption, foran bhejo — modal NAHI khulta.
  // Gallery se photo select ho to PhotoSendModal khulta hai (neeche file input dekho).
  const pickImage = async (f: File | undefined) => {
    if (!f || muted) return;
    if (!f.type.startsWith("image/")) return;
    const processed = await processImage(f, "standard");
    sendMedia(chatId, processed, "image");
  };

  // Har file type: PDF, DOC, MP4, MP3, ZIP, APK...
  const pickFile = async (f: File | undefined) => {
    if (!f || muted) return;
    toast("Uploading…", f.name);
    await sendFile(chatId, f);
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
      toast("Mic didn't open", "Allow microphone permission");
    }
  };
  const stopRec = () => mr.current?.state !== "inactive" && mr.current?.stop();

  return (
    <div className="relative shrink-0 px-4 pb-4 pt-1">
      {showPalette && cmdList.length > 0 && (
        <div className="pop-in glass-strong absolute bottom-full left-4 right-4 z-30 mb-2 overflow-hidden rounded-xl p-1.5">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b93a1]">Commands</p>
          {cmdList.map((c, i) => (
            <button
              key={c.name}
              onClick={() => pickCmd(c)}
              onMouseEnter={() => setCmdSel(i)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${i === cmdSel ? "bg-[#4f8cff] text-white" : "hover:bg-white/[0.06]"}`}
            >
              <Terminal size={16} className={`shrink-0 ${i === cmdSel ? "text-white" : "text-[#8dbcff]"}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-bold ${i === cmdSel ? "text-white" : "text-[#f4f6f8]"}`}>/{c.name}</span>
                <span className={`block truncate text-xs ${i === cmdSel ? "text-white/75" : "text-[#8b93a1]"}`}>{c.desc} · {c.usage}</span>
              </span>
              {c.staff && <span className="badge-pill shrink-0" style={{ background: i === cmdSel ? "rgba(255,255,255,0.25)" : "#4f8cff", color: "#fff" }}>Staff</span>}
            </button>
          ))}
        </div>
      )}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
          <Reply size={15} className="shrink-0 text-[#8dbcff]" />
          <span className="min-w-0 flex-1 truncate text-[#b6bcc7]">
            <b className="text-[#f4f6f8]">Replying to {replyMember?.name || "Member"}</b>: {replyTo.text?.slice(0, 60) || (replyTo.type === "image" ? "📷 Photo" : replyTo.type === "voice" ? "🎙️ Voice" : replyTo.type === "poll" ? "📊 Poll" : replyTo.type === "location" ? "📍 Location" : replyTo.type === "contact" ? "👤 Contact" : "media")}
          </span>
          <button onClick={() => patchUI({ replyTo: null })} className="rounded-md p-1 text-[#8b93a1] hover:bg-white/10"><X size={15} /></button>
        </div>
      )}
      {editingMsg && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#4f8cff]/25 bg-[#4f8cff]/[0.08] px-3 py-2 text-sm">
          <Pencil size={15} className="shrink-0 text-[#8dbcff]" />
          <span className="min-w-0 flex-1 truncate text-[#b6bcc7]">
            <b className="text-[#f4f6f8]">Editing</b> · within 15 min
          </span>
          <button onClick={() => { patchUI({ editingMsg: null }); setText(""); }} className="rounded-md p-1 text-[#8b93a1] hover:bg-white/10" aria-label="Cancel edit"><X size={15} /></button>
        </div>
      )}
      {banned ? (
        <div className="rounded-lg border border-[#ed4245]/30 bg-[#ed4245]/[0.07] px-4 py-3.5 text-center text-sm font-semibold text-[#ed4245]">
          🚫 You're banned — the owner banned you
        </div>
      ) : muted ? (
        <div className="rounded-lg border border-[#ed4245]/30 bg-[#ed4245]/[0.07] px-4 py-3.5 text-center text-sm font-semibold text-[#ed4245]">
          You're muted — you can't send messages
        </div>
      ) : recording ? (
        <div className="glass-strong flex items-center gap-3 rounded-lg px-4 py-3">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ed4245]" />
          <span className="text-sm font-bold tabular-nums text-[#f4f6f8]">{Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, "0")}</span>
          <span className="flex-1 text-sm text-[#8b93a1]">Recording…</span>
          <button onClick={stopRec} className="btn btn-blurple flex items-center gap-1.5 px-4 py-2 text-sm"><Square size={14} /> Send</button>
        </div>
      ) : (
        <div className="glass-strong relative flex items-end gap-1.5 rounded-lg p-2 pl-2">
          <button onClick={() => { setAttachOpen((v) => !v); setEmojiOpen(false); }} className={`rounded-md p-2.5 hover:bg-white/[0.06] ${attachOpen ? "text-[#8dbcff]" : "text-[#b6bcc7] hover:text-[#f4f6f8]"}`} title="Attach">
            <Plus size={20} className={`transition-transform ${attachOpen ? "rotate-45" : ""}`} />
          </button>
          <input ref={file} hidden type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && !muted && f.type.startsWith("image/")) setPhotoFile(f); }} />
          <input ref={doc} hidden type="file" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }} />
          <textarea
            ref={ta}
            rows={1}
            value={text}
            onChange={(e) => onType(e.target.value)}
            onPaste={(e) => {
              // Clipboard paste: PrintScreen / Snipping Tool ke screenshots aur copy ki
              // hui files seedha chat me — pehle handler hi nahi tha, is liye SS paste
              // nahi hota tha. Image ho to photo ki tarah, aur file ho to file ki tarah.
              const cd = e.clipboardData;
              if (!cd) return;
              const pasted: File[] = Array.from(cd.files || []);
              if (!pasted.length) {
                for (const it of Array.from(cd.items || [])) {
                  if (it.kind === "file") { const f = it.getAsFile(); if (f) pasted.push(f); }
                }
              }
              if (!pasted.length) return; // aam text paste — normal rehne do
              e.preventDefault();
              pasted.forEach((f) => { if (f.type.startsWith("image/")) pickImage(f); else pickFile(f); });
            }}
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
            placeholder={editingMsg ? "Edit message…" : "Type a message…"}
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] text-[#f4f6f8] outline-none placeholder:text-[#8b93a1]"
          />
          {/* 2 — send button morph: mic ↔ send smooth transition */}
          <button
            onClick={() => { setEmojiOpen((v) => !v); setAttachOpen(false); }}
            className={`rounded-md p-2.5 hover:bg-white/[0.06] ${emojiOpen ? "text-[#8dbcff]" : "text-[#b6bcc7] hover:text-[#f4f6f8]"}`}
            title="Emoji"
          >
            <Smile size={20} />
          </button>
          <span className="send-morph-wrap">
            <button
              key={text.trim() ? "send" : "mic"}
              onClick={() => (text.trim() ? send() : startRec())}
              className={`send-morph grid h-11 w-11 place-items-center rounded-full text-white soft-shadow transition ${text.trim() ? "bg-[#4f8cff]" : "bg-[#5c5e66]/70 hover:bg-[#5c5e66]"}`}
              title={text.trim() ? (editingMsg ? "Save" : "Send") : "Voice note"}
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
          <div className="pop-in thin-scroll fixed inset-x-4 bottom-24 z-40 max-h-[min(70vh,560px)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#111114] p-2 soft-shadow [-webkit-overflow-scrolling:touch] md:absolute md:inset-x-auto md:bottom-full md:left-2 md:mb-2 md:w-60 md:rounded-xl">
            <AttachItem icon={<ImagePlus size={19} />} color="#4f8cff" bg="#4f8cff/10" label="Photo" desc="Choose from gallery" onClick={() => { setAttachOpen(false); file.current?.click(); }} />
            <AttachItem icon={<FileUp size={19} />} color="#0e9f6e" bg="#0e9f6e/10" label="File" desc="PDF, video, audio, zip…" onClick={() => { setAttachOpen(false); doc.current?.click(); }} />
            <AttachItem icon={<BarChart3 size={19} />} color="#f5a623" bg="#f5a623/10" label="Poll" desc="Ask a question, take votes" onClick={() => { setAttachOpen(false); setPollOpen(true); }} />
            <AttachItem icon={locBusy ? <Loader2 size={19} className="animate-spin" /> : <MapPin size={19} />} color="#23a55a" bg="#23a55a/10" label="Location" desc={locBusy ? "Getting location…" : "Send your location"} onClick={shareLocation} />
            <AttachItem icon={<User size={19} />} color="#8dbcff" bg="#8dbcff/10" label="Contact" desc="Share a number" onClick={() => { setAttachOpen(false); setContactOpen(true); }} />
          </div>
        </>
      )}
      {/* B8 — emoji picker popup */}
      {emojiOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setEmojiOpen(false)} />
          <div className="relative z-40">
            <EmojiPicker
              onPick={insertEmoji}
              onClose={() => setEmojiOpen(false)}
            />
          </div>
        </>
      )}
      {pollOpen && <PollModal chatId={chatId} onClose={() => setPollOpen(false)} />}
      {contactOpen && <ContactModal chatId={chatId} pickDevice={pickDeviceContact} onClose={() => setContactOpen(false)} />}
      {photoFile && <PhotoSendModal chatId={chatId} file={photoFile} onClose={() => setPhotoFile(null)} />}
    </div>
  );
}

function AttachItem({ icon, color, bg, label, desc, onClick }: { icon: React.ReactNode; color: string; bg: string; label: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.06] active:scale-[0.99]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ color, background: bg.replace("/10", "") + "22" }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#f4f6f8]">{label}</span>
        <span className="block truncate text-xs text-[#8b93a1]">{desc}</span>
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
    if (!q.trim() || clean.length < 2) { toast("Write a question + at least 2 options", ""); return; }
    busy.current = true;
    const ms = dur === "1h" ? 3600e3 : dur === "1w" ? 7 * 86400e3 : 86400e3;
    await sendPoll(chatId, q, clean, Date.now() + ms);
    onClose();
  };
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="pop-in fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[340px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-[#111114] p-5 soft-shadow">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-[#f4f6f8]"><BarChart3 size={19} className="text-[#f5a623]" /> Create poll</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#8b93a1] hover:bg-white/[0.06]"><X size={18} /></button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Write your question…" maxLength={140}
          className="field mt-4 w-full px-3.5 py-2.5 text-[15px]" />
        <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-[0.06em] text-[#8b93a1]">Options (2–5)</p>
        <div className="space-y-1.5">
          {opts.map((o, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={o} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} maxLength={60}
                className="field min-w-0 flex-1 px-3.5 py-2.5 text-[15px]" />
              {opts.length > 2 && (
                <button onClick={() => setOpts(opts.filter((_, j) => j !== i))} className="shrink-0 rounded-lg p-2.5 text-[#ed4245] hover:bg-[#ed4245]/10" aria-label="Remove">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        {opts.length < 5 && (
          <button onClick={() => setOpts([...opts, ""])} className="mt-2 text-sm font-bold text-[#8dbcff] hover:underline">+ Add option</button>
        )}
        <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-[0.06em] text-[#8b93a1]">Duration</p>
        <div className="flex gap-1.5">
          {[["1h", "1 hour"], ["1d", "1 day"], ["1w", "1 week"]].map(([v, l]) => (
            <button key={v} onClick={() => setDur(v)}
              className={`flex-1 rounded-lg border px-2 py-2 text-sm font-bold transition ${dur === v ? "border-[#4f8cff] bg-[#4f8cff]/15 text-[#8dbcff]" : "border-white/10 text-[#b6bcc7] hover:border-black/25"}`}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={send} className="btn btn-blurple mt-5 w-full py-3 text-[15px]">Create poll</button>
      </div>
    </>
  );
}

// B7 — contact share modal
function ContactModal({ chatId, pickDevice, onClose }: { chatId: string; pickDevice: (fill: (n: string, p: string) => void) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const send = async () => {
    if (!name.trim()) { toast("Enter a name", ""); return; }
    await sendContact(chatId, name, phone);
    onClose();
  };
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="pop-in fixed left-1/2 top-1/2 z-50 w-[320px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#111114] p-5 soft-shadow">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-[#f4f6f8]"><User size={19} className="text-[#8dbcff]" /> Send contact</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#8b93a1] hover:bg-white/[0.06]"><X size={18} /></button>
        </div>
        <button onClick={() => pickDevice((n, p) => { setName(n); setPhone(p); })}
          className="mt-4 w-full rounded-lg border border-dashed border-[#4f8cff]/40 bg-[#4f8cff]/[0.05] px-3 py-2.5 text-sm font-bold text-[#8dbcff] hover:bg-[#4f8cff]/[0.16]">
          📱 Choose from phone contacts
        </button>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" maxLength={60}
          className="field mt-3 w-full px-3.5 py-2.5 text-[15px]" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Number (optional)" inputMode="tel" maxLength={20}
          className="field mt-2 w-full px-3.5 py-2.5 text-[15px]" dir="ltr" />
        <button onClick={send} className="btn btn-blurple mt-4 w-full py-3 text-[15px]">Send contact</button>
      </div>
    </>
  );
}

// UI-11 — Photo send options: preview + caption + Standard/HD quality
function PhotoSendModal({ chatId, file, onClose }: { chatId: string; file: File; onClose: () => void }) {
  const [caption, setCaption] = useState("");
  const [quality, setQuality] = useState<"standard" | "hd">("standard");
  const [busy, setBusy] = useState(false);
  const [preview] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(preview), [preview]);
  const send = async () => {
    if (busy) return;
    setBusy(true);
    const processed = await processImage(file, quality);
    await sendMedia(chatId, processed, "image", undefined, caption.trim() || undefined);
    onClose();
  };
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="pop-in fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[340px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-[#111114] p-5 soft-shadow">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-extrabold text-[#f4f6f8]"><ImagePlus size={19} className="text-[#8dbcff]" /> Send photo</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#8b93a1] hover:bg-white/[0.06]"><X size={18} /></button>
        </div>
        <img src={preview} alt="" className="mt-4 max-h-56 w-full rounded-xl border border-white/10 object-cover" draggable={false} />
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption…" maxLength={300}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); send(); } }}
          className="field mt-3 w-full px-3.5 py-2.5 text-[15px]" />
        <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-[0.06em] text-[#8b93a1]">Quality</p>
        <div className="flex gap-1.5">
          <button onClick={() => setQuality("standard")}
            className={`flex-1 rounded-lg border px-2 py-2 text-left transition ${quality === "standard" ? "border-[#4f8cff] bg-[#4f8cff]/15" : "border-white/10 hover:border-black/25"}`}>
            <span className={`block text-sm font-bold ${quality === "standard" ? "text-[#8dbcff]" : "text-[#f4f6f8]"}`}>Standard</span>
            <span className="block text-xs text-[#8b93a1]">Fast, smaller file</span>
          </button>
          <button onClick={() => setQuality("hd")}
            className={`flex-1 rounded-lg border px-2 py-2 text-left transition ${quality === "hd" ? "border-[#4f8cff] bg-[#4f8cff]/15" : "border-white/10 hover:border-black/25"}`}>
            <span className={`block text-sm font-bold ${quality === "hd" ? "text-[#8dbcff]" : "text-[#f4f6f8]"}`}>HD</span>
            <span className="block text-xs text-[#8b93a1]">Clearer, larger file</span>
          </button>
        </div>
        <button onClick={send} disabled={busy} className="btn btn-blurple mt-5 flex w-full items-center justify-center gap-1.5 py-3 text-[15px] disabled:opacity-60">
          <Send size={16} /> {busy ? "Sending…" : "Send"}
        </button>
      </div>
    </>
  );
}
