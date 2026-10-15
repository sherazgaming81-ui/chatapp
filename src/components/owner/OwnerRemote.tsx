"use client";
import { motion } from "framer-motion";
import { AlertTriangle, BellRing, CheckCircle2, Clock, Eye, Loader2, RefreshCw, Rocket, Search, ShieldCheck, XCircle, Zap, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/data/store";
import * as api from "@/data/api";
import { cn, fmtDateTime } from "@/lib/util";
import { Avatar, Btn, Card, Confirm, Field, Ring, Row, Sheet, inputCls } from "../ui";

const stChip = (s: string) => ({ done: ["Ho gaya", "bg-accent/15 text-accent", <CheckCircle2 key="d" size={13} />], pending: ["Intezar", "bg-gold/15 text-gold", <Loader2 key="p" size={13} className="animate-spin" />], failed: ["Nakaam", "bg-danger/15 text-danger", <XCircle key="f" size={13} />] } as Record<string, [string, string, React.ReactNode]>)[s];

export function RemoteTab() {
  const o = useStore((s) => s.owner);
  const members = useStore((s) => s.members.filter((m) => m.id !== s.me && !m.banned));
  const all = useStore((s) => s.members);
  const [msg, setMsg] = useState("Naya version aa raha hai, 1 min ruko!");
  const [q, setQ] = useState("");
  const [confirmAll, setConfirmAll] = useState(false), [confirmStage, setConfirmStage] = useState<50 | 100 | null>(null), [preview, setPreview] = useState(false), [confirmSelf, setConfirmSelf] = useState(false), [one, setOne] = useState<string | null>(null);
  const r = o.rollout;
  const target = r?.version ?? o.available?.version ?? o.currentVersion;
  const adopted = members.filter((m) => m.version === target).length;
  const pct = Math.round((adopted / Math.max(1, members.length)) * 100);
  const job = o.jobs[0];
  const counts = job ? { done: job.entries.filter((e) => e.status === "done").length, pending: job.entries.filter((e) => e.status === "pending").length, failed: job.entries.filter((e) => e.status === "failed").length } : null;
  const list = members.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  const canPush = !!o.available && !r;

  return (
    <>
      {/* G3 G4 G9 G11 version push */}
      <div className={cn("mb-4 overflow-hidden rounded-3xl border p-5", o.available || r ? "border-gold/50 bg-gradient-to-br from-[#2d2308] to-surface" : "border-line bg-surface")}>
        <div className="flex items-start gap-4"><span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-2xl", o.available ? "bg-gold/20 text-gold" : "bg-surface2 text-mute")}><Rocket /></span>
          <div className="flex-1"><p className="text-xs font-bold uppercase tracking-wider text-mute">Maujooda version</p><p className="text-2xl font-black">v{o.currentVersion}</p>
            {o.available && !r ? <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-gold"><BellRing size={14} />Naya version tayyar hai! v{o.available.version}</p> : r ? <p className="mt-1 text-sm font-semibold text-accent">Rollout chal raha hai: v{r.version} · {r.stage}%</p> : <p className="mt-1 text-sm text-mute">Aap latest version par hain. Naya build aate hi alert aayega.</p>}</div>
          <Ring value={pct / 100} size={58} stroke={6} color="var(--gold)"><span className="text-xs font-black">{pct}%</span></Ring></div>
        <Field label="Custom message (users ko dikhega)"><input value={msg} onChange={(e) => setMsg(e.target.value)} className={cn(inputCls, "mt-3")} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="soft" disabled={!o.available} onClick={() => setPreview(true)}><Eye size={16} />Kya naya hai (preview)</Btn>
          <Btn variant="gold" disabled={!canPush} onClick={() => { api.pushVersion(msg); }}><Zap size={16} />Version push karo</Btn>
        </div>
        {!o.available && !r && <p className="mt-2 text-xs text-mute">Push button tab tak disabled rehta hai jab tak naya version detect na ho.</p>}
        <div className="mt-2 flex justify-between text-xs"><button className="font-semibold text-accent" onClick={() => api.detectUpdate(true)}>Naye version ki jaanch karo</button></div>
        {r && r.stage < 100 && (
          <div className="mt-4 rounded-2xl bg-black/20 p-3"><p className="mb-2 text-sm font-bold">Staged rollout: {r.stage}% users ko mil gaya</p><div className="mb-3 flex gap-1.5">{[10, 50, 100].map((s) => <span key={s} className={cn("h-2 flex-1 rounded-full", r.stage >= s ? "bg-gold" : "bg-surface2")} />)}</div>
            <div className="grid grid-cols-2 gap-2"><Btn small variant="soft" disabled={r.stage >= 50} onClick={() => setConfirmStage(50)}>50% par bhejo</Btn><Btn small variant="gold" onClick={() => setConfirmStage(100)}>100% par bhejo</Btn></div></div>
        )}
      </div>

      {/* G1 G6 bulk reload */}
      <Card title="Remote reload">
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-3 rounded-xl bg-surface2 p-3 text-xs text-mute"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" />Reload par device ka service worker, local storage, saare caches — sab saaf hokar true fresh start hota hai.</div>
          <Btn variant="danger" className="w-full" onClick={() => setConfirmAll(true)}><RefreshCw size={16} />Sab members ka app reload karo</Btn>
          <Btn variant="ghost" className="w-full" onClick={() => setConfirmSelf(true)}>Is device ko reload karo (asli wipe test)</Btn>
        </div>
      </Card>

      {/* G7 tracker */}
      {job && counts && (
        <Card title={`Reload tracker · ${fmtDateTime(job.at)}`}>
          <div className="grid grid-cols-3 gap-2 p-4">{(["done", "pending", "failed"] as const).map((k) => <div key={k} className={cn("rounded-xl p-3 text-center", stChip(k)[1])}><p className="text-2xl font-black">{counts[k]}</p><p className="text-[11px] font-bold">{stChip(k)[0]}</p></div>)}</div>
          {counts.failed > 0 && <div className="px-4 pb-3"><Btn small variant="soft" onClick={() => api.retryFailed(job.id)}><RotateCcw size={14} />Nakaam walon ko dobara</Btn></div>}
          {job.entries.map((e) => { const m = all.find((x) => x.id === e.userId); const c = stChip(e.status); return m ? <div key={e.userId} className="flex items-center gap-3 px-4 py-2"><Avatar m={m} size={30} dot={false} /><span className="flex-1 text-sm font-medium">{m.name}</span><span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", c[1])}>{c[2]}{c[0]}</span></div> : null; })}
        </Card>
      )}

      {/* G5 G13 per user + G12 adoption */}
      <Card title="Member-wise (reload / adoption)">
        <div className="p-3"><div className="relative"><Search size={16} className="absolute left-3.5 top-3.5 text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Member dhoondo…" className={cn(inputCls, "pl-10")} /></div></div>
        {list.map((m) => { const cur = m.version === target; return (
          <div key={m.id} className="flex items-center gap-3 border-t border-line px-4 py-2.5"><Avatar m={m} size={38} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{m.name}</p><p className="text-xs text-mute">v{m.version} {o.available || r ? (cur ? "· update ho chuka ✅" : "· purana") : ""}</p></div>
            <Btn small variant="soft" onClick={() => setOne(m.id)}><RefreshCw size={13} />Reload</Btn></div>); })}
        <div className="border-t border-line px-4 py-3 text-xs text-mute">Adoption: {adopted}/{members.length} users ne v{target} le liya ({pct}%)</div>
      </Card>

      <Card title="History">{o.history.slice(0, 12).map((h) => <Row key={h.id} icon={h.kind === "push" ? <Rocket size={17} /> : <RefreshCw size={17} />} title={`${h.kind === "push" ? "Push" : "Reload"} · v${h.version} · ${h.scope}`} sub={`${fmtDateTime(h.at)}${h.note ? " · " + h.note : ""}`} />)}</Card>

      <Confirm open={confirmAll} onClose={() => setConfirmAll(false)} danger yes="Haan, sab reload karo" title="Sab ka app reload karein?" body={`${members.length} members ke device par app refresh hoga aur poora cache saaf ho jayega. Message: "${msg}"`} onYes={() => { api.reloadUsers("all", msg); api.toast("Reload bhej diya", "Tracker me status dekhein", "info"); }} />
      <Confirm open={!!one} onClose={() => setOne(null)} yes="Reload karo" title={`${members.find((m) => m.id === one)?.name} ka app reload karein?`} body={`Sirf is member ka app saaf hokar reload hoga. Message: "${msg}"`} onYes={() => one && api.reloadUsers([one], msg)} />
      <Confirm open={!!confirmStage} onClose={() => setConfirmStage(null)} yes={`${confirmStage}% par bhejo`} title={`Rollout ${confirmStage}% tak badhayein?`} body="Pehle stage ka asar theek hai to aage badhayein." onYes={() => confirmStage && api.advanceRollout(confirmStage)} />
      <Confirm open={confirmSelf} onClose={() => setConfirmSelf(false)} danger yes="Wipe karo" title="Is browser ko wipe karein?" body="Ye asli me service worker, localStorage aur caches mita kar page reload karega. Demo data bhi reset ho jayega." onYes={() => api.wipeDeviceAndReload()} />
      <Sheet open={preview} onClose={() => setPreview(false)} title={`v${o.available?.version} — Kya naya hai`}>
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-gold/10 p-3 text-sm font-semibold text-gold"><AlertTriangle size={16} />Users ko update ke baad aisa dikhega</p>
        <ul className="space-y-2.5">{o.available?.notes.map((n) => <li key={n} className="flex gap-3 text-[15px]"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent" />{n}</li>)}</ul>
      </Sheet>
    </>
  );
}
function useMember(id: string) { return useStore((s) => s.members.find((m) => m.id === id)); }
void motion; void Clock;
