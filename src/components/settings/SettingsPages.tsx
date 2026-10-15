"use client";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { Archive, Check, CheckCircle2, ChevronDown, Cloud, Laptop, Lock, LogOut, Mail, MessageCircle, Phone, Play, Plus, Smartphone, Trash2, Upload, Wifi, X, Star, Trophy, Pin as PinIcon, Moon, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { useStore } from "@/data/store";
import * as api from "@/data/api";
import { ACHIEVEMENTS, CHAT_THEMES, WALLPAPERS, getWallpaper } from "@/data/assets";
import { getLocation, closeAll, setTab, go, patchSettings, toast } from "@/data/api";
import { prayerTimes } from "@/data/deen";
import { cn, fmtDateTime, fmtSize, resizeImage, ago, fmtTime } from "@/lib/util";
import { Avatar, Bars, Btn, Card, Confirm, Empty, Field, Page, Ring, Row, Seg, Sheet, Toggle, inputCls } from "../ui";
import { msgSnippet } from "../chat/Message";

const Prev = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
void Prev;

export function WallpaperPage() {
  const s = useStore((x) => x.settings);
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const w = getWallpaper(s.wallpaper);
  const bg = s.wallpaper === "custom" && s.customWallpaper ? { backgroundImage: `url("${s.customWallpaper}")`, backgroundSize: "cover" } : { backgroundColor: w.color, backgroundImage: `url("${w.url}")`, backgroundSize: w.tile ? w.tile + "px" : "cover" };
  const upload = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Sirf photo chuno", "", "info");
    setBusy(true);
    try { const u = await resizeImage(f, 1400, 0.8); patchSettings({ customWallpaper: u, wallpaper: "custom" }); toast("Wallpaper lag gaya", "", "info", 1800); }
    catch { toast("Photo load nahi hui", "Doosri photo try karein", "info"); }
    setBusy(false);
  };
  return (
    <Page title="Chat wallpaper">
      <div className="relative mb-5 h-56 overflow-hidden rounded-3xl border border-line" style={bg}>
        <div className="absolute inset-0" style={{ background: `color-mix(in srgb, var(--bg) ${Math.round(s.wallDim * 100)}%, transparent)` }} />
        <div className="relative flex h-full flex-col justify-end gap-2 p-4"><div className="bub in tail w-fit px-3 py-2 text-sm">Assalamu Alaikum! Kaise ho?</div><div className="bub out tail ml-auto w-fit px-3 py-2 text-sm">Alhamdulillah, aap sunao 😊</div></div>
      </div>
      <Field label={`Roshni / dhundlapan: ${Math.round(s.wallDim * 100)}%`}><input type="range" min={0} max={85} value={Math.round(s.wallDim * 100)} onChange={(e) => patchSettings({ wallDim: +e.target.value / 100 })} className="w-full accent-[var(--accent)]" /></Field>
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => file.current?.click()} disabled={busy} className="grid aspect-[3/4] place-items-center rounded-2xl border-2 border-dashed border-line text-mute hover:border-accent hover:text-accent"><span className="flex flex-col items-center gap-1 text-xs font-bold"><Upload size={22} />{busy ? "Load ho rahi…" : "Apni photo"}</span></button>
        {s.customWallpaper && <button onClick={() => patchSettings({ wallpaper: "custom" })} className={cn("relative aspect-[3/4] overflow-hidden rounded-2xl border-2", s.wallpaper === "custom" ? "border-accent" : "border-transparent")} style={{ backgroundImage: `url("${s.customWallpaper}")`, backgroundSize: "cover", backgroundPosition: "center" }}><span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[11px] font-bold text-white">Meri photo</span></button>}
        {WALLPAPERS.map((x) => (
          <button key={x.id} onClick={() => patchSettings({ wallpaper: x.id })} className={cn("relative aspect-[3/4] overflow-hidden rounded-2xl border-2 transition", s.wallpaper === x.id ? "border-accent" : "border-transparent")} style={{ backgroundColor: x.color, backgroundImage: `url("${x.url}")`, backgroundSize: x.tile ? x.tile * 0.8 + "px" : "cover", backgroundPosition: "center" }}>
            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[11px] font-bold text-white">{x.name}</span>
            {s.wallpaper === x.id && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-fg"><Check size={12} strokeWidth={4} /></span>}
          </button>
        ))}
      </div>
      <input ref={file} hidden type="file" accept="image/*" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
    </Page>
  );
}

export function ChatThemePage() {
  const cur = useStore((x) => x.settings.chatTheme);
  const light = useStore((x) => x.settings.theme === "light");
  return (
    <Page title="Chat theme" sub="Bubble aur accent ke rang">
      <div className="grid grid-cols-2 gap-3">
        {CHAT_THEMES.map((t) => (
          <motion.button whileTap={{ scale: 0.96 }} key={t.id} onClick={() => patchSettings({ chatTheme: t.id })} className={cn("relative overflow-hidden rounded-2xl border-2 bg-surface p-3 text-left", cur === t.id ? "border-accent" : "border-line")}>
            <div className="mb-2 flex flex-col gap-1.5"><span className="w-3/4 rounded-xl rounded-tl-sm bg-bub-in px-2 py-1 text-[11px]">Salam!</span><span className="ml-auto w-3/4 rounded-xl rounded-tr-sm px-2 py-1 text-[11px]" style={{ background: light ? t.outL : t.out, color: light ? "#0d2a1d" : "#fff" }}>Walaikum salam</span></div>
            <p className="flex items-center gap-2 text-sm font-bold"><span className="h-3 w-3 rounded-full" style={{ background: light ? t.accentL : t.accent }} />{t.name}</p>
            {cur === t.id && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-fg"><Check size={12} strokeWidth={4} /></span>}
          </motion.button>
        ))}
      </div>
    </Page>
  );
}

export function DisappearingPage() {
  const d = useStore((x) => x.settings.disappearing);
  const opts = [[864e5, "24 ghante"], [6048e5, "7 din"], [7776e6, "90 din"]] as const;
  return (
    <Page title="Gayab hone wale messages">
      <Card><div className="flex items-center justify-between px-4 py-4"><div><p className="font-semibold">Disappearing messages</p><p className="text-xs text-mute">Naye messages chuni hui muddat ke baad khud ghayab</p></div><Toggle on={d > 0} onChange={(v) => patchSettings({ disappearing: v ? 864e5 : 0 })} /></div></Card>
      {d > 0 && <Card title="Timer">{opts.map(([v, l]) => <Row key={v} icon={<ClockI />} title={l} onClick={() => patchSettings({ disappearing: v })} right={d === v ? <Check className="text-accent" size={20} /> : <span />} />)}</Card>}
      <p className="text-xs text-mute">Jo messages pehle se maujood hain unpar asar nahi hoga. Timer wale messages par chhota ⏱ nishan dikhta hai.</p>
    </Page>
  );
}
const ClockI = () => <span className="text-base">⏱</span>;

export function MutePage() {
  const m = useStore((x) => x.settings.mute);
  return (
    <Page title="Group mute">
      <Card><div className="flex items-center justify-between px-4 py-4"><div><p className="font-semibold">Notifications band</p><p className="text-xs text-mute">{m.on ? (m.until ? `${fmtDateTime(m.until)} tak mute` : "Hamesha ke liye mute") : "Abhi mute nahi hai"}</p></div><Toggle on={m.on} onChange={(v) => api.setMute(v ? "8h" : "off")} /></div></Card>
      {m.on && <Card title="Kitni der ke liye?">{([["8h", "8 ghante", m.until && m.until - Date.now() < 9 * 3600e3], ["1w", "1 hafta", m.until && m.until - Date.now() > 9 * 3600e3], ["always", "Hamesha", m.until === null]] as const).map(([k, l, on]) => <Row key={k} title={l} onClick={() => api.setMute(k)} right={on ? <Check className="text-accent" size={20} /> : <span />} />)}</Card>}
    </Page>
  );
}

export function NightModePage() {
  const n = useStore((x) => x.settings.nightSchedule);
  const set = (p: Partial<typeof n>) => patchSettings({ nightSchedule: { ...n, ...p } });
  const sun = () => { const l = getLocation(), t = prayerTimes(new Date(), l.lat, l.lng); const f = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; set({ from: f(t.maghrib), to: f(t.sunrise), on: true }); toast("Sunset–Sunrise lag gaya", `${f(t.maghrib)} se ${f(t.sunrise)}`, "info"); };
  return (
    <Page title="Night mode schedule" sub="Raat ko khud dark, din ko light">
      <Card><div className="flex items-center justify-between px-4 py-4"><div><p className="font-semibold">Khud-ba-khud badlo</p><p className="text-xs text-mute">Sunset par dark, sunrise par light</p></div><Toggle on={n.on} onChange={(v) => set({ on: v })} /></div></Card>
      <Card title="Waqt"><div className="grid grid-cols-2 gap-3 p-4"><Field label="Dark shuru"><input type="time" value={n.from} onChange={(e) => set({ from: e.target.value })} className={inputCls} /></Field><Field label="Light shuru"><input type="time" value={n.to} onChange={(e) => set({ to: e.target.value })} className={inputCls} /></Field></div></Card>
      <Btn variant="soft" className="w-full" onClick={sun}><Moon size={16} />Meri location ke sunset/sunrise se bharo</Btn>
    </Page>
  );
}

export function StarredPage() {
  const list = useStore((s) => s.messages.filter((m) => m.starred && !m.deleted));
  const members = useStore((s) => s.members);
  return (
    <Page title="Starred messages" sub={`${list.length} mehfooz`}>
      {!list.length ? <Empty icon={<Star size={40} />} text="Koi starred message nahi. Message ko long-press ya hover karke Star karein." /> : (
        <div className="space-y-2">{list.map((m) => (
          <div key={m.id} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3">
            <button className="min-w-0 flex-1 text-left" onClick={() => { closeAll(); setTab("chat"); setTimeout(() => document.getElementById("m-" + m.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300); }}>
              <p className="text-xs font-bold text-accent">{members.find((x) => x.id === m.from)?.name} · {fmtDateTime(m.at)}</p><p className="mt-0.5 line-clamp-3 text-[15px]">{msgSnippet(m)}</p>
            </button>
            <button onClick={() => api.toggleStar(m.id)} className="rounded-full p-2 text-gold hover:bg-surface2" aria-label="Unstar"><Star size={19} fill="currentColor" /></button>
          </div>))}</div>)}
    </Page>
  );
}

export function PinsPage() {
  const list = useStore((s) => s.messages.filter((m) => m.pinned && !m.deleted));
  const staff = api.isStaff(api.me());
  return (
    <Page title="Pinned messages" sub={`${list.length} pin`}>
      {!list.length ? <Empty icon={<PinIcon size={40} />} text="Koi pinned message nahi" /> : <div className="space-y-2">{list.map((m) => (
        <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          <PinIcon className="shrink-0 text-accent" size={18} />
          <button className="min-w-0 flex-1 text-left" onClick={() => { closeAll(); setTab("chat"); setTimeout(() => document.getElementById("m-" + m.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 300); }}><p className="line-clamp-2 text-[15px]">{msgSnippet(m)}</p><p className="text-xs text-mute">{fmtDateTime(m.at)}</p></button>
          {staff && <Btn small variant="ghost" onClick={() => api.togglePin(m.id)}>Unpin</Btn>}
        </div>))}</div>}
    </Page>
  );
}

export function ScheduledPage() {
  const list = useStore((s) => s.scheduled);
  const [edit, setEdit] = useState<{ id?: string; text: string; at: string } | null>(null);
  const toLocal = (t: number) => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  return (
    <Page title="Scheduled messages" sub="Waqt par khud chale jayenge" right={<Btn small onClick={() => setEdit({ text: "", at: toLocal(Date.now() + 3600e3) })}><Plus size={15} />Naya</Btn>}>
      {!list.length ? <Empty icon={<ClockI />} text="Koi scheduled message nahi. Composer me message likh kar ghadi ka button dabayein." /> : <div className="space-y-2">{list.map((x) => (
        <div key={x.id} className="rounded-2xl border border-line bg-surface p-4"><p className="mb-1 text-xs font-bold text-accent">{fmtDateTime(x.at)} {x.kind === "announcement" && "· Elaan"}</p><p className="text-[15px]">{x.text}</p>
          <div className="mt-3 flex gap-2"><Btn small variant="soft" onClick={() => setEdit({ id: x.id, text: x.text, at: toLocal(x.at) })}>Edit</Btn><Btn small variant="ghost" onClick={() => api.cancelScheduled(x.id)}><Trash2 size={14} />Radd</Btn></div></div>))}</div>}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Schedule edit karo" : "Naya scheduled message"}>
        {edit && <><Field label="Message"><textarea rows={3} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} className={cn(inputCls, "resize-none")} /></Field><Field label="Kab bhejna hai"><input type="datetime-local" value={edit.at} onChange={(e) => setEdit({ ...edit, at: e.target.value })} className={inputCls} /></Field>
          <Btn className="w-full" disabled={!edit.text.trim()} onClick={() => { const at = new Date(edit.at).getTime(); if (!at || at < Date.now() + 3000) return toast("Aage ka waqt chuno", "", "info"); edit.id ? api.editScheduled(edit.id, edit.text.trim(), at) : api.scheduleMessage(edit.text.trim(), at); setEdit(null); }}>Save karo</Btn></>}
      </Sheet>
    </Page>
  );
}

export function ChatListPage() {
  const chats = useStore((s) => s.chats);
  const messages = useStore((s) => s.messages);
  const members = useStore((s) => s.members);
  const me = useStore((s) => s.me);
  const activeChatId = useStore((s) => s.ui.activeChatId);
  const branding = useStore((s) => s.owner.branding);
  const open = (id: string) => { api.setActiveChat(id); closeAll(); setTab("chat"); };
  const lastMsg = (chatId: string) => messages.filter((m) => m.chatId === chatId && !m.deleted).slice(-1)[0];
  const unread = (chatId: string) => messages.filter((m) => m.chatId === chatId && m.from !== me && !m.deleted && m.type !== "system").length;
  return (
    <Page title="Chats" sub={`${chats.length} chats`}>
      <div className="space-y-2 p-4">
        {chats.map((c) => {
          const lm = lastMsg(c.id);
          const other = c.type === "dm" ? members.find((m) => m.id === c.otherId) : null;
          const name = c.type === "group" ? (branding.name || c.name) : (other?.name || c.name);
          const photo = c.type === "group" ? (branding.logo || c.photo) : (other?.avatar || c.photo);
          const un = unread(c.id);
          return (
            <button key={c.id} onClick={() => open(c.id)} className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition", c.id === activeChatId ? "border-accent/60 bg-accent/10" : "border-line bg-surface hover:bg-surface2")}>
              <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-[#0b4a37] text-xl font-black text-accent-fg">
                {photo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={photo} alt="" className="h-full w-full object-cover" /> : (c.type === "group" ? "م" : name[0]?.toUpperCase())}
                {c.type === "dm" && other?.online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface bg-accent" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate font-bold">{name}</span>
                  {lm && <span className="shrink-0 text-[11px] text-mute">{fmtTime(lm.at)}</span>}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-mute">{lm ? (lm.from === me ? "Aap: " : "") + msgSnippet(lm) : "Koi message nahi"}</span>
                  {un > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-black text-accent-fg">{un}</span>}
                </span>
              </span>
            </button>
          );
        })}
        {chats.length === 0 && <Empty icon={<MessageCircle size={36} />} text="Koi chat nahi mili" />}
      </div>
    </Page>
  );
}
function useStoreSet(v: boolean) { import("@/data/store").then((m) => m.update(() => ({ archived: v }))); }

export function NicknamePage() {
  const nick = useStore((s) => s.settings.nickname);
  const [v, setV] = useState(nick);
  return (
    <Page title="Group me mera nickname"><Field label="Nickname" hint="Sirf is group me dikhega. Khali chhodo to asli naam dikhega."><input value={v} maxLength={24} onChange={(e) => setV(e.target.value)} className={inputCls} placeholder="Jaise: Abdullah Bhai" /></Field><Btn className="w-full" onClick={() => { api.setNickname(v.trim()); toast("Nickname save", v.trim() || "Asli naam", "info", 1800); }}>Save</Btn></Page>
  );
}

const TONES = ["Chime", "Bell", "Tasbeeh", "Silent"];
function beep(tone: string) {
  if (tone === "Silent") return;
  try { const ctx = new AudioContext(); const f = tone === "Bell" ? [880, 1320] : tone === "Tasbeeh" ? [392, 523, 659] : [660, 880]; f.forEach((hz, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = hz; g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18); g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.18 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.5); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.6); }); setTimeout(() => ctx.close(), 1500); } catch { /* ignore */ }
}
export function TonesPage() {
  const tones = useStore((s) => s.settings.tones);
  const members = useStore((s) => s.members.filter((m) => m.id !== s.me));
  return (
    <Page title="Notification tone" sub="Har member ke liye alag awaaz">
      <Card>{members.map((m) => (
        <div key={m.id} className="flex items-center gap-3 px-4 py-3"><Avatar m={m} size={36} /><span className="flex-1 text-[15px] font-medium">{m.name}</span>
          <select value={tones[m.id] ?? "Chime"} onChange={(e) => { patchSettings({ tones: { ...tones, [m.id]: e.target.value } }); beep(e.target.value); }} className="rounded-lg bg-surface2 px-2.5 py-1.5 text-sm font-semibold">{TONES.map((t) => <option key={t}>{t}</option>)}</select></div>))}</Card>
    </Page>
  );
}

const AUD = [{ v: "everyone", l: "Sab" }, { v: "members", l: "Members" }, { v: "nobody", l: "Koi nahi" }] as const;
export function PrivacyPage() {
  const p = useStore((s) => s.settings.privacy);
  const items: [keyof typeof p, string, string][] = [["lastSeen", "Last seen", "Aap aakhri baar kab online the"], ["photo", "Profile photo", "Aapki photo kaun dekh sakta hai"], ["about", "About", "Aapka about text"], ["online", "Online status", "Aap abhi online hain ya nahi"]];
  return (
    <Page title="Privacy dashboard">
      {items.map(([k, t, d]) => (
        <Card key={k}><div className="p-4"><p className="font-semibold">{t}</p><p className="mb-3 text-xs text-mute">{d}</p><Seg value={p[k]} onChange={(v) => patchSettings({ privacy: { ...p, [k]: v } })} options={AUD.map((a) => ({ v: a.v, l: a.l }))} /></div></Card>
      ))}
      <Card><Row icon={<Lock size={18} />} title="Blocked users" onClick={() => go("blocked")} /><Row icon={<Lock size={18} />} title="App lock" onClick={() => go("applock")} /></Card>
    </Page>
  );
}

export function BlockedPage() {
  const ids = useStore((s) => s.blocked);
  const members = useStore((s) => s.members);
  return (
    <Page title="Blocked users">
      {!ids.length ? <Empty icon={<Lock size={36} />} text="Koi blocked user nahi" /> : <Card>{ids.map((id) => { const m = members.find((x) => x.id === id); return m ? <div key={id} className="flex items-center gap-3 px-4 py-3"><Avatar m={m} size={40} /><div className="flex-1"><p className="font-semibold">{m.name}</p><p className="text-xs text-mute">Iske messages aapko nahi dikhte</p></div><Btn small variant="soft" onClick={() => api.unblockUser(id)}>Unblock</Btn></div> : null; })}</Card>}
    </Page>
  );
}

export function AppLockPage() {
  const l = useStore((s) => s.settings.appLock);
  const [pin, setPin] = useState(""), [pin2, setPin2] = useState(""), [open, setOpen] = useState(false);
  return (
    <Page title="App lock" sub="Mobile: fingerprint · Web: PIN">
      <Card><div className="flex items-center justify-between px-4 py-4"><div><p className="font-semibold">App kholte waqt lock</p><p className="text-xs text-mute">{l.on ? "Chalu — 4 digit PIN set hai" : "Band hai"}</p></div><Toggle on={l.on} onChange={(v) => (v ? setOpen(true) : patchSettings({ appLock: { on: false, pin: "" } }))} /></div></Card>
      {l.on && <Btn variant="soft" className="w-full" onClick={() => setOpen(true)}>PIN badlo</Btn>}
      <Sheet open={open} onClose={() => setOpen(false)} title="4 digit PIN set karo">
        <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" placeholder="PIN" className={cn(inputCls, "mb-3 text-center text-xl tracking-[0.5em]")} />
        <input value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" placeholder="Dobara PIN" className={cn(inputCls, "mb-4 text-center text-xl tracking-[0.5em]")} />
        <Btn className="w-full" disabled={pin.length !== 4 || pin !== pin2} onClick={() => { patchSettings({ appLock: { on: true, pin } }); setOpen(false); setPin(""); setPin2(""); toast("App lock chalu", "Agli baar app kholne par PIN poochhega", "info"); }}>Lock lagao</Btn>
      </Sheet>
    </Page>
  );
}

export function DndPage() {
  const d = useStore((s) => s.settings.dnd);
  const set = (p: Partial<typeof d>) => patchSettings({ dnd: { ...d, ...p } });
  return (
    <Page title="Do Not Disturb">
      <Card><div className="flex items-center justify-between px-4 py-4"><div><p className="font-semibold">DND schedule</p><p className="text-xs text-mute">{api.dndActive() ? "Abhi DND chalu hai — notifications band" : "In auqaat me notifications nahi aayengi"}</p></div><Toggle on={d.on} onChange={(v) => set({ on: v })} /></div></Card>
      <Card title="Waqt"><div className="grid grid-cols-2 gap-3 p-4"><Field label="Shuru"><input type="time" value={d.from} onChange={(e) => set({ from: e.target.value })} className={inputCls} /></Field><Field label="Khatam"><input type="time" value={d.to} onChange={(e) => set({ to: e.target.value })} className={inputCls} /></Field></div></Card>
      <div className="flex gap-2">{[["Raat 11–6", "23:00", "06:00"], ["Raat 10–5", "22:00", "05:00"], ["Dars 9–1", "09:00", "13:00"]].map(([l, a, b]) => <button key={l} onClick={() => set({ from: a, to: b, on: true })} className="rounded-full bg-surface2 px-3 py-1.5 text-sm font-semibold">{l}</button>)}</div>
    </Page>
  );
}

export function StoragePage() {
  const s = useStore((x) => x.storage);
  const total = s.media + s.docs + s.voice + s.cache;
  const [clean, setClean] = useState<null | number>(null);
  const ctl = useAnimation();
  const cats = [["media", "Photo aur video", "#4cc3ff", s.media], ["docs", "Documents", "#e8bd57", s.docs], ["voice", "Voice notes", "#2ccf8a", s.voice]] as const;
  const clear = async () => { await ctl.start({ rotate: [0, -12, 12, -8, 8, 0], scale: [1, 1.1, 1], transition: { duration: 0.7 } }); const f = api.clearCache(); setClean(f); toast("Cache saaf!", `${fmtSize(f)} jagah khaali hui ✨`, "info"); };
  return (
    <Page title="Storage istemal" sub={`Kul ${fmtSize(total)}`}>
      <div className="mb-5 rounded-3xl border border-line bg-surface p-5"><div className="flex h-4 overflow-hidden rounded-full bg-surface2">{[...cats.map((c) => [c[2], c[3]] as const), ["#8fa59d", s.cache] as const].map(([c, v], i) => <motion.div key={i} initial={{ width: 0 }} animate={{ width: `${total ? (v / total) * 100 : 0}%` }} transition={{ type: "spring", stiffness: 90, damping: 18 }} style={{ background: c }} />)}</div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">{[...cats.map((c) => [c[1], c[2]] as const), ["Cache", "#8fa59d"] as const].map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{l}</span>)}</div></div>
      <Card>{cats.map(([k, l, c, v]) => <div key={k} className="flex items-center gap-3 px-4 py-3"><div className="flex-1"><div className="flex justify-between text-sm"><span className="font-semibold">{l}</span><span className="text-mute">{fmtSize(v)}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface2"><motion.div animate={{ width: `${total ? (v / total) * 100 : 0}%` }} className="h-full rounded-full" style={{ background: c }} /></div></div><Btn small variant="ghost" disabled={!v} onClick={() => { api.clearStorage(k); toast(`${l} saaf`, `${fmtSize(v)} khaali`, "info", 1800); }}>Saaf</Btn></div>)}</Card>
      <Card><div className="flex items-center gap-4 p-4"><motion.div animate={ctl} className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent"><Trash2 /></motion.div><div className="flex-1"><p className="font-semibold">Cache</p><p className="text-sm text-mute">{s.cache ? fmtSize(s.cache) + " saaf ho sakta hai" : clean !== null ? `${fmtSize(clean)} abhi khaali hue ✨` : "Cache khaali hai"}</p></div><Btn small disabled={!s.cache} onClick={clear}>Cache saaf karo</Btn></div></Card>
    </Page>
  );
}

export function DataUsagePage() {
  const d = useStore((s) => s.data);
  const days = ["Isn", "Mng", "Bud", "Jum", "Jmt", "Hft", "Aaj"];
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  return (
    <Page title="Data istemal" sub="Pichle 7 din">
      <div className="mb-4 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-line bg-surface p-4"><p className="flex items-center gap-1.5 text-xs font-bold text-mute"><Wifi size={14} />WiFi</p><p className="text-2xl font-black text-accent">{sum(d.wifi)} MB</p></div><div className="rounded-2xl border border-line bg-surface p-4"><p className="flex items-center gap-1.5 text-xs font-bold text-mute"><Smartphone size={14} />Mobile data</p><p className="text-2xl font-black text-gold">{sum(d.mobile)} MB</p></div></div>
      <Card title="WiFi (MB / din)"><div className="p-4"><Bars data={d.wifi} labels={days} highlight={6} /></div></Card>
      <Card title="Mobile data (MB / din)"><div className="p-4"><Bars data={d.mobile} labels={days} color="var(--gold)" highlight={6} /></div></Card>
    </Page>
  );
}

export function QualityPage() {
  const q = useStore((s) => s.settings.quality);
  const o = [["auto", "Auto", "Network ke hisaab se behtareen"], ["best", "Best quality", "Zyada data, saaf photo/video"], ["saver", "Data saver", "Kam data, chhoti files"]] as const;
  return <Page title="Media upload quality">{o.map(([k, t, d]) => <button key={k} onClick={() => patchSettings({ quality: k })} className={cn("mb-3 flex w-full items-center gap-4 rounded-2xl border p-4 text-left", q === k ? "border-accent bg-accent/10" : "border-line bg-surface")}><span className={cn("grid h-6 w-6 place-items-center rounded-full border-2", q === k ? "border-accent bg-accent text-accent-fg" : "border-mute")}>{q === k && <Check size={14} strokeWidth={4} />}</span><span><span className="block font-bold">{t}</span><span className="text-sm text-mute">{d}</span></span></button>)}</Page>;
}

export function AutoDlPage() {
  const a = useStore((s) => s.settings.autoDl);
  const rows = [["photos", "Photos"], ["videos", "Videos"], ["docs", "Documents"]] as const;
  return (
    <Page title="Auto-download">
      {rows.map(([k, l]) => <Card key={k} title={l}><div className="flex items-center justify-between px-4 py-3"><span className="flex items-center gap-2 text-[15px]"><Wifi size={17} className="text-accent" />WiFi par</span><Toggle on={a[k].wifi} onChange={(v) => patchSettings({ autoDl: { ...a, [k]: { ...a[k], wifi: v } } })} /></div><div className="flex items-center justify-between px-4 py-3"><span className="flex items-center gap-2 text-[15px]"><Smartphone size={17} className="text-gold" />Mobile data par</span><Toggle on={a[k].mobile} onChange={(v) => patchSettings({ autoDl: { ...a, [k]: { ...a[k], mobile: v } } })} /></div></Card>)}
      <p className="text-xs text-mute">Dono band hon to &ldquo;kabhi nahi&rdquo; — media par tap karke khud download karna hoga.</p>
    </Page>
  );
}

export function BackupPage() {
  const b = useStore((s) => s.backup);
  const [p, setP] = useState<number | null>(null);
  const go_ = async () => { setP(0); await api.runBackup(setP); setTimeout(() => setP(null), 1200); toast("Backup mukammal ✅", "Aapki chat mehfooz hai", "info"); };
  return (
    <Page title="Chat backup">
      <div className="mb-5 flex flex-col items-center rounded-3xl border border-line bg-surface p-8">
        <Ring value={p === null ? 1 : p / 100} size={150} stroke={10} color={p === 100 ? "var(--gold)" : "var(--accent)"}>{p === null ? <Cloud size={44} className="text-accent" /> : p >= 100 ? <CheckCircle2 size={48} className="text-gold" /> : <span className="text-3xl font-black tabular-nums">{Math.round(p)}%</span>}</Ring>
        <p className="mt-4 font-bold">{p === null ? "Backup tayyar" : p >= 100 ? "Ho gaya!" : "Backup ho raha hai…"}</p>
        <p className="text-sm text-mute">Aakhri backup: {b.last ? ago(b.last) : "kabhi nahi"} · {fmtSize(b.size)}</p>
        <Btn className="mt-5" disabled={p !== null} onClick={go_}>Abhi backup karo</Btn>
      </div>
    </Page>
  );
}

export function DevicesPage() {
  const d = useStore((s) => s.devices);
  const [x, setX] = useState<string | null>(null);
  return (
    <Page title="Linked devices">
      <Card>{d.map((v) => <div key={v.id} className="flex items-center gap-3 px-4 py-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-surface2 text-accent">{v.kind === "pc" ? <Laptop size={20} /> : <Smartphone size={20} />}</span><div className="flex-1"><p className="font-semibold">{v.name}</p><p className="text-xs text-mute">{v.current ? "Abhi active" : ago(v.last)} · {v.city}</p></div>{!v.current && <Btn small variant="ghost" onClick={() => setX(v.id)}><LogOut size={14} />Logout</Btn>}</div>)}</Card>
      <Confirm open={!!x} onClose={() => setX(null)} onYes={() => x && api.logoutDevice(x)} title="Is device ko logout karein?" body="Wo device foran is account se nikal diya jayega." yes="Logout karo" danger />
    </Page>
  );
}

export function SyncPage() {
  const off = useStore((s) => s.ui.offline), syncing = useStore((s) => s.ui.syncing);
  const sync = () => { import("@/data/store").then((m) => { m.update((s) => ({ ui: { ...s.ui, syncing: true } })); setTimeout(() => m.update((s) => ({ ui: { ...s.ui, syncing: false } })), 2200); }); };
  const st = off ? ["Offline", "#c9792b"] : syncing ? ["Sync ho raha hai…", "#4cc3ff"] : ["Synced", "var(--accent)"];
  return (
    <Page title="Cloud sync">
      <div className="mb-5 flex flex-col items-center rounded-3xl border border-line bg-surface p-8"><motion.div animate={syncing ? { rotate: 360 } : { rotate: 0 }} transition={syncing ? { repeat: Infinity, duration: 1.2, ease: "linear" } : {}} className="grid h-20 w-20 place-items-center rounded-full" style={{ background: st[1] + "26", color: st[1] }}><Cloud size={36} /></motion.div><p className="mt-3 text-xl font-black" style={{ color: st[1] }}>{st[0]}</p><p className="text-sm text-mute">{off ? "Net aate hi sab sync ho jayega" : "Sab kuch cloud se mel kha raha hai"}</p><Btn className="mt-4" disabled={off || syncing} onClick={sync}>Abhi sync karo</Btn></div>
    </Page>
  );
}

export function AchievementsPage() {
  const a = useStore((s) => s.achievements);
  return (
    <Page title="Achievements" sub={`${Object.keys(a).length}/${ACHIEVEMENTS.length} unlock`}>
      <div className="grid grid-cols-2 gap-3">{ACHIEVEMENTS.map((x) => { const on = a[x.id]; return <div key={x.id} className={cn("flex flex-col items-center rounded-2xl border p-4 text-center", on ? "border-gold/50 bg-gold/10" : "border-line bg-surface")}><span className={cn("mb-2 text-4xl", !on && "opacity-25 grayscale")}>{x.icon}</span><p className="text-sm font-bold">{on ? x.title : "???"}</p><p className="text-[11px] text-mute">{x.desc}</p>{on && <p className="mt-1 text-[10px] text-gold">{fmtDateTime(on)}</p>}</div>; })}</div>
    </Page>
  );
}

const FAQ = [["Group me kaise judte hain?", "Site ka link kholein, Google se login karein — aap khud Member ban jayenge."], ["Voice note kaise bhejein?", "Message box ke paas mic dabayein, bolein aur Bhejo dabayein."], ["Message edit kaise karein?", "Apne message ko long-press karein (PC par hover karke ⋯) aur Edit chunein. 15 minute tak ye ho sakta hai."], ["Namaz ke auqaat galat lag rahe hain?", "Deen tab me location set karein, auqaat aapke shehar ke mutabiq ho jayenge."], ["Notification nahi aa rahi?", "Settings > Notifications check karein aur DND band hai ya nahi dekhein."], ["Dark mode kaise lagayein?", "Mera tab > Theme me Dark / Light / AMOLED chunein, ya Night mode schedule lagayein."]];
export function HelpPage() {
  const [o, setO] = useState<number | null>(0);
  return (
    <Page title="Madad (Help center)">
      <Card title="Aksar poochhe jaane wale sawal">{FAQ.map(([q, a], i) => <div key={q}><button onClick={() => setO(o === i ? null : i)} className="flex w-full items-center justify-between px-4 py-3.5 text-left"><span className="font-semibold">{q}</span><ChevronDown size={18} className={cn("text-mute transition", o === i && "rotate-180")} /></button><AnimatePresence initial={false}>{o === i && <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 text-sm leading-relaxed text-mute"><span className="block pb-4">{a}</span></motion.p>}</AnimatePresence></div>)}</Card>
      <Card title="Seekhein"><Row icon={<Play size={18} />} title="Ye app kya hai (30 sec video)" onClick={() => go("explainer")} /><Row icon={<Trophy size={18} />} title="Swipe-to-reply tutorial" onClick={() => go("gesture")} /><Row icon={<Star size={18} />} title="App tour dobara dekho" onClick={() => go("tour")} /></Card>
      <Card title="Rabta karein"><Row icon={<MessageCircle size={18} />} title="Owner se group me baat karein" onClick={() => { closeAll(); setTab("chat"); }} /><Row icon={<Mail size={18} />} title="Email: madad@chatsapp.madrasa.pk" onClick={() => window.open("mailto:madad@chatsapp.madrasa.pk")} /><Row icon={<Phone size={18} />} title="Support number" sub="+92 300 0000000" onClick={() => window.open("tel:+923000000000")} /></Card>
    </Page>
  );
}

export function DemoPage() {
  const role = useStore((s) => s.members.find((m) => m.id === s.me)!.role);
  const off = useStore((s) => s.ui.offline);
  const avail = useStore((s) => s.owner.available);
  const eid = useStore((s) => s.settings.eid);
  const rows: [string, string, () => void][] = [
    ["Mujhe mute karo (1 ghanta)", "Owner ke mute ka asar dekho", () => api.muteMember("me", 3600e3)], ["Mujhe unmute karo", "", () => api.unmuteMember("me")],
    ["Mujhe warning do", "3 warnings = auto-mute", () => api.warnMember("me", "Group ke rules ki khilaf warzi")], ["Warnings saaf karo", "", () => api.clearWarns("me")],
    ["Mujhe ban karo", "Foran poori screen block", () => api.banMember("me")], ["Naya message aaye (simulate)", "Toast dekhne ke liye doosre tab par jao", () => api.simulateIncoming()],
    ["Azaan alert dikhao", "Full-screen namaz alert", () => api.triggerAzaan("Asr")], ["Confetti!", "", api.burstConfetti],
    ["Naya version tayyar (simulate)", "Owner ko alert + push button enable", () => api.detectUpdate(true)], ["Saari achievements unlock", "", api.unlockAll],
  ];
  return (
    <Page title="Demo controls" sub="Testing ke liye — asli app me nahi hote">
      <Card title="Role badlo"><div className="p-4"><Seg value={role} onChange={(r) => api.setMyRole(r)} options={[{ v: "owner", l: "Owner" }, { v: "admin", l: "Admin" }, { v: "mod", l: "Mod" }, { v: "member", l: "Member" }]} /><p className="mt-2 text-xs text-mute">Member banne par Owner tab chhup jata hai aur slow mode / mute lagu hote hain.</p></div></Card>
      <Card title="Halat"><Row title="Offline mode" sub="Messages queue me jayenge" right={<Toggle on={off} onChange={(v) => { api.setOffline(v); if (!v) api.flushQueue(); }} />} /><Row title="Eid mode" right={<Toggle on={eid} onChange={(v) => { patchSettings({ eid: v }); if (v) api.burstConfetti(); }} />} />{avail && <Row title={`Update ${avail.version} tayyar`} />}</Card>
      <Card title="Actions">{rows.map(([t, s, f]) => <Row key={t} title={t} sub={s || undefined} onClick={f} />)}</Card>
      <Card title="Khatarnak"><Row danger title="Poora data mita ke dobara shuru" sub="Cache, localStorage, service worker — sab saaf" onClick={() => api.wipeDeviceAndReload()} /></Card>
    </Page>
  );
}
void fmtTime; void X; void Smartphone; void Moon;
