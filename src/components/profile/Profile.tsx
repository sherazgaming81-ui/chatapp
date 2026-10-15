"use client";
import { motion } from "framer-motion";
import { AtSign, Ban, BellRing, Camera, Check, Crown, Gavel, Sparkles, TriangleAlert, VolumeX, UserCheck, Wand2, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { useStore } from "@/data/store";
import { ACHIEVEMENTS, BANNERS, EFFECTS, FRAMES, NAME_STYLES, SPECIAL_BADGES, avatarUri } from "@/data/assets";
import type { Member, ProfileStyle } from "@/data/types";
import { banMember, blockUser, go, isStaff, me, muteMember, patchSettings, setDraft, setProfile, setProfileStyle, toast, unblockUser, unlock, warnMember, closeAll, setTab, burstConfetti } from "@/data/api";
import { cn, fmtDay, haptic } from "@/lib/util";
import { Avatar, Btn, Card, Field, Page, RoleBadge, Sheet, Tabs, inputCls, Row } from "../ui";

export function FX({ id }: { id: string }) {
  if (id === "none") return null;
  const n = id === "crescent" ? 0 : 14;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {id === "crescent" && <svg viewBox="0 0 100 100" className="absolute -right-2 -top-2 h-24 w-24" style={{ animation: "glow 3s infinite" }}><path d="M64 14a38 38 0 1 0 22 68 30 30 0 1 1-22-68z" fill="#e8bd57" opacity=".9" /></svg>}
      {Array.from({ length: n }).map((_, i) => {
        const l = (i * 41 + 7) % 96, d = (i % 7) * 0.45, dur = 2.5 + (i % 5) * 0.7;
        if (id === "sparkle") return <span key={i} className="absolute text-[#ffe9a8]" style={{ left: `${l}%`, top: `${(i * 29) % 80}%`, fontSize: 8 + (i % 3) * 4, animation: `twinkle ${dur}s ${d}s infinite` }}>✦</span>;
        if (id === "petals") return <span key={i} className="absolute h-2.5 w-1.5 rounded-[50%_0_50%_0] bg-[#ff9ab5]" style={{ left: `${l}%`, top: 0, animation: `fall ${dur + 2}s ${d}s infinite linear` }} />;
        if (id === "fireflies") return <span key={i} className="absolute h-1.5 w-1.5 rounded-full bg-[#fff08a] shadow-[0_0_8px_#ffe94d]" style={{ left: `${l}%`, bottom: `${(i * 13) % 30}%`, animation: `rise ${dur + 1}s ${d}s infinite` }} />;
        return <span key={i} className="absolute h-0.5 w-5 rounded-full bg-white/80" style={{ left: `${l}%`, top: 0, transform: "rotate(65deg)", animation: `fall ${dur}s ${d}s infinite linear` }} />;
      })}
    </div>
  );
}

export function ProfileCard({ m, style, name, about, avatar, children }: { m: Member; style?: ProfileStyle; name?: string; about?: string; avatar?: string; children?: React.ReactNode }) {
  const st = style ?? m.style;
  const banner = BANNERS.find((b) => b.id === st.banner) ?? BANNERS[7];
  const ns = NAME_STYLES.find((n) => n.id === st.nameStyle);
  const nick = useStore((s) => (m.id === s.me ? s.settings.nickname : ""));
  const shown = { ...m, avatar: avatar ?? m.avatar };
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-xl" style={{ boxShadow: `0 20px 50px -20px ${st.accent}66` }}>
      <div className={cn("relative h-28", banner.anim && "banner-anim")} style={{ background: banner.css, backgroundSize: banner.anim ? "200% 200%" : undefined }}>
        <FX id={st.effect} />
      </div>
      <div className="relative px-5 pb-5">
        <div className="-mt-12 flex items-end justify-between">
          <div className="rounded-full bg-surface p-1.5"><Avatar m={shown} size={84} dot /></div>
          <div className="mb-1 flex gap-1.5">{st.badges.slice(0, 4).map((b) => <span key={b} title={SPECIAL_BADGES[b]?.name ?? ACHIEVEMENTS.find((a) => a.id === b)?.title} className="grid h-8 w-8 place-items-center rounded-full bg-surface2 text-base shadow">{SPECIAL_BADGES[b]?.icon ?? ACHIEVEMENTS.find((a) => a.id === b)?.icon}</span>)}</div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-extrabold leading-tight" style={ns?.css ? { backgroundImage: ns.css, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : undefined}>{name ?? m.name}</h3>
          <RoleBadge role={m.role} />
          {m.role === "owner" && <Crown size={16} className="text-gold" />}
        </div>
        {nick && m.id === "me" && <p className="text-xs text-mute">Group me: {nick}</p>}
        <p className="mt-1 flex items-center gap-1.5 text-xs text-mute"><span className={cn("h-2 w-2 rounded-full", m.online ? "bg-accent" : "bg-mute/50")} />{m.online ? "Online hai" : "Offline"} · Join: {fmtDay(m.joined)}</p>
        <div className="mt-3 rounded-2xl bg-surface2 p-3"><p className="text-[11px] font-bold uppercase tracking-wider text-mute">About</p><p className="mt-0.5 text-[15px]">{about ?? m.about}</p></div>
        {children}
      </div>
    </div>
  );
}

export function ProfileSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const m = useStore((s) => s.members.find((x) => x.id === id));
  const blocked = useStore((s) => (id ? s.blocked.includes(id) : false));
  const meId = useStore((s) => s.me);
  const tones = useStore((s) => s.settings.tones);
  const staff = isStaff(me());
  const isMe = id === meId;
  return (
    <Sheet open={!!m} onClose={onClose} noPad>
      {m && (
        <div className="p-4">
          <ProfileCard m={m}>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {isMe ? <>
                <Btn variant="soft" small onClick={() => { onClose(); go("editprofile"); }}>Profile edit</Btn>
                <Btn variant="gold" small onClick={() => { onClose(); go("studio"); }}><Sparkles size={15} />Studio</Btn>
              </> : <>
                <Btn variant="soft" small onClick={() => { setDraft(`@${m.name.split(" ")[0]} `); onClose(); toast("Mention lag gaya", "Group me reply likho", "info", 1800); }}><AtSign size={15} />Mention</Btn>
                <Btn variant="soft" small onClick={() => { const t = ["Chime", "Bell", "Tasbeeh", "Silent"]; patchSettings({ tones: { ...tones, [m.id]: t[(t.indexOf(tones[m.id] ?? "Chime") + 1) % t.length] } }); }}><BellRing size={15} />Tone: {tones[m.id] ?? "Chime"}</Btn>
                <Btn variant="ghost" small className="col-span-2" onClick={() => { blocked ? unblockUser(m.id) : blockUser(m.id); toast(blocked ? "Unblock ho gaya" : "Block ho gaya", m.name, "info", 1800); }}><Ban size={15} />{blocked ? "Unblock karo" : "Block karo"}</Btn>
                {staff && m.role !== "owner" && <>
                  <Btn variant="ghost" small onClick={() => { muteMember(m.id, 3600e3); toast("Mute", `${m.name} 1 ghante ke liye mute`, "info", 1800); }}><VolumeX size={15} />Mute</Btn>
                  <Btn variant="ghost" small onClick={() => { warnMember(m.id, "Rules ki khilaf warzi"); toast("Warning di", m.name, "info", 1800); }}><TriangleAlert size={15} />Warn</Btn>
                  <Btn variant="danger" small className="col-span-2" onClick={() => { banMember(m.id); onClose(); }}><Gavel size={15} />Ban karo</Btn>
                </>}
              </>}
            </div>
          </ProfileCard>
        </div>
      )}
    </Sheet>
  );
}

async function cropSquare(f: File, size = 320): Promise<string> {
  const url = URL.createObjectURL(f);
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const s = Math.min(img.width, img.height), c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  URL.revokeObjectURL(url);
  return c.toDataURL("image/jpeg", 0.88);
}
export { cropSquare };

export function MyProfile() {
  const m = useStore((s) => s.members.find((x) => x.id === s.me)!);
  const ach = useStore((s) => s.achievements);
  return (
    <Page title="Meri profile">
      <ProfileCard m={m}>
        <div className="mt-3 grid grid-cols-2 gap-2"><Btn variant="soft" onClick={() => go("editprofile")}>Profile edit karo</Btn><Btn variant="gold" onClick={() => go("studio")}><Sparkles size={16} />Profile Studio</Btn></div>
      </ProfileCard>
      <Card title="Meri achievements" className="mt-4">
        <Row title={`${Object.keys(ach).length}/${ACHIEVEMENTS.length} unlock hue`} sub="Poori gallery dekho" onClick={() => go("achievements")} />
      </Card>
    </Page>
  );
}

export function EditProfile() {
  const m = useStore((s) => s.members.find((x) => x.id === s.me)!);
  const [name, setName] = useState(m.name), [about, setAbout] = useState(m.about), [avatar, setAvatar] = useState(m.avatar);
  const file = useRef<HTMLInputElement>(null);
  const dirty = name !== m.name || about !== m.about || avatar !== m.avatar;
  return (
    <Page title="Profile edit karo" right={<Btn small disabled={!dirty || !name.trim()} onClick={() => { setProfile({ name: name.trim(), about: about.trim(), avatar }); toast("Profile save ho gayi", "", "info", 1800); }}>Save</Btn>}>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mute">Live preview</p>
      <ProfileCard m={m} name={name || "Aapka naam"} about={about} avatar={avatar} />
      <div className="mt-5 flex items-center gap-4">
        <Avatar m={{ ...m, avatar }} size={64} dot={false} />
        <div className="flex gap-2"><Btn variant="soft" small onClick={() => file.current?.click()}><Camera size={15} />Photo badlo</Btn>{avatar && <Btn variant="ghost" small onClick={() => setAvatar(undefined)}>Hatao</Btn>}</div>
        <input ref={file} hidden type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setAvatar(await cropSquare(f)); e.target.value = ""; }} />
      </div>
      <div className="mt-4">
        <Field label="Naam"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className={inputCls} /></Field>
        <Field label="About" hint={`${about.length}/90`}><textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={90} rows={2} className={cn(inputCls, "resize-none")} /></Field>
      </div>
    </Page>
  );
}

/** E4 — Discord-Nitro-style profile customisation (all unlocked) */
export function ProfileStudio() {
  const m = useStore((s) => s.members.find((x) => x.id === s.me)!);
  const ach = useStore((s) => s.achievements);
  const [st, setSt] = useState<ProfileStyle>(m.style);
  const [tab, setTab] = useState<"banner" | "effect" | "frame" | "name" | "color" | "badge">("banner");
  const earned = [...Object.keys(SPECIAL_BADGES), ...Object.keys(ach)];
  const set = (p: Partial<ProfileStyle>) => { setSt((s) => ({ ...s, ...p })); haptic(6); };
  const dirty = JSON.stringify(st) !== JSON.stringify(m.style);
  const COLS = ["#2ccf8a", "#e8bd57", "#4cc3ff", "#ff6f91", "#c79bff", "#ff8a5c", "#9bdc5a", "#ffffff"];
  return (
    <Page title="Profile Studio" sub="Apni profile ko sajao — sab kuch free" flush right={<Btn small variant="gold" disabled={!dirty} onClick={() => { setProfileStyle(st); toast("Profile saj gayi ✨", "Ab sab ko aisi hi dikhegi", "info"); burstConfetti(); }}>Save</Btn>}>
      <div className="mx-auto max-w-xl">
        <div className="sticky top-0 z-10 bg-bg/95 px-4 pb-3 pt-4 backdrop-blur">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gold"><Wand2 size={14} />Live preview</div>
          <ProfileCard m={m} style={st} />
        </div>
        <div className="px-4 pb-10">
          <Tabs value={tab} onChange={setTab} tabs={[{ v: "banner", l: "Banner" }, { v: "effect", l: "Effects" }, { v: "frame", l: "Frame" }, { v: "name", l: "Naam style" }, { v: "color", l: "Rang" }, { v: "badge", l: "Badges" }]} />
          <div className="mt-4">
            {tab === "banner" && <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{BANNERS.map((b) => <Pick key={b.id} on={st.banner === b.id} onClick={() => set({ banner: b.id })} label={b.name}><div className={cn("h-14 rounded-lg", b.anim && "banner-anim")} style={{ background: b.css, backgroundSize: b.anim ? "200% 200%" : undefined }} /></Pick>)}</div>}
            {tab === "effect" && <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{EFFECTS.map((e) => <Pick key={e.id} on={st.effect === e.id} onClick={() => set({ effect: e.id })} label={e.name}><div className="relative h-14 overflow-hidden rounded-lg bg-[#10201b]"><FX id={e.id} /></div></Pick>)}</div>}
            {tab === "frame" && <div className="grid grid-cols-3 gap-3">{FRAMES.map((f) => <Pick key={f.id} on={st.frame === f.id} onClick={() => set({ frame: f.id })} label={f.name}><div className="grid h-16 place-items-center"><span className="h-11 w-11 rounded-full" style={{ boxShadow: f.css, background: `url("${m.avatar || avatarUri(m.name, m.color)}") center/cover` }} /></div></Pick>)}</div>}
            {tab === "name" && <div className="grid grid-cols-2 gap-3">{NAME_STYLES.map((n) => <Pick key={n.id} on={st.nameStyle === n.id} onClick={() => set({ nameStyle: n.id })} label={n.name}><p className="py-2 text-center text-lg font-extrabold" style={n.css ? { backgroundImage: n.css, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : undefined}>{m.name}</p></Pick>)}</div>}
            {tab === "color" && <div><p className="mb-3 text-sm text-mute">Profile ka khaas rang (shadow aur glow ke liye)</p><div className="flex flex-wrap gap-3">{COLS.map((c) => <button key={c} onClick={() => set({ accent: c })} className={cn("grid h-11 w-11 place-items-center rounded-full border-2 transition", st.accent === c ? "scale-110 border-fg" : "border-transparent")} style={{ background: c }}>{st.accent === c && <Check size={18} className="text-black" />}</button>)}</div></div>}
            {tab === "badge" && (
              <div>
                <p className="mb-3 text-sm text-mute">Zyada se zyada 4 badges dikhayein ({st.badges.length}/4)</p>
                <div className="grid grid-cols-2 gap-2.5">{earned.map((b) => { const info = SPECIAL_BADGES[b] ?? { icon: ACHIEVEMENTS.find((a) => a.id === b)?.icon, name: ACHIEVEMENTS.find((a) => a.id === b)?.title, desc: ACHIEVEMENTS.find((a) => a.id === b)?.desc }; const on = st.badges.includes(b); return (
                  <button key={b} onClick={() => set({ badges: on ? st.badges.filter((x) => x !== b) : st.badges.length < 4 ? [...st.badges, b] : st.badges })} className={cn("flex items-center gap-3 rounded-2xl border p-3 text-left transition", on ? "border-gold bg-gold/10" : "border-line bg-surface")}><span className="text-2xl">{info.icon}</span><span><span className="block text-sm font-bold">{info.name}</span><span className="block text-[11px] text-mute">{info.desc}</span></span></button>); })}</div>
              </div>
            )}
          </div>
          <Btn variant="ghost" className="mt-6 w-full" onClick={() => setSt(m.style)}><RotateCcw size={16} />Wapas purani karo</Btn>
        </div>
      </div>
    </Page>
  );
}
function Pick({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} onClick={onClick} className={cn("relative rounded-2xl border p-2 text-left transition", on ? "border-gold bg-gold/10" : "border-line bg-surface hover:bg-surface2")}>
      {children}<p className="mt-1.5 px-1 text-xs font-semibold">{label}</p>
      {on && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-gold text-[#2a1d02]"><Check size={12} strokeWidth={4} /></span>}
    </motion.button>
  );
}
void UserCheck; void closeAll; void setTab; void unlock;
