"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, Send, X, Square, Reply, Terminal } from "lucide-react";
import { useStore, patchUI, toast, update, getState } from "@/lib/store";
import { sendText, sendMedia, postAnnouncement, setMute, setBan, addWarn, togglePin } from "@/lib/db";
import { isStaff } from "@/lib/types";

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
  { name: "safai", desc: "Chat view saaf karo (sirf aapke liye)", usage: "/safai", staff: true },
  { name: "help", desc: "Saare commands dekho", usage: "/help", staff: false },
];

function findMemberByName(members: { id: string; name: string }[], raw: string) {
  const q = raw.replace(/^@/, "").trim().toLowerCase();
  if (!q) return null;
  return members.find((m) => m.name.toLowerCase() === q) || members.find((m) => m.name.toLowerCase().includes(q)) || null;
}

export default function Composer({ chatId }: { chatId: string }) {
  const replyTo = useStore((s) => s.ui.replyTo);
  const members = useStore((s) => s.members);
  const meId = useStore((s) => s.me);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const file = useRef<HTMLInputElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const typingSent = useRef(0);

  const replyMember = replyTo ? members.find((m) => m.id === replyTo.from) : null;
  const muted = (() => {
    const me = members.find((m) => m.id === meId);
    return me?.mutedUntil !== undefined && (me.mutedUntil === null || me.mutedUntil > Date.now());
  })();

  useEffect(() => {
    if (!recording) return;
    const iv = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [recording]);

  const send = () => {
    if (muted || !text.trim()) return;
    // command execution
    if (text.startsWith("/")) {
      if (execCommand(text)) { setText(""); patchUI({ replyTo: null }); ta.current?.focus(); }
      return;
    }
    sendText(chatId, text, replyTo?.id);
    setText("");
    patchUI({ replyTo: null });
    ta.current?.focus();
  };

  const execCommand = (raw: string): boolean => {
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
        setMute(target!.id, Date.now() + 3600e3); toast("Mute kar diya", `${target!.name} · 1 ghanta`); break;
      case "unmute":
        setMute(target!.id, undefined); toast("Unmute kar diya", target!.name); break;
      case "warn": {
        const reason = args.split(/\s+/).slice(1).join(" ") || "Group rules torhe";
        addWarn(target!.id, reason); toast("Warning de di", `${target!.name} · ${reason}`); break;
      }
      case "ban":
        setBan(target!.id, true); toast("Ban kar diya", target!.name); break;
      case "unban":
        setBan(target!.id, false); toast("Unban kar diya", target!.name); break;
      case "pin":
        if (!replyTo) { toast("Pehle reply karo", "Kisi message par reply karke /pin likho"); return true; }
        togglePin(chatId, replyTo.id); toast("Pin kar diya", ""); break;
      case "safai": {
        update({ messages: getState().messages.filter((m) => m.chatId !== chatId) });
        toast("Chat saaf ho gayi", "Sirf aapke view se"); break;
      }
      case "help":
        toast("Commands", "/elaan /mute /unmute /warn /ban /unban /pin /safai"); break;
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
    if (c.name === "pin" || c.name === "safai") { execCommand("/" + c.name); setText(""); return; }
    setText("/" + c.name + " ");
    ta.current?.focus();
  };

  const onType = (v: string) => {
    setText(v);
    const now = Date.now();
    if (now - typingSent.current > 2800 && v.trim()) {
      typingSent.current = now;
      try { (window as any).__sendTyping?.(); } catch { /* ignore */ }
    }
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
    if (muted) return;
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
    } catch { /* mic denied */ }
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
            <b className="text-[#2f3035]">{replyMember?.name || "Member"}</b> ko reply: {replyTo.text?.slice(0, 60) || "media"}
          </span>
          <button onClick={() => patchUI({ replyTo: null })} className="rounded-md p-1 text-[#80848e] hover:bg-black/10"><X size={15} /></button>
        </div>
      )}
      {muted ? (
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
        <div className="glass-strong flex items-end gap-1.5 rounded-lg p-2 pl-2">
          <button onClick={() => file.current?.click()} className="rounded-md p-2.5 text-[#5c5e66] hover:bg-black/5 hover:text-[#2f3035]" title="Photo bhejo">
            <ImagePlus size={20} />
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
            placeholder="Message likho…"
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] text-[#2f3035] outline-none placeholder:text-[#80848e]"
          />
          <button onClick={startRec} className="rounded-md p-2.5 text-[#5c5e66] hover:bg-black/5 hover:text-[#2f3035]" title="Voice note">
            <Mic size={20} />
          </button>
          <button onClick={send} disabled={!text.trim()} className="btn btn-blurple grid h-11 w-11 place-items-center disabled:opacity-40" title="Bhejo">
            <Send size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
