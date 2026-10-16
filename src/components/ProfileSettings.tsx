"use client";
import { useEffect, useRef, useState } from "react";
import {
  X, Camera, LogOut, Check, Shield, Lock, Palette, Database, Trophy,
  User as UserIcon, Eye, EyeOff, Download, KeyRound, Trash2, Upload,
} from "lucide-react";
import { getState, useStore, toast, update } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { signOut, savePrivacyServer } from "@/lib/db";
import { Avatar } from "@/components/ui";
import type { PrivacyAudience, PrivacySettings } from "@/lib/types";
import { BADGES, getBadges } from "@/lib/achievements";
import {
  getPrivacy, setPrivacy, getCompact, setCompact,
  WALLPAPERS, getWallpaper, setWallpaper, getWallpaperCustom, setWallpaperCustom,
  hasPin, setPin, verifyPin, clearPin, usePrefs,
  getLastBackup, markBackupDone,
} from "@/lib/prefs";

async function resizePhoto(file: File, max = 512): Promise<string> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const sc = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.width * sc);
  cv.height = Math.round(img.height * sc);
  cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(url);
  return cv.toDataURL("image/jpeg", 0.85);
}

type Tab = "profile" | "privacy" | "lock" | "appearance" | "backup" | "badges";
const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "lock", label: "App Lock", icon: Lock },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "backup", label: "Backup", icon: Database },
  { id: "badges", label: "Badges", icon: Trophy },
];

const AUDIENCE_LABELS: Record<PrivacyAudience, string> = {
  everyone: "Everyone",
  contacts: "Contacts",
  nobody: "Nobody",
};

/* ───────── Profile tab (existing) ───────── */
function ProfileTab({ onClose }: { onClose: () => void }) {
  const meId = useStore((s) => s.me);
  const me = useStore((s) => s.members.find((m) => m.id === s.me));
  const [name, setName] = useState(me?.name || "");
  const [about, setAbout] = useState(me?.about || "");
  const [photo, setPhoto] = useState<string | undefined>(me?.avatar);
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    try { setPhoto(await resizePhoto(f)); }
    catch { toast("Photo nahi khuli", "Doosri try karo"); }
  };
  const save = async () => {
    const nm = name.trim();
    if (!nm) { toast("Naam khaali nahi ho sakta", ""); return; }
    setSaving(true);
    try {
      await supabase().from("profiles").update({ display_name: nm, about: about.trim(), photo_url: photo || "" }).eq("id", meId);
    } catch { /* offline — local still updates */ }
    update({ members: getState().members.map((m) => (m.id === meId ? { ...m, name: nm, about: about.trim(), avatar: photo } : m)) });
    setSaving(false);
    toast("Profile save ho gaya", "");
    onClose();
  };

  return (
    <div>
      <div className="mb-4 flex justify-center">
        <button onClick={() => file.current?.click()} className="group relative" title="Photo badlo">
          <Avatar m={{ id: meId, name: name || "?", avatar: photo, online: true }} size={84} />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 opacity-0 transition group-hover:opacity-100">
            <Camera size={22} className="text-white" />
          </span>
        </button>
        <input ref={file} hidden type="file" accept="image/*" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-[#80848e]">Naam</label>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder="Aapka naam" className="field mb-3 w-full px-3 py-2.5 text-[15px]" />
      <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-[#80848e]">About</label>
      <textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={120} rows={2} placeholder="Apne baare me kuch…" className="field mb-4 w-full resize-none px-3 py-2.5 text-[15px]" />
      <button onClick={save} disabled={saving} className="btn btn-blurple flex w-full items-center justify-center gap-2 px-4 py-3 text-[15px] disabled:opacity-60">
        <Check size={17} /> {saving ? "Save ho raha…" : "Save karo"}
      </button>
      <button onClick={() => signOut()} className="btn mt-2 flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm text-[#ed4245] hover:bg-[#ed4245]/10">
        <LogOut size={16} /> Logout
      </button>
    </div>
  );
}

/* ───────── E1 — Privacy tab ───────── */
function AudienceRow({ label, desc, value, onChange }: { label: string; desc: string; value: PrivacyAudience; onChange: (v: PrivacyAudience) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-black/[0.03] p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#2f3035]">{label}</p>
        <p className="text-xs text-[#80848e]">{desc}</p>
      </div>
      <div className="flex shrink-0 overflow-hidden rounded-lg border border-black/10">
        {(Object.keys(AUDIENCE_LABELS) as PrivacyAudience[]).map((a) => (
          <button
            key={a}
            onClick={() => onChange(a)}
            className={`px-2.5 py-1.5 text-xs font-bold transition ${value === a ? "bg-[#5865f2] text-white" : "bg-white text-[#5c5e66] hover:bg-black/5"}`}
          >
            {AUDIENCE_LABELS[a]}
          </button>
        ))}
      </div>
    </div>
  );
}
function PrivacyTab() {
  const meId = useStore((s) => s.me);
  const [pr, setPr] = useState<PrivacySettings>(() => getPrivacy(meId));
  const [saving, setSaving] = useState(false);

  const change = async (field: keyof PrivacySettings, v: PrivacyAudience) => {
    const next = setPrivacy(meId, { [field]: v });
    setPr(next);
    setSaving(true);
    try { await savePrivacyServer(meId, next); } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-2 text-xs text-[#80848e]"><Eye size={14} /> Kaun kya dekh sakta hai — ye control karo {saving && "· saving…"}</p>
      <AudienceRow label="Last seen" desc="Aap kab online thay" value={pr.lastSeen} onChange={(v) => change("lastSeen", v)} />
      <AudienceRow label="Profile photo" desc="Aapki photo kaun dekhe" value={pr.photo} onChange={(v) => change("photo", v)} />
      <AudienceRow label="About" desc="Aapka about kaun parhe" value={pr.about} onChange={(v) => change("about", v)} />
      <AudienceRow label="Online status" desc="Online dot kaun dekhe" value={pr.online} onChange={(v) => change("online", v)} />
      <p className="flex items-center gap-1.5 pt-1 text-[11px] text-[#80848e]"><EyeOff size={12} /> "Nobody" par koi nahi dekh payega — aapko bhi unka nahi dikhega jinhon ne nobody kiya</p>
    </div>
  );
}

/* ───────── E6 — App Lock tab ───────── */
function LockTab() {
  const [locked, setLocked] = useState(hasPin());
  const [step, setStep] = useState<"idle" | "set1" | "set2">("idle");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const phase = step === "set1" ? first : second;
  const setPhase = step === "set1" ? setFirst : setSecond;

  const onDigit = async (d: string) => {
    setErr("");
    const cur = (phase + d).slice(0, 4);
    setPhase(cur);
    if (cur.length === 4) {
      if (step === "set1") {
        setStep("set2");
      } else {
        if (cur !== first) { setErr("PIN match nahi hua — dobara try karo"); setSecond(""); return; }
        setBusy(true);
        await setPin(cur);
        setBusy(false);
        setLocked(true); setStep("idle"); setFirst(""); setSecond("");
        toast("App Lock on ho gaya", "Ab PIN ke baghair app nahi khulegi");
      }
    }
  };
  const onBack = () => setPhase(phase.slice(0, -1));

  const remove = () => {
    clearPin();
    setLocked(false);
    toast("App Lock hata diya", "");
  };

  if (!locked && step === "idle") {
    return (
      <div className="py-6 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#5865f2]/10"><Lock size={28} className="text-[#5865f2]" /></span>
        <h4 className="mt-3 text-base font-extrabold text-[#2f3035]">App Lock</h4>
        <p className="mx-auto mt-1 max-w-[260px] text-xs text-[#80848e]">4-digit PIN lagao — app khulne par ya 5 min inactive ke baad PIN mangega</p>
        <button onClick={() => { setStep("set1"); setFirst(""); setSecond(""); setErr(""); }} className="btn btn-blurple mt-4 px-6 py-2.5 text-sm">
          <KeyRound size={15} /> PIN set karo
        </button>
      </div>
    );
  }

  if (locked && step === "idle") {
    return (
      <div className="py-6 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#23a55a]/10"><Shield size={28} className="text-[#23a55a]" /></span>
        <h4 className="mt-3 text-base font-extrabold text-[#2f3035]">App Lock ON hai</h4>
        <p className="mx-auto mt-1 max-w-[260px] text-xs text-[#80848e]">PIN bhool gaye? Logout karke Google se dobara login karo — PIN reset ho jayega</p>
        <div className="mt-4 flex justify-center gap-2">
          <button onClick={() => { setStep("set1"); setFirst(""); setSecond(""); setErr(""); }} className="btn px-4 py-2 text-sm">PIN badlo</button>
          <button onClick={remove} className="btn flex items-center gap-1.5 px-4 py-2 text-sm text-[#ed4245] hover:bg-[#ed4245]/10"><Trash2 size={14} /> Hatao</button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2 text-center">
      <p className="text-sm font-bold text-[#2f3035]">{step === "set1" ? "Naya 4-digit PIN dalo" : "PIN dobara dalo (confirm)"}</p>
      <div className="mt-3 flex justify-center gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`grid h-12 w-12 place-items-center rounded-xl border-2 text-xl font-extrabold ${phase[i] ? "border-[#5865f2] bg-[#5865f2]/5 text-[#2f3035]" : "border-black/10 bg-black/[0.03] text-transparent"}`}>•</span>
        ))}
      </div>
      {err && <p className="mt-2 text-xs font-bold text-[#ed4245]">{err}</p>}
      <div className="mx-auto mt-4 grid max-w-[240px] grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((k, i) => (
          k === "" ? <span key={i} /> :
          k === "back" ? (
            <button key={i} onClick={onBack} className="grid h-12 place-items-center rounded-xl bg-black/[0.04] text-sm font-bold text-[#5c5e66] hover:bg-black/[0.08]">⌫</button>
          ) : (
            <button key={i} onClick={() => onDigit(k)} disabled={busy} className="grid h-12 place-items-center rounded-xl bg-black/[0.04] text-lg font-extrabold text-[#2f3035] transition hover:bg-[#5865f2]/10 active:scale-95 disabled:opacity-50">{k}</button>
          )
        ))}
      </div>
      <button onClick={() => { setStep("idle"); setLocked(hasPin()); }} className="mt-3 text-xs font-bold text-[#80848e] hover:text-[#2f3035]">Cancel</button>
    </div>
  );
}

/* ───────── A18 + A13 — Appearance tab ───────── */
function AppearanceTab() {
  const prefs = usePrefs();
  const [compact, setC] = useState(getCompact());
  const file = useRef<HTMLInputElement>(null);

  const toggleCompact = () => {
    const v = !compact;
    setC(v);
    setCompact(v);
    toast(v ? "Compact mode ON" : "Comfortable mode ON", v ? "Zyada messages ek screen par" : "");
  };

  const pickCustom = async (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    try {
      const url = await resizePhoto(f, 1024);
      setWallpaperCustom(url);
      setWallpaper("custom");
      toast("Wallpaper lag gaya", "");
    } catch { toast("Image nahi khuli", "Doosri try karo"); }
  };

  const custom = getWallpaperCustom();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl bg-black/[0.03] p-3">
        <div>
          <p className="text-sm font-bold text-[#2f3035]">Compact mode</p>
          <p className="text-xs text-[#80848e]">Chhoti bubbles, zyada messages</p>
        </div>
        <button onClick={toggleCompact} className={`relative h-7 w-12 shrink-0 rounded-full transition ${compact ? "bg-[#5865f2]" : "bg-black/15"}`}>
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${compact ? "left-6" : "left-1"}`} />
        </button>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-[#80848e]">Chat wallpaper</p>
        <div className="grid grid-cols-4 gap-2">
          {WALLPAPERS.map((w) => (
            <button
              key={w.id}
              onClick={() => setWallpaper(w.id)}
              className={`relative h-16 overflow-hidden rounded-xl border-2 transition ${prefs.wallpaper === w.id ? "border-[#5865f2]" : "border-black/10 hover:border-black/25"}`}
              style={{ backgroundImage: w.css, backgroundSize: w.id === "dots" || w.id === "grid" ? "14px 14px" : undefined, backgroundColor: "#f4f5fa" }}
              title={w.name}
            >
              {prefs.wallpaper === w.id && <span className="absolute inset-0 grid place-items-center bg-[#5865f2]/25"><Check size={18} className="text-white" /></span>}
              <span className="absolute bottom-0.5 left-1 right-1 truncate text-center text-[9px] font-bold text-[#5c5e66]">{w.name}</span>
            </button>
          ))}
          <button
            onClick={() => setWallpaper("custom")}
            className={`relative h-16 overflow-hidden rounded-xl border-2 transition ${prefs.wallpaper === "custom" ? "border-[#5865f2]" : "border-black/10 hover:border-black/25"}`}
            style={custom ? { backgroundImage: `url(${custom})`, backgroundSize: "cover", backgroundPosition: "center" } : { backgroundColor: "#f4f5fa" }}
            title="Custom"
          >
            {!custom && <span className="absolute inset-0 grid place-items-center"><Upload size={18} className="text-[#80848e]" /></span>}
            {prefs.wallpaper === "custom" && <span className="absolute inset-0 grid place-items-center bg-[#5865f2]/25"><Check size={18} className="text-white" /></span>}
            <span className="absolute bottom-0.5 left-1 right-1 truncate text-center text-[9px] font-bold text-[#5c5e66]">Custom</span>
          </button>
        </div>
        <button onClick={() => file.current?.click()} className="btn mt-2 flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm">
          <Upload size={15} /> Apni photo lagao
        </button>
        <input ref={file} hidden type="file" accept="image/*" onChange={(e) => { pickCustom(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

/* ───────── E8 — Backup tab ───────── */
function BackupTab() {
  const [last, setLast] = useState(getLastBackup());
  const [busy, setBusy] = useState(false);

  const download = () => {
    setBusy(true);
    try {
      const s = getState();
      const me = s.members.find((m) => m.id === s.me);
      const data = {
        meta: {
          app: "ChatsApp",
          exportedAt: new Date().toISOString(),
          exportedBy: me?.name || s.me,
          messageCount: s.messages.length,
          chatCount: s.chats.length,
          version: 1,
        },
        profile: me ? { id: me.id, name: me.name, about: me.about, role: me.role } : null,
        chats: s.chats.map((c) => ({ id: c.id, type: c.type, name: c.name })),
        messages: s.messages.map((m) => ({
          id: m.id, chatId: m.chatId, from: m.from, type: m.type,
          text: m.deleted ? "" : m.text, at: m.at, edited: !!m.edited,
          replyTo: m.replyTo || null,
          // media data URLs skip (bohat bare hote hain) — sirf flag
          hasMedia: !!m.src,
        })),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `chatsapp-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      markBackupDone();
      setLast(Date.now());
      toast("Backup download ho gaya", `${data.meta.messageCount} messages`);
    } catch {
      toast("Backup nahi hua", "Dobara try karo");
    }
    setBusy(false);
  };

  return (
    <div className="py-4 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#5865f2]/10"><Database size={28} className="text-[#5865f2]" /></span>
      <h4 className="mt-3 text-base font-extrabold text-[#2f3035]">Chat Backup</h4>
      <p className="mx-auto mt-1 max-w-[280px] text-xs text-[#80848e]">
        Sari chats ka JSON backup download karo. Sirf aapke device par save hoga — server par kuch upload nahi hota.
      </p>
      {last > 0 && (
        <p className="mt-2 text-xs font-semibold text-[#23a55a]">
          Aakhri backup: {new Date(last).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {new Date(last).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
      <button onClick={download} disabled={busy} className="btn btn-blurple mt-4 flex items-center gap-2 px-6 py-3 text-sm disabled:opacity-60">
        <Download size={16} /> {busy ? "Ban raha…" : "Backup download karo"}
      </button>
    </div>
  );
}

/* ───────── F6 — Badges gallery ───────── */
function BadgesTab() {
  const [mine, setMine] = useState<string[]>([]);
  useEffect(() => { setMine(getBadges()); }, []);
  return (
    <div>
      <h4 className="mb-1 text-base font-extrabold text-[#2f3035]">Mere Badges 🏆</h4>
      <p className="mb-4 text-xs text-[#80848e]">{mine.length}/{BADGES.length} hasil kiye</p>
      <div className="grid grid-cols-2 gap-2.5">
        {BADGES.map((b) => {
          const got = mine.includes(b.id);
          return (
            <div
              key={b.id}
              className={`rounded-2xl border p-4 text-center ${got ? "border-[#d4af37]/50 bg-gradient-to-br from-[#d4af37]/15 to-[#d4af37]/5" : "border-black/10 bg-black/[0.02] opacity-60"}`}
            >
              <p className={`text-3xl ${got ? "" : "grayscale"}`}>{b.icon}</p>
              <p className="mt-2 text-sm font-extrabold text-[#2f3035]">{b.title}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-[#80848e]">{b.desc}</p>
              {got && <p className="mt-2 inline-block rounded-full bg-[#d4af37]/20 px-2 py-0.5 text-[10px] font-bold text-[#8a6d1a]">✓ Hasil</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Main settings modal ───────── */
export default function ProfileSettings({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <>
      <div className="fixed inset-0 z-[96] bg-black/40" onClick={onClose} />
      <div className="pop-in fixed left-1/2 top-1/2 z-[97] flex max-h-[88vh] w-[380px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white soft-shadow">
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-4 py-3">
          <h3 className="text-lg font-extrabold tracking-tight text-[#2f3035]">Settings</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#80848e] hover:bg-black/5"><X size={18} /></button>
        </div>
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-black/10 px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${tab === t.id ? "bg-[#5865f2] text-white" : "text-[#5c5e66] hover:bg-black/5"}`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "profile" && <ProfileTab onClose={onClose} />}
          {tab === "privacy" && <PrivacyTab />}
          {tab === "lock" && <LockTab />}
          {tab === "appearance" && <AppearanceTab />}
          {tab === "backup" && <BackupTab />}
          {tab === "badges" && <BadgesTab />}
        </div>
      </div>
    </>
  );
}
