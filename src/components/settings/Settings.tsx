"use client";
import { motion } from "framer-motion";
import { Archive, BellRing, Clock, Cloud, CloudOff, Database, Download, EyeOff, HardDrive, HelpCircle, Image as ImageIcon, Laptop, Lock, MessageSquareText, Moon, Palette, Pin, Shield, Smartphone, Sparkles, Star, Timer, Trophy, UserX, Wifi, Wrench, Check, Circle, Rows3, Volume2, BellOff, Gauge, Sun } from "lucide-react";
import { useEffect } from "react";
import { useStore } from "@/data/store";
import { burstConfetti, go, patchSettings, setChecklist, toast, unlock } from "@/data/api";
import { cn } from "@/lib/util";
import { Avatar, Card, Marker, RoleBadge, Row, Seg, Toggle, Ring } from "../ui";

export async function requestNotifications() {
  try {
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  } catch { /* ignore */ }
  patchSettings({ notif: true }); setChecklist("notif");
  toast("Notifications on", "Ab naye messages ki khabar milegi", "info");
}

export function SetupChecklist() {
  const c = useStore((s) => s.onboarding.checklist);
  const doneAch = useStore((s) => s.achievements.setup);
  const items: [keyof typeof c, string, () => void][] = [["name", "Apna naam likho", () => go("editprofile")], ["photo", "Photo lagao", () => go("editprofile")], ["about", "About likho", () => go("editprofile")], ["notif", "Notifications on karo", requestNotifications], ["theme", "Theme chuno", () => { document.getElementById("theme-seg")?.scrollIntoView({ behavior: "smooth", block: "center" }); }]];
  const n = items.filter(([k]) => c[k]).length, pct = n / items.length;
  useEffect(() => { if (n === items.length && !doneAch) { burstConfetti(); unlock("setup"); } }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  if (n === items.length && doneAch && Date.now() - doneAch > 8000) return null;
  return (
    <div className="mb-4 overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-[#2d2308] to-surface p-4">
      <div className="mb-3 flex items-center gap-3"><Ring value={pct} size={52} stroke={5} color="var(--gold)"><span className="text-xs font-black text-gold">{Math.round(pct * 100)}%</span></Ring><div><p className="font-extrabold">{n === items.length ? "Mubarak! Setup mukammal 🎉" : "Apna setup mukammal karo"}</p><p className="text-xs text-mute">{n}/{items.length} kaam ho gaye</p></div></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/30"><motion.div className="h-full rounded-full bg-gold" animate={{ width: `${pct * 100}%` }} /></div>
      <div className="mt-3 space-y-1">{items.map(([k, l, f]) => <button key={k} onClick={f} disabled={c[k]} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5">{c[k] ? <Check size={18} className="rounded-full bg-accent p-0.5 text-accent-fg" /> : <Circle size={18} className="text-mute" />}<span className={cn("text-sm font-medium", c[k] && "text-mute line-through")}>{l}</span></button>)}</div>
    </div>
  );
}

export default function Settings() {
  const me = useStore((s) => s.members.find((m) => m.id === s.me)!);
  const st = useStore((s) => s.settings);
  const off = useStore((s) => s.ui.offline), syncing = useStore((s) => s.ui.syncing);
  const starred = useStore((s) => s.messages.filter((m) => m.starred && !m.deleted).length);
  const sync = off ? { l: "Offline", c: "#c9792b", i: <CloudOff size={14} /> } : syncing ? { l: "Sync ho raha hai", c: "#4cc3ff", i: <Cloud size={14} className="animate-pulse" /> } : { l: "Synced", c: "var(--accent)", i: <Cloud size={14} /> };
  return (
    <div className="thin h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-4 safe-t">
        <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-black tracking-tight">Mera</h1>
          <button onClick={() => go("sync")} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold" style={{ background: `color-mix(in srgb, ${sync.c} 18%, transparent)`, color: sync.c }}>{sync.i}{sync.l}</button></div>
        <button onClick={() => go("myprofile")} className="mb-4 flex w-full items-center gap-4 rounded-3xl border border-line bg-surface p-4 text-left transition hover:bg-surface2">
          <Avatar m={me} size={64} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-lg font-extrabold">{me.name}</p><RoleBadge role={me.role} /></div><p className="truncate text-sm text-mute">{me.about}</p></div>
        </button>
        <SetupChecklist />

        <Card title="Dikhawa">
          <div className="px-4 py-3"><p className="mb-2 text-[15px] font-medium">Theme</p><div id="theme-seg"><Seg value={st.theme} onChange={(v) => { patchSettings({ theme: v }); setChecklist("theme"); }} options={[{ v: "dark", l: <span className="flex items-center justify-center gap-1.5"><Moon size={14} />Dark</span> }, { v: "light", l: <span className="flex items-center justify-center gap-1.5"><Sun size={14} />Light</span> }, { v: "amoled", l: "AMOLED" }]} /></div></div>
          <Row icon={<Rows3 size={18} />} title="Compact mode" sub={st.compact ? "Messages kareeb-kareeb (dense)" : "Khula-khula (comfortable)"} right={<Toggle on={st.compact} onChange={(v) => patchSettings({ compact: v })} />} />
          <Row icon={<ImageIcon size={18} />} title="Chat wallpaper" sub="10 designs + apni photo" onClick={() => go("wallpaper")} />
          <Row icon={<Palette size={18} />} title="Chat theme" sub="Bubble aur accent ke rang" onClick={() => go("chattheme")} />
          <Row icon={<Moon size={18} />} title="Night mode schedule" sub={st.nightSchedule.on ? `${st.nightSchedule.from} → ${st.nightSchedule.to}` : "Band"} onClick={() => go("nightmode")} />
          <Row icon={<Sparkles size={18} />} title={<span className="flex items-center">Profile Studio<Marker id="studio" text="Banner, effects aur frames se profile sajao!" /></span>} sub="Animated banners, effects, badges" onClick={() => go("studio")} />
        </Card>

        <Card title="Chat">
          <Row icon={<Star size={18} />} title="Starred messages" sub={`${starred} mehfooz`} onClick={() => go("starred")} />
          <Row icon={<Clock size={18} />} title="Scheduled messages" onClick={() => go("scheduled")} />
          <Row icon={<Pin size={18} />} title="Pinned messages" onClick={() => go("pins")} />
          <Row icon={<Archive size={18} />} title="Chats aur Archived" onClick={() => go("chatlist")} />
          <Row icon={<Timer size={18} />} title="Gayab hone wale messages" sub={st.disappearing ? "Chalu" : "Band"} onClick={() => go("disappearing")} />
          <Row icon={<BellOff size={18} />} title="Group mute" sub={st.groupMute ? "Mute hai" : "Chalu"} onClick={() => go("mute")} />
          <Row icon={<MessageSquareText size={18} />} title="Group me mera nickname" sub={st.nickname || "Set nahi"} onClick={() => go("nickname")} />
          <Row icon={<Volume2 size={18} />} title="Notification tones (har member)" onClick={() => go("tones")} />
          <Row icon={<BellRing size={18} />} title="Notifications" sub={st.notif ? "On" : "Band — on karne ke liye dabayein"} right={<Toggle on={st.notif} onChange={(v) => (v ? requestNotifications() : patchSettings({ notif: false }))} />} />
          <Row icon={<Sparkles size={18} />} title="Haptics (vibration)" right={<Toggle on={st.haptics} onChange={(v) => patchSettings({ haptics: v })} />} />
        </Card>

        <Card title="Privacy aur security">
          <Row icon={<EyeOff size={18} />} title="Privacy dashboard" sub="Last seen, photo, about, online" onClick={() => go("privacy")} />
          <Row icon={<UserX size={18} />} title="Blocked users" onClick={() => go("blocked")} />
          <Row icon={<Lock size={18} />} title="App lock" sub={st.appLock.on ? "Chalu" : "Fingerprint / PIN"} onClick={() => go("applock")} />
          <Row icon={<BellOff size={18} />} title="Do Not Disturb" sub={st.dnd.on ? `${st.dnd.from} – ${st.dnd.to}` : "Band"} onClick={() => go("dnd")} />
          <Row icon={<Laptop size={18} />} title="Linked devices" onClick={() => go("devices")} />
        </Card>

        <Card title="Data aur storage">
          <Row icon={<HardDrive size={18} />} title="Storage istemal" sub="Cache saaf karein" onClick={() => go("storage")} />
          <Row icon={<Wifi size={18} />} title="Data istemal" onClick={() => go("datausage")} />
          <Row icon={<Gauge size={18} />} title="Media quality" sub={{ auto: "Auto", best: "Best quality", saver: "Data saver" }[st.quality]} onClick={() => go("quality")} />
          <Row icon={<Download size={18} />} title="Auto-download" onClick={() => go("autodl")} />
          <Row icon={<Database size={18} />} title="Chat backup" onClick={() => go("backup")} />
        </Card>

        <Card title="Aur">
          <Row icon={<Trophy size={18} />} title="Achievements" onClick={() => go("achievements")} />
          <Row icon={<HelpCircle size={18} />} title="Madad (Help center)" onClick={() => go("help")} />
          <Row icon={<Smartphone size={18} />} title="Dobara onboarding dekho" onClick={() => go("tour")} />
          <Row icon={<Wrench size={18} />} title="Demo controls" sub="Role, mute/ban, offline, azaan…" onClick={() => go("demo")} />
          <Row icon={<Shield size={18} />} title="ChatsApp v2.4.0" sub="Baatein, ab aur qareeb" />
        </Card>
      </div>
    </div>
  );
}
