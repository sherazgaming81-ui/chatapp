"use client";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, Camera as CamIcon, Contact, FileText, Image as ImageIcon, MapPin, Plus, Trash2, Video, X, Navigation, Download, MessageCircle, UserPlus } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useStore } from "@/data/store";
import { createPoll, sendMessage, toast, getLocation } from "@/data/api";
import { cn, fileToDataUrl, resizeImage } from "@/lib/util";
import { Avatar, Btn, Field, Sheet, Toggle, inputCls, useIsDesktop } from "../ui";
import { svgUri } from "@/data/assets";

export type AttachKind = "camera" | "photo" | "video" | "doc" | "location" | "contact" | "poll";
const ITEMS: { k: AttachKind; l: string; i: ReactNode; c: string }[] = [
  { k: "doc", l: "Document", i: <FileText />, c: "#6b5bff" },
  { k: "camera", l: "Camera", i: <CamIcon />, c: "#ff4f6d" },
  { k: "photo", l: "Photo", i: <ImageIcon />, c: "#c24fff" },
  { k: "video", l: "Video", i: <Video />, c: "#ff7a3d" },
  { k: "location", l: "Location", i: <MapPin />, c: "#19b86a" },
  { k: "contact", l: "Contact", i: <Contact />, c: "#2d9bff" },
  { k: "poll", l: "Poll", i: <BarChart3 />, c: "#f2b705" },
];

/** B1 — WhatsApp-style grid: bottom sheet on mobile, popup near the button on desktop */
export function AttachMenu({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (k: AttachKind) => void }) {
  const desktop = useIsDesktop();
  const grid = (
    <div className="grid grid-cols-3 gap-y-5 px-2 py-3">
      {ITEMS.map((it, i) => (
        <motion.button key={it.k} initial={{ opacity: 0, y: 16, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: i * 0.035, type: "spring", stiffness: 500, damping: 26 }} onClick={() => { onClose(); onPick(it.k); }} className="flex flex-col items-center gap-2">
          <span className="grid h-14 w-14 place-items-center rounded-full text-white shadow-lg" style={{ background: it.c }}>{it.i}</span>
          <span className="text-xs font-medium text-mute">{it.l}</span>
        </motion.button>
      ))}
    </div>
  );
  if (!desktop) return <Sheet open={open} onClose={onClose} title="Kya bhejna hai?">{grid}</Sheet>;
  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={onClose} />
          <motion.div initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.9 }} style={{ transformOrigin: "bottom left" }} className="absolute bottom-[68px] left-3 z-[61] w-[300px] rounded-2xl border border-line bg-surface p-3 shadow-2xl">{grid}</motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ───────── map visual (used by location card & full map & masjids) ─────────
export function MapArt({ className, pins, big }: { className?: string; pins?: { x: number; y: number; label?: string; active?: boolean }[]; big?: boolean }) {
  const roads = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg viewBox="0 0 400 260" className={cn("h-full w-full", className)} preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="260" fill="#17302b" />
      <path d="M0 190 Q90 150 170 190 T400 170 V260 H0Z" fill="#12425a" opacity=".55" />
      {roads.map((i) => <path key={"h" + i} d={`M0 ${20 + i * 30 + (i % 2) * 6} L400 ${14 + i * 30 - (i % 3) * 8}`} stroke="#2c4a43" strokeWidth={i % 3 === 0 ? 7 : 3} />)}
      {roads.map((i) => <path key={"v" + i} d={`M${24 + i * 46} 0 L${34 + i * 44} 260`} stroke="#2c4a43" strokeWidth={i % 4 === 0 ? 7 : 3} />)}
      <path d="M0 120 L400 90" stroke="#e8bd57" strokeWidth="4" opacity=".55" />
      {[[60, 40, 30, 22], [250, 150, 40, 26], [330, 30, 34, 30], [110, 200, 28, 24]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill="#1f5a45" opacity=".8" />)}
      {(pins ?? [{ x: 200, y: 130 }]).map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y})`}>
          <ellipse cx="0" cy="2" rx="9" ry="3.5" fill="#0008" />
          <path d="M0 0C-12-16-16-22-16-30a16 16 0 0 1 32 0c0 8-4 14-16 30z" fill={p.active === false ? "#8696a0" : "#ff5a4d"} stroke="#fff" strokeWidth="2" />
          <circle cx="0" cy="-30" r="6" fill="#fff" />
          {big && p.label && <text x="0" y="-52" fontSize="12" fontWeight="700" textAnchor="middle" fill="#fff" stroke="#000a" strokeWidth="3" paintOrder="stroke">{p.label}</text>}
        </g>
      ))}
    </svg>
  );
}

export function LocationShare({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [loc, setLoc] = useState(getLocation());
  const [busy, setBusy] = useState(false);
  const locate = () => {
    setBusy(true);
    navigator.geolocation?.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, name: "Meri maujooda jagah" }); setBusy(false); },
      () => { toast("Location nahi mili", "Default (Karachi) istemal ho raha hai", "info"); setBusy(false); }, { timeout: 6000 });
    if (!navigator.geolocation) setBusy(false);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Location bhejo">
      <div className="mb-3 h-44 overflow-hidden rounded-2xl"><MapArt /></div>
      <p className="mb-1 font-semibold">{loc.name}</p>
      <p className="mb-4 text-xs text-mute">{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</p>
      <div className="flex gap-2">
        <Btn variant="soft" className="flex-1" onClick={locate} disabled={busy}><Navigation size={16} />{busy ? "Dhoond raha…" : "Meri location"}</Btn>
        <Btn className="flex-1" onClick={() => { sendMessage({ type: "location", loc: { lat: loc.lat, lng: loc.lng, label: loc.name } }); onClose(); }}>Bhejo</Btn>
      </div>
    </Sheet>
  );
}

export function LocationViewer({ loc, onClose }: { loc: { lat: number; lng: number; label: string } | null; onClose: () => void }) {
  return (
    <Sheet open={!!loc} onClose={onClose} title={loc?.label} full noPad>
      {loc && (
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1"><MapArt big pins={[{ x: 200, y: 140, label: loc.label }]} /></div>
          <div className="space-y-2 p-4">
            <p className="text-sm text-mute">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</p>
            <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-accent py-3 font-semibold text-accent-fg"><Navigation size={18} /> Google Maps me kholo</a>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function ContactShare({ open, onClose }: { open: boolean; onClose: () => void }) {
  const members = useStore((s) => s.members);
  const [name, setName] = useState(""), [phone, setPhone] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title="Contact bhejo">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mute">Group members me se</p>
      <div className="mb-4 max-h-52 overflow-y-auto rounded-2xl border border-line">
        {members.filter((m) => m.id !== "me").map((m) => (
          <button key={m.id} onClick={() => { sendMessage({ type: "contact", contact: { name: m.name, phone: m.phone } }); onClose(); }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface2"><Avatar m={m} size={36} /><span><span className="block text-sm font-semibold">{m.name}</span><span className="text-xs text-mute">{m.phone}</span></span></button>
        ))}
      </div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mute">Ya naya contact likho</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam" className={cn(inputCls, "mb-2")} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Number (+92…)" inputMode="tel" className={cn(inputCls, "mb-3")} />
      <Btn className="w-full" disabled={!name.trim() || !phone.trim()} onClick={() => { sendMessage({ type: "contact", contact: { name: name.trim(), phone: phone.trim() } }); onClose(); setName(""); setPhone(""); }}>Bhejo</Btn>
    </Sheet>
  );
}

export function ContactActions({ c, onClose }: { c: { name: string; phone: string } | null; onClose: () => void }) {
  const save = () => {
    if (!c) return;
    const vcf = `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name}\nTEL:${c.phone}\nEND:VCARD`;
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([vcf], { type: "text/vcard" })); a.download = `${c.name}.vcf`; a.click();
    toast("Contact save", `${c.name} ki vcf file download ho gayi`, "info"); onClose();
  };
  return (
    <Sheet open={!!c} onClose={onClose} title={c?.name}>
      <p className="mb-4 text-mute">{c?.phone}</p>
      <div className="space-y-2">
        <a href={`sms:${c?.phone}`} className="flex items-center gap-3 rounded-xl bg-surface2 px-4 py-3 font-semibold"><MessageCircle className="text-accent" size={20} /> Message bhejo</a>
        <a href={`tel:${c?.phone}`} className="flex items-center gap-3 rounded-xl bg-surface2 px-4 py-3 font-semibold"><Contact className="text-accent" size={20} /> Call karo</a>
        <button onClick={save} className="flex w-full items-center gap-3 rounded-xl bg-surface2 px-4 py-3 text-left font-semibold"><UserPlus className="text-accent" size={20} /> Contact save karo</button>
      </div>
    </Sheet>
  );
}

// ───────── poll creator (B5 — YouTube community-poll style; I7–I9) ─────────
const DURS: { l: string; ms?: number }[] = [{ l: "Koi had nahi" }, { l: "1 minute", ms: 60e3 }, { l: "1 ghanta", ms: 3600e3 }, { l: "1 din", ms: 864e5 }, { l: "1 hafta", ms: 6048e5 }];
export function PollCreator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState<{ text: string; img?: string }[]>([{ text: "" }, { text: "" }]);
  const [dur, setDur] = useState(0);
  const [multi, setMulti] = useState(false), [anon, setAnon] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const target = useRef(0);
  const ok = q.trim() && opts.filter((o) => o.text.trim()).length >= 2;
  const reset = () => { setQ(""); setOpts([{ text: "" }, { text: "" }]); setDur(0); setMulti(false); setAnon(false); };
  const submit = () => { createPoll(q.trim(), opts.filter((o) => o.text.trim()), { multi, anonymous: anon, durationMs: DURS[dur].ms }); reset(); onClose(); };
  return (
    <Sheet open={open} onClose={onClose} title="Poll banao" full>
      <Field label="Sawal"><textarea value={q} onChange={(e) => setQ(e.target.value)} maxLength={140} rows={2} placeholder="Apna sawal likho…" className={cn(inputCls, "resize-none")} /></Field>
      <p className="mb-1.5 text-xs font-semibold text-mute">Options (kam az kam 2, zyada se zyada 5)</p>
      <div className="space-y-2">
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex flex-1 items-center rounded-xl border border-line bg-surface2 pr-1 focus-within:border-accent">
              <input value={o.text} onChange={(e) => setOpts((v) => v.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} maxLength={60} placeholder={`Option ${i + 1}`} className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-[15px] outline-none" />
              {o.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <button onClick={() => setOpts((v) => v.map((x, k) => (k === i ? { text: x.text } : x)))} className="relative mr-1 h-8 w-8 overflow-hidden rounded-lg"><img src={o.img} alt="" className="h-full w-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 hover:opacity-100"><X size={14} /></span></button>
              ) : <button onClick={() => { target.current = i; file.current?.click(); }} className="rounded-lg p-2 text-mute hover:text-accent" aria-label="Photo lagao"><ImageIcon size={18} /></button>}
            </div>
            {opts.length > 2 && <button onClick={() => setOpts((v) => v.filter((_, k) => k !== i))} className="rounded-full p-2 text-mute hover:text-danger"><Trash2 size={17} /></button>}
          </div>
        ))}
      </div>
      {opts.length < 5 && <button onClick={() => setOpts((v) => [...v, { text: "" }])} className="mt-2 flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-accent"><Plus size={18} /> Option jodo</button>}
      <input ref={file} hidden type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const u = await resizeImage(f, 400); setOpts((v) => v.map((x, k) => (k === target.current ? { ...x, img: u } : x))); } e.target.value = ""; }} />
      <p className="mb-1.5 mt-4 text-xs font-semibold text-mute">Poll kab tak chale?</p>
      <div className="mb-4 flex flex-wrap gap-2">{DURS.map((d, i) => <button key={d.l} onClick={() => setDur(i)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold", dur === i ? "bg-accent text-accent-fg" : "bg-surface2 text-mute")}>{d.l}</button>)}</div>
      <div className="mb-5 divide-y divide-line rounded-2xl border border-line">
        <label className="flex items-center justify-between px-4 py-3"><span><span className="block text-[15px] font-medium">Ek se zyada jawab</span><span className="text-xs text-mute">Log kai options chun sakte hain</span></span><Toggle on={multi} onChange={setMulti} /></label>
        <label className="flex items-center justify-between px-4 py-3"><span><span className="block text-[15px] font-medium">Gumnaam (Anonymous)</span><span className="text-xs text-mute">Voters ke naam chhupe rahenge</span></span><Toggle on={anon} onChange={setAnon} /></label>
      </div>
      <Btn className="w-full" disabled={!ok} onClick={submit}>Poll bhejo</Btn>
    </Sheet>
  );
}

// file helpers used by Composer
export async function pickFileAsMessage(kind: "photo" | "video" | "doc", f: File) {
  if (kind === "doc") return sendMessage({ type: "doc", fileName: f.name, size: f.size });
  if (kind === "video") {
    const src = f.size < 8e6 ? await fileToDataUrl(f) : URL.createObjectURL(f);
    return sendMessage({ type: "video", src, size: f.size, caption: "" });
  }
  return null;
}
void svgUri; void Download;
