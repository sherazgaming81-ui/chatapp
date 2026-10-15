"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, Copy, Crown, Download, FileText, Gavel, Image as ImageIcon, Info, Link2, Mic, MicOff, PhoneOff, Plus, QrCode, ScrollText, Search, Share2, Shield, Timer, UserMinus, UserPlus, Users, Video, VideoOff, Volume2, VolumeX, BarChart3, BellOff, Pencil, Palette, Phone, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { useStore } from "@/data/store";
import * as api from "@/data/api";
import { SITE_URL } from "@/data/seed";
import { cn, fmtDay, fmtSize, fmtDur, resizeImage } from "@/lib/util";
import { Avatar, Bars, Btn, Card, Confirm, Empty, Field, Page, RoleBadge, Row, Seg, Sheet, Toggle, inputCls, Chip } from "../ui";
import { FILTERS, MediaViewer, type ViewItem } from "../chat/Media";
import { EMOJI } from "@/data/assets";
import type { Member } from "@/data/types";

export function GroupInfo() {
  const b = useStore((s) => s.owner.branding);
  const members = useStore((s) => s.members);
  const msgs = useStore((s) => s.messages);
  const rules = useStore((s) => s.owner.rules);
  const mute = useStore((s) => s.settings.groupMute);
  const owner = api.isOwner();
  const media = msgs.filter((m) => (m.type === "image" || m.type === "video") && m.src && !m.deleted).slice(-4).reverse();
  return (
    <Page title="Group info" right={owner ? <button onClick={() => api.go("groupedit")} className="rounded-full p-2 hover:bg-surface2"><Pencil size={19} /></button> : undefined} flush>
      <div className="mx-auto max-w-2xl pb-10">
        <div className="relative h-36" style={{ background: b.banner ? `url(${b.banner}) center/cover` : `linear-gradient(120deg, ${b.accent}, #0a2a3a)` }} />
        <div className="relative -mt-12 px-4">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-4 border-bg bg-gradient-to-br from-accent to-[#0b4a37] text-4xl font-black text-accent-fg">{b.logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={b.logo} alt="" className="h-full w-full object-cover" /> : "م"}</div>
          <h2 className="mt-3 text-2xl font-black">{b.name}</h2>
          <p className="text-sm text-mute">Group · {members.filter((m) => !m.banned).length} members · {members.filter((m) => m.online && !m.banned).length} online</p>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{b.desc}</p>
        </div>
        <div className="mt-5 px-4">
          <Card title="Shared media" right={<button onClick={() => api.go("media")} className="text-xs font-bold text-accent">Sab dekho</button>}>
            <div className="grid grid-cols-4 gap-1 p-2">{media.length ? media.map((m) => /* eslint-disable-next-line @next/next/no-img-element */ <button key={m.id} onClick={() => api.go("media")} className="aspect-square overflow-hidden rounded-lg bg-surface2">{m.type === "image" ? <img src={m.src} alt="" className="h-full w-full object-cover" /> : <Video className="m-auto mt-6" />}</button>) : <p className="col-span-4 p-4 text-center text-sm text-mute">Abhi koi media nahi</p>}</div>
          </Card>
          <Card title="Group rules" right={owner ? <button onClick={() => api.go("rules")} className="text-xs font-bold text-accent">Edit</button> : undefined}>
            <div className="px-4 py-3"><p className="whitespace-pre-line text-sm leading-relaxed text-mute">{rules}</p></div>
          </Card>
          <Card>
            <Row icon={<Users size={18} />} title="Members" sub={`${members.length} log`} onClick={() => api.go("members")} />
            {owner && <Row icon={<UserPlus size={18} />} title="Members add karo" onClick={() => api.go("addmembers")} />}
            <Row icon={<QrCode size={18} />} title="Site link + QR" sub="App share karne ke liye" onClick={() => api.go("sitelink")} />
            <Row icon={<ImageIcon size={18} />} title="Media, docs aur links" onClick={() => api.go("media")} />
            <Row icon={<BarChart3 size={18} />} title="Group insights" onClick={() => api.go("insights")} />
            <Row icon={<ScrollText size={18} />} title="Group rules" onClick={() => api.go("rules")} />
            <Row icon={<BellOff size={18} />} title="Group mute" sub={mute ? "Mute hai" : "Chalu"} onClick={() => api.go("mute")} />
            <Row icon={<Timer size={18} />} title="Gayab hone wale messages" onClick={() => api.go("disappearing")} />
            <Row icon={<Palette size={18} />} title="Wallpaper aur theme" onClick={() => api.go("wallpaper")} />
          </Card>
        </div>
      </div>
    </Page>
  );
}

export function MembersPage() {
  const members = useStore((s) => s.members);
  const meId = useStore((s) => s.me);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [rm, setRm] = useState<string | null>(null);
  const owner = api.isOwner();
  const list = members.filter((m) => m.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  const s = members.find((m) => m.id === sel);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <Page title="Members" sub={`${members.length} log · ${members.filter((m) => m.online).length} online`} right={owner ? <button onClick={() => api.go("addmembers")} className="rounded-full p-2 hover:bg-surface2"><UserPlus size={20} /></button> : undefined}>
      <div className="relative mb-3"><Search size={17} className="absolute left-3.5 top-3.5 text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Member dhoondo…" className={cn(inputCls, "pl-10")} /></div>
      <div className="space-y-1.5">
        {list.map((m) => (
          <div key={m.id} className="relative overflow-hidden rounded-2xl">
            {owner && m.id !== meId && <div className="absolute inset-0 flex items-center justify-end bg-danger px-5 text-sm font-bold text-white"><UserMinus size={18} className="mr-2" />Nikalo</div>}
            <motion.div drag={owner && m.id !== meId ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.5, right: 0 }} onDragEnd={(_, i) => i.offset.x < -90 && setRm(m.id)}
              onContextMenu={(e) => { e.preventDefault(); setSel(m.id); }} onPointerDown={(e) => { if (e.pointerType === "touch") press.current = setTimeout(() => setSel(m.id), 520); }} onPointerUp={() => press.current && clearTimeout(press.current)} onPointerMove={() => press.current && clearTimeout(press.current)}
              onClick={() => setSel(m.id)} className="relative flex cursor-pointer items-center gap-3 bg-surface px-3 py-2.5">
              <Avatar m={m} size={44} />
              <div className="min-w-0 flex-1"><p className="flex items-center gap-2 truncate font-semibold">{m.name}{m.id === meId && <span className="text-xs text-mute">(Aap)</span>}<RoleBadge role={m.role} /></p><p className="truncate text-xs text-mute">{m.banned ? "Banned" : m.online ? "Online" : "Offline"} · Join: {fmtDay(m.joined)}</p></div>
              {m.mutedUntil !== undefined && <MicOff size={15} className="text-danger" />}
            </motion.div>
          </div>
        ))}
      </div>
      {owner && <p className="mt-3 text-center text-xs text-mute">Tip: member ko left swipe ya long-press karke nikaal sakte hain</p>}
      <Sheet open={!!s} onClose={() => setSel(null)} title={s?.name}>
        {s && <>
          <div className="mb-4 flex items-center gap-3"><Avatar m={s} size={56} /><div><RoleBadge role={s.role} /><p className="mt-1 text-sm text-mute">{s.about}</p><p className="text-xs text-mute">{s.phone}</p></div></div>
          {owner && s.id !== meId && s.role !== "owner" && <Card>
            <div className="flex items-center justify-between px-4 py-3"><span className="flex items-center gap-3"><Shield size={18} className="text-accent" /><span className="font-medium">Admin banao</span></span><Toggle on={s.role === "admin"} onChange={(v) => api.setRole(s.id, v ? "admin" : "member")} /></div>
            <div className="flex items-center justify-between px-4 py-3"><span className="flex items-center gap-3"><Gavel size={18} className="text-sky-400" /><span className="font-medium">Moderator banao</span></span><Toggle on={s.role === "mod"} onChange={(v) => api.setRole(s.id, v ? "mod" : "member")} /></div>
          </Card>}
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="soft" onClick={() => { setSel(null); setTimeout(() => api.go("profile-view", { id: s.id }), 200); }}>Profile card</Btn>
            {owner && s.id !== meId && s.role !== "owner" && <Btn variant="danger" onClick={() => { setSel(null); setRm(s.id); }}><UserMinus size={16} />Group se nikalo</Btn>}
          </div>
        </>}
      </Sheet>
      <Confirm open={!!rm} onClose={() => setRm(null)} danger yes="Haan, nikalo" title={`${members.find((m) => m.id === rm)?.name} ko nikalein?`} body="Member foran group se nikal jayega. Ye reload ke bina turant hoga." onYes={() => rm && api.removeMember(rm)} />
    </Page>
  );
}

const CONTACTS = ["Hafiz Idrees", "Maulana Tariq", "Qari Naeem", "Faisal Chaudhry", "Danish Iqbal", "Rehan Malik", "Shoaib Akhtar", "Waqas Ahmed", "Noman Gul", "Umair Shah", "Kashif Mirza"];
export function AddMembersPage() {
  const existing = useStore((s) => s.members.map((m) => m.name));
  const [q, setQ] = useState(""), [sel, setSel] = useState<string[]>([]), [custom, setCustom] = useState("");
  const list = [...CONTACTS.filter((c) => !existing.includes(c)), ...sel.filter((s) => !CONTACTS.includes(s))].filter((c) => c.toLowerCase().includes(q.toLowerCase()));
  const toggle = (c: string) => setSel((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  return (
    <Page title="Members add karo" sub={sel.length ? `${sel.length} chune gaye` : "Chuno aur invite karo"}>
      <div className="relative mb-3"><Search size={17} className="absolute left-3.5 top-3.5 text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Contact dhoondo…" className={cn(inputCls, "pl-10")} /></div>
      {sel.length > 0 && <div className="noscroll mb-3 flex gap-2 overflow-x-auto">{sel.map((s) => <Chip key={s} active onClick={() => toggle(s)}>{s} ✕</Chip>)}</div>}
      <Card>{list.map((c) => { const on = sel.includes(c); return <button key={c} onClick={() => toggle(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface2"><span className="grid h-10 w-10 place-items-center rounded-full bg-surface2 font-bold text-accent">{c[0]}</span><span className="flex-1 font-medium">{c}</span><span className={cn("grid h-6 w-6 place-items-center rounded-full border-2 transition", on ? "border-accent bg-accent text-accent-fg" : "border-mute")}>{on && <Check size={14} strokeWidth={4} />}</span></button>; })}{!list.length && <p className="p-5 text-center text-sm text-mute">Koi contact nahi mila</p>}</Card>
      <div className="mb-4 flex gap-2"><input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Ya naya naam likho" className={inputCls} /><Btn variant="soft" disabled={!custom.trim()} onClick={() => { setSel((s) => [...s, custom.trim()]); setCustom(""); }}><Plus size={18} /></Btn></div>
      <Btn className="w-full" disabled={!sel.length} onClick={() => { sel.forEach(api.addMember); api.toast("Invite chale gaye", `${sel.length} naye member add hue`, "info"); api.back(); }}>Invite karo ({sel.length})</Btn>
    </Page>
  );
}

export function SiteLinkPage() {
  const [qr, setQr] = useState("");
  useEffect(() => { QRCode.toDataURL(SITE_URL, { width: 480, margin: 1, color: { dark: "#0a2a20", light: "#ffffff" } }).then(setQr); }, []);
  const share = async () => { try { if (navigator.share) await navigator.share({ title: "ChatsApp", text: "Madrasa Group me aao!", url: SITE_URL }); else { await navigator.clipboard.writeText(SITE_URL); api.toast("Link copy ho gaya", "", "info", 1800); } } catch { /* cancelled */ } };
  return (
    <Page title="Site link aur QR" sub="App share karne ke liye (group invite nahi)">
      <div className="mx-auto max-w-sm overflow-hidden rounded-3xl border border-line" style={{ background: "linear-gradient(160deg,#0f5a43,#0a2a3a)" }}>
        <div className="p-6 text-center text-white"><div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-2xl font-black">م</div><p className="text-lg font-extrabold">ChatsApp</p><p className="text-sm opacity-80">Baatein, ab aur qareeb</p>
          <div className="mx-auto my-5 w-fit rounded-2xl bg-white p-3">{qr ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={qr} alt="QR" className="h-48 w-48" /> : <div className="h-48 w-48 animate-pulse rounded bg-gray-200" />}</div>
          <p className="break-all rounded-xl bg-black/25 px-3 py-2 text-sm font-semibold">{SITE_URL}</p></div>
      </div>
      <div className="mx-auto mt-5 grid max-w-sm grid-cols-3 gap-2">
        <Btn variant="soft" onClick={() => { navigator.clipboard?.writeText(SITE_URL); api.toast("Link copy ho gaya", "", "info", 1800); }}><Copy size={16} />Copy</Btn>
        <Btn variant="soft" onClick={share}><Share2 size={16} />Share</Btn>
        <a href={qr} download="chatsapp-qr.png" className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface2 px-3 py-2.5 text-[15px] font-semibold"><Download size={16} />QR</a>
      </div>
      <p className="mt-4 text-center text-xs text-mute">Dost link kholkar Google se login karenge aur khud-ba-khud Member ban jayenge.</p>
    </Page>
  );
}

export function MediaGallery() {
  const msgs = useStore((s) => s.messages);
  const [f, setF] = useState<"photos" | "videos" | "docs" | "links">("photos");
  const [view, setView] = useState<{ items: ViewItem[]; index: number } | null>(null);
  const live = msgs.filter((m) => !m.deleted);
  const photos = live.filter((m) => m.type === "image" && m.src), vids = live.filter((m) => m.type === "video" && m.src), docs = live.filter((m) => m.type === "doc");
  const links = live.filter((m) => /https?:\/\//.test(m.text ?? ""));
  const open = (list: typeof photos, i: number) => setView({ items: list.map((m) => ({ id: m.id, src: m.src!, kind: m.type as "image" | "video", caption: m.caption, at: m.at })), index: i });
  return (
    <Page title="Media, docs aur links">
      <Seg value={f} onChange={setF} className="mb-4" options={[{ v: "photos", l: `Photos ${photos.length}` }, { v: "videos", l: `Videos ${vids.length}` }, { v: "docs", l: `Docs ${docs.length}` }, { v: "links", l: `Links ${links.length}` }]} />
      {(f === "photos" || f === "videos") && ((f === "photos" ? photos : vids).length ? <div className="grid grid-cols-3 gap-1.5">{(f === "photos" ? photos : vids).map((m, i, a) => <button key={m.id} onClick={() => open(a, i)} className="aspect-square overflow-hidden rounded-xl bg-surface2">{m.type === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.src} alt="" className="h-full w-full object-cover" /> : <video src={m.src} className="h-full w-full object-cover" />}</button>)}</div> : <Empty text="Koi media nahi" icon={<ImageIcon size={36} />} />)}
      {f === "docs" && (docs.length ? <Card>{docs.map((m) => <Row key={m.id} icon={<FileText size={18} />} title={m.fileName} sub={`${fmtSize(m.size ?? 0)} · ${fmtDay(m.at)}`} onClick={() => api.toast("Download", m.fileName ?? "", "info", 1800)} />)}</Card> : <Empty text="Koi document nahi" />)}
      {f === "links" && (links.length ? <Card>{links.map((m) => <Row key={m.id} icon={<Link2 size={18} />} title={m.text?.match(/https?:\/\/\S+/)?.[0]} sub={fmtDay(m.at)} onClick={() => window.open(m.text?.match(/https?:\/\/\S+/)?.[0], "_blank")} />)}</Card> : <Empty text="Koi link nahi" />)}
      <AnimatePresence>{view && <MediaViewer items={view.items} index={view.index} onClose={() => setView(null)} />}</AnimatePresence>
    </Page>
  );
}

export function InsightsCharts() {
  const ins = api.getInsights();
  const members = useStore((s) => s.members);
  const max = Math.max(...ins.heat.flat(), 1);
  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-3">{[["Is hafte", ins.perDay.reduce((a, b) => a + b, 0)], ["Aaj", ins.perDay[6]], ["Roz ka avg", Math.round(ins.perDay.reduce((a, b) => a + b, 0) / 7)]].map(([l, v]) => <div key={l as string} className="rounded-2xl border border-line bg-surface p-3 text-center"><p className="text-2xl font-black text-accent">{v}</p><p className="text-[11px] text-mute">{l}</p></div>)}</div>
      <Card title="Messages har din"><div className="p-4"><Bars data={ins.perDay} labels={ins.days} highlight={6} /></div></Card>
      <Card title="Sab se active ghante"><div className="p-4"><Bars data={ins.hours} labels={ins.hours.map((_, i) => (i % 4 === 0 ? String(i) : ""))} height={100} color="var(--gold)" highlight={ins.hours.indexOf(Math.max(...ins.hours))} /></div></Card>
      <Card title="Activity heatmap (din × ghanta)"><div className="overflow-x-auto p-4"><div className="min-w-[420px]">{ins.heat.map((row, d) => <div key={d} className="mb-1 flex items-center gap-1"><span className="w-8 text-[10px] text-mute">{["Isn", "Mng", "Bud", "Jum", "Jmt", "Hft", "Aaj"][d]}</span>{row.map((v, h) => <span key={h} title={`${v}`} className="h-4 flex-1 rounded-[3px]" style={{ background: `color-mix(in srgb, var(--accent) ${Math.round((v / max) * 100)}%, var(--surface2))` }} />)}</div>)}</div></div></Card>
      <Card title="Top contributors"><div className="space-y-3 p-4">{ins.top.map((t, i) => { const m = members.find((x) => x.id === t.id); return m ? <div key={t.id} className="flex items-center gap-3"><span className="w-4 text-sm font-black text-gold">{i + 1}</span><Avatar m={m} size={34} /><div className="flex-1"><div className="flex justify-between text-sm"><span className="font-semibold">{m.name}</span><span className="text-mute">{t.n}</span></div><div className="mt-1 h-1.5 rounded-full bg-surface2"><motion.div initial={{ width: 0 }} animate={{ width: `${(t.n / ins.top[0].n) * 100}%` }} className="h-full rounded-full bg-accent" /></div></div></div> : null; })}</div></Card>
    </>
  );
}
export function InsightsPage() { return <Page title="Group insights" sub="Pichle 7 din"><InsightsCharts /></Page>; }

export function RulesPage() {
  const rules = useStore((s) => s.owner.rules);
  const owner = api.isOwner();
  const [edit, setEdit] = useState(false), [v, setV] = useState(rules);
  return (
    <Page title="Group rules" right={owner ? <Btn small variant="soft" onClick={() => { setV(rules); setEdit(true); }}><Pencil size={14} />Edit</Btn> : undefined}>
      <div className="relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-[#2d2308] to-surface p-5">
        <ScrollText className="mb-2 text-gold" /><h3 className="mb-3 text-lg font-black text-gold">Hamare Rules</h3>
        <ol className="space-y-2.5">{rules.split("\n").filter(Boolean).map((r, i) => <li key={i} className="flex gap-3 text-[15px]"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/25 text-[11px] font-black text-gold">{i + 1}</span>{r.replace(/^\d+\.\s*/, "")}</li>)}</ol>
      </div>
      <Sheet open={edit} onClose={() => setEdit(false)} title="Rules edit karo"><textarea rows={9} value={v} onChange={(e) => setV(e.target.value)} className={cn(inputCls, "mb-3 resize-none")} /><p className="mb-3 text-xs text-mute">Har rule nayi line me likho.</p><Btn className="w-full" onClick={() => { api.setRules(v); setEdit(false); }}>Save</Btn></Sheet>
    </Page>
  );
}

/** D7 description editor + D8 icon editor + H17 branding */
export function GroupEdit() {
  const b = useStore((s) => s.owner.branding);
  const [name, setName] = useState(b.name), [desc, setDesc] = useState(b.desc), [accent, setAccent] = useState(b.accent);
  const [crop, setCrop] = useState<{ src: string; z: number; x: number; y: number; f: string } | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null), file = useRef<HTMLInputElement>(null), bfile = useRef<HTMLInputElement>(null);
  const ins = (t: string) => { const el = ta.current; const s = el?.selectionStart ?? desc.length; setDesc(desc.slice(0, s) + t + desc.slice(el?.selectionEnd ?? s)); setTimeout(() => { el?.focus(); el?.setSelectionRange(s + t.length, s + t.length); }, 0); };
  const cv = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => { if (!crop) return; const i = new Image(); i.onload = () => { imgRef.current = i; draw(); }; i.src = crop.src; }, [crop?.src]); // eslint-disable-line
  const draw = () => { const c = cv.current, i = imgRef.current; if (!c || !i || !crop) return; const S = 280; c.width = c.height = S; const x = c.getContext("2d")!; x.filter = FILTERS.find((f) => f.id === crop.f)!.css; const base = S / Math.min(i.width, i.height) * crop.z; const w = i.width * base, h = i.height * base; x.drawImage(i, (S - w) / 2 + crop.x, (S - h) / 2 + crop.y, w, h); };
  useEffect(draw); // eslint-disable-line
  return (
    <Page title="Group edit karo" right={<Btn small onClick={() => { api.setBranding({ name: name.trim() || b.name, desc, accent }); api.toast("Group update ho gaya", "", "info", 1800); }}>Save</Btn>}>
      <div className="mb-5 flex items-center gap-4">
        <button onClick={() => file.current?.click()} className="group relative grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-accent to-[#0b4a37] text-3xl font-black text-accent-fg">{b.logo ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={b.logo} alt="" className="h-full w-full object-cover" /> : "م"}<span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition group-hover:opacity-100"><Camera size={22} className="text-white" /></span></button>
        <div className="flex flex-col gap-2"><Btn small variant="soft" onClick={() => file.current?.click()}>Icon badlo</Btn><Btn small variant="ghost" onClick={() => bfile.current?.click()}>Banner badlo</Btn></div>
        <input ref={file} hidden type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCrop({ src: await resizeImage(f, 900), z: 1, x: 0, y: 0, f: "none" }); e.target.value = ""; }} />
        <input ref={bfile} hidden type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { api.setBranding({ banner: await resizeImage(f, 1200) }); } e.target.value = ""; }} />
      </div>
      <Field label="Group ka naam"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={inputCls} /></Field>
      <Field label="Description" hint={`${desc.length}/300`}>
        <div className="overflow-hidden rounded-xl border border-line bg-surface2 focus-within:border-accent">
          <div className="noscroll flex items-center gap-1 overflow-x-auto border-b border-line px-2 py-1.5">{["🌙", "🕌", "📖", "🤲", "☕", "✨", "💚", "🌹"].map((e) => <button key={e} onClick={() => ins(e)} className="rounded-lg px-1.5 py-0.5 text-lg hover:bg-surface">{e}</button>)}<span className="mx-1 h-5 w-px bg-line" /><button onClick={() => ins("\n• ")} className="rounded-lg px-2 py-1 text-sm font-bold hover:bg-surface">• List</button><button onClick={() => ins("\n— ")} className="rounded-lg px-2 py-1 text-sm font-bold hover:bg-surface">— Line</button></div>
          <textarea ref={ta} rows={5} maxLength={300} value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full resize-none bg-transparent px-3.5 py-3 text-[15px] outline-none" />
        </div>
      </Field>
      <Field label="Accent rang"><div className="flex gap-3">{["#2ccf8a", "#e8bd57", "#4cc3ff", "#ff6f91", "#c79bff", "#ff8a5c"].map((c) => <button key={c} onClick={() => setAccent(c)} className={cn("grid h-10 w-10 place-items-center rounded-full border-2", accent === c ? "border-fg" : "border-transparent")} style={{ background: c }}>{accent === c && <Check size={16} className="text-black" />}</button>)}</div></Field>
      <Sheet open={!!crop} onClose={() => setCrop(null)} title="Icon crop aur filter">
        {crop && <>
          <div className="mx-auto mb-4 w-fit overflow-hidden rounded-full ring-4 ring-accent/40"><canvas ref={cv} className="h-[240px] w-[240px]" /></div>
          <Field label="Zoom"><input type="range" min={1} max={3} step={0.01} value={crop.z} onChange={(e) => setCrop({ ...crop, z: +e.target.value })} className="w-full accent-[var(--accent)]" /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Left / Right"><input type="range" min={-120} max={120} value={crop.x} onChange={(e) => setCrop({ ...crop, x: +e.target.value })} className="w-full accent-[var(--accent)]" /></Field><Field label="Upar / Neeche"><input type="range" min={-120} max={120} value={crop.y} onChange={(e) => setCrop({ ...crop, y: +e.target.value })} className="w-full accent-[var(--accent)]" /></Field></div>
          <div className="noscroll mb-4 flex gap-2 overflow-x-auto">{FILTERS.map((f) => <Chip key={f.id} active={crop.f === f.id} onClick={() => setCrop({ ...crop, f: f.id })}>{f.name}</Chip>)}</div>
          <Btn className="w-full" onClick={() => { if (cv.current) api.setBranding({ logo: cv.current.toDataURL("image/jpeg", 0.88) }); setCrop(null); }}>Icon lagao</Btn>
        </>}
      </Sheet>
    </Page>
  );
}

/** D15 group call UI */
export function CallPage() {
  const members = useStore((s) => s.members.filter((m) => m.online && !m.banned && m.id !== s.me));
  const me = useStore((s) => s.members.find((m) => m.id === s.me)!);
  const [phase, setPhase] = useState<"lobby" | "live">("lobby");
  const [video, setVideo] = useState(false), [mic, setMic] = useState(true), [cam, setCam] = useState(false), [spk, setSpk] = useState(true);
  const [secs, setSecs] = useState(0), [speaking, setSpeaking] = useState<string>("");
  const vid = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null);
  useEffect(() => { if (phase !== "live") return; const i = setInterval(() => { setSecs((s) => s + 1); setSpeaking(members.length ? members[Math.floor(Math.random() * members.length)].id : ""); }, 1500); const t = setInterval(() => setSecs((s) => s), 1000); return () => { clearInterval(i); clearInterval(t); }; }, [phase]); // eslint-disable-line
  useEffect(() => { if (cam) { navigator.mediaDevices?.getUserMedia({ video: true }).then((s) => { stream.current = s; if (vid.current) vid.current.srcObject = s; }).catch(() => { setCam(false); api.toast("Camera nahi mila", "", "info"); }); } else { stream.current?.getTracks().forEach((t) => t.stop()); } return () => stream.current?.getTracks().forEach((t) => t.stop()); }, [cam]);
  const end = () => { stream.current?.getTracks().forEach((t) => t.stop()); api.back(); };
  const tiles = [{ m: me, self: true }, ...members.slice(0, 5).map((m) => ({ m, self: false }))];
  if (phase === "lobby") return (
    <Page title="Group call">
      <div className="mx-auto max-w-sm text-center"><div className="mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full bg-accent/15 text-accent"><Phone size={40} /></div><h3 className="text-xl font-black">Madrasa Group call</h3><p className="mb-5 text-sm text-mute">{members.length} log online hain</p>
        <Seg value={video ? "v" : "a"} onChange={(v) => { setVideo(v === "v"); setCam(v === "v"); }} options={[{ v: "a", l: "Voice call" }, { v: "v", l: "Video call" }]} className="mb-5" /><Btn className="w-full" onClick={() => setPhase("live")}>Call join karo</Btn></div>
    </Page>
  );
  return (
    <div className="flex h-full flex-col bg-[#0a0f0e] text-white">
      <div className="safe-t px-4 py-3 text-center"><p className="font-bold">Madrasa Group</p><p className="text-xs text-white/60 tabular-nums">{fmtDur(secs)} · {tiles.length} log</p></div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2.5 p-3 md:grid-cols-3">
        {tiles.map(({ m, self }) => { const sp = self ? mic && secs % 4 < 2 : speaking === m.id; return (
          <div key={m.id} className={cn("relative grid place-items-center overflow-hidden rounded-3xl bg-[#16211e] transition-all", sp && "ring-[3px] ring-accent")}>
            {self && cam ? <video ref={vid} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" /> : <motion.div animate={sp ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ repeat: Infinity, duration: 0.9 }}><Avatar m={m} size={76} dot={false} /></motion.div>}
            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold">{self && !mic ? <MicOff size={12} className="text-danger" /> : null}{self ? "Aap" : m.name.split(" ")[0]}</span>
          </div>); })}
      </div>
      <div className="safe-b flex items-center justify-center gap-4 px-4 pb-5 pt-2">
        <button onClick={() => setMic(!mic)} className={cn("grid h-14 w-14 place-items-center rounded-full", mic ? "bg-white/15" : "bg-white text-black")}>{mic ? <Mic /> : <MicOff />}</button>
        <button onClick={() => setCam(!cam)} className={cn("grid h-14 w-14 place-items-center rounded-full", cam ? "bg-white text-black" : "bg-white/15")}>{cam ? <Video /> : <VideoOff />}</button>
        <button onClick={() => setSpk(!spk)} className={cn("grid h-14 w-14 place-items-center rounded-full", spk ? "bg-white/15" : "bg-white text-black")}>{spk ? <Volume2 /> : <VolumeX />}</button>
        <button onClick={end} className="grid h-14 w-14 place-items-center rounded-full bg-danger"><PhoneOff /></button>
      </div>
    </div>
  );
}
void Crown; void TriangleAlert; void Info; void EMOJI; void Check;
export type { Member };
