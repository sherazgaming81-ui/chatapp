"use client";
import { motion } from "framer-motion";
import { Ban, Copy, Gavel, MicOff, Plus, Search, Terminal, Trash2, TriangleAlert, Turtle, VolumeX, X, Link2, Palette, Eye } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/data/store";
import * as api from "@/data/api";
import { SITE_URL } from "@/data/seed";
import type { Member, Role } from "@/data/types";
import { cn, fmtDateTime } from "@/lib/util";
import { Avatar, Btn, Card, Field, RoleBadge, Row, Sheet, Toggle, inputCls, Seg } from "../ui";

function Status({ m }: { m: Member }) {
  const muted = api.isMemberMuted(m);
  return <span className="flex flex-wrap gap-1">{m.banned && <i className="rounded bg-danger/20 px-1.5 py-0.5 text-[10px] font-bold not-italic text-danger">BANNED</i>}{muted && <i className="rounded bg-[#c9792b]/20 px-1.5 py-0.5 text-[10px] font-bold not-italic text-[#e0953f]">MUTED</i>}{m.warns.length > 0 && <i className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold not-italic text-gold">WARN {m.warns.length}/3</i>}</span>;
}

export function ModerationTab() {
  const members = useStore((s) => s.members.filter((m) => m.id !== s.me));
  const slow = useStore((s) => s.owner.slow), am = useStore((s) => s.owner.autoMod);
  const [q, setQ] = useState(""), [target, setTarget] = useState<Member | null>(null), [warn, setWarn] = useState<Member | null>(null), [reason, setReason] = useState("");
  const [word, setWord] = useState(""), [test, setTest] = useState(""), [prev, setPrev] = useState<string>(members[0]?.id ?? "");
  const pm = members.find((m) => m.id === prev);
  const list = members.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  const sel = target ? members.find((m) => m.id === target.id) ?? target : null;
  return (
    <>
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-xs font-semibold text-accent"><span className="h-2 w-2 rounded-full bg-accent" />Mute, ban aur warn — INSTANT lagu hote hain, member ko reload nahi karna padta</div>
      <div className="relative mb-3"><Search size={17} className="absolute left-3.5 top-3.5 text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Member dhoondo…" className={cn(inputCls, "pl-10")} /></div>
      <Card>{list.map((m) => (
        <button key={m.id} onClick={() => setTarget(m)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface2"><Avatar m={m} size={42} /><span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-semibold">{m.name}<RoleBadge role={m.role} /></span><Status m={m} /></span></button>
      ))}</Card>

      <Card title="Member ki screen (live preview)">
        <div className="p-4"><select value={prev} onChange={(e) => setPrev(e.target.value)} className={cn(inputCls, "mb-3")}>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          {pm && <div className="rounded-2xl border border-line bg-bg2 p-3 text-sm">{pm.banned ? <p className="flex items-center gap-2 font-bold text-danger"><Ban size={16} />&ldquo;Aap ban ho chuke hain&rdquo; — poori screen block</p> : api.isMemberMuted(pm) ? <p className="flex items-center gap-2 font-bold text-[#e0953f]"><MicOff size={16} />Message box band: &ldquo;Aap mute hain&rdquo;</p> : <p className="font-semibold text-accent">Normal — message bhej sakta hai{slow.on ? ` (har ${slow.sec}s me 1)` : ""}</p>}{pm.warns.length > 0 && <p className="mt-2 text-gold">Warning dikhi: &ldquo;{pm.warns[pm.warns.length - 1].reason}&rdquo; ({pm.warns.length}/3)</p>}</div>}
        </div>
      </Card>

      <Card title="Slow mode (spam rokne ke liye)"><div className="p-4">
        <div className="flex items-center justify-between"><span className="flex items-center gap-3"><Turtle size={18} className="text-accent" /><span className="font-medium">Slow mode</span></span><Toggle on={slow.on} onChange={(v) => api.setSlowMode(v, slow.sec)} /></div>
        <div className="mt-3"><p className="mb-1 text-xs text-mute">Har member 1 message har <b className="text-fg">{slow.sec} second</b> me</p><input type="range" min={3} max={120} value={slow.sec} onChange={(e) => api.setSlowMode(slow.on, +e.target.value)} className="w-full accent-[var(--accent)]" /></div>
      </div></Card>

      <Card title="Auto-mod (mana shuda lafz)"><div className="p-4">
        <div className="mb-3 flex items-center justify-between"><span className="font-medium">Auto-delete chalu</span><Toggle on={am.on} onChange={(v) => api.patchAutoMod({ on: v })} /></div>
        <div className="mb-3 flex flex-wrap gap-2">{am.words.map((w) => <span key={w} className="flex items-center gap-1.5 rounded-full bg-surface2 py-1 pl-3 pr-1.5 text-sm font-semibold">{w}<button onClick={() => api.patchAutoMod({ words: am.words.filter((x) => x !== w) })} className="rounded-full p-0.5 text-mute hover:text-danger"><X size={14} /></button></span>)}</div>
        <div className="mb-3 flex gap-2"><input value={word} onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && word.trim()) { api.patchAutoMod({ words: [...am.words, word.trim().toLowerCase()] }); setWord(""); } }} placeholder="Naya lafz" className={inputCls} /><Btn variant="soft" disabled={!word.trim()} onClick={() => { api.patchAutoMod({ words: [...am.words, word.trim().toLowerCase()] }); setWord(""); }}><Plus size={18} /></Btn></div>
        <p className="mb-1.5 text-xs font-semibold text-mute">Test: member ki taraf se message bhejo</p>
        <div className="flex gap-2"><input value={test} onChange={(e) => setTest(e.target.value)} placeholder="jaise: ye spam hai" className={inputCls} /><Btn variant="soft" disabled={!test.trim() || !members[0]} onClick={() => { api.receiveMessage(members.find((m) => !api.isStaff(m))?.id ?? members[0].id, { type: "text", text: test }); setTest(""); api.toast("Test bheja", "Chat aur Logs me asar dekhein", "info"); }}>Bhejo</Btn></div>
      </div></Card>

      <Sheet open={!!sel} onClose={() => setTarget(null)} title={sel?.name}>
        {sel && <>
          <div className="mb-4 flex items-center gap-3"><Avatar m={sel} size={52} /><div><RoleBadge role={sel.role} /><div className="mt-1"><Status m={sel} /></div></div></div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mute">Mute</p>
          {api.isMemberMuted(sel) ? <Btn variant="soft" className="mb-4 w-full" onClick={() => api.unmuteMember(sel.id)}><VolumeX size={16} />Unmute karo</Btn> : <div className="mb-4 grid grid-cols-4 gap-2">{[["10 min", 600e3], ["1 ghanta", 3600e3], ["24 ghante", 864e5], ["Hamesha", null]].map(([l, ms]) => <Btn key={l as string} small variant="soft" onClick={() => api.muteMember(sel.id, ms as number | null)}>{l}</Btn>)}</div>}
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mute">Warning ({sel.warns.length}/3)</p>
          <div className="mb-4 flex gap-2"><Btn variant="soft" className="flex-1" onClick={() => { setWarn(sel); setTarget(null); }}><TriangleAlert size={16} />Warn do</Btn>{sel.warns.length > 0 && <Btn variant="ghost" onClick={() => api.clearWarns(sel.id)}>Saaf</Btn>}</div>
          {sel.warns.map((w) => <p key={w.id} className="mb-1 rounded-lg bg-surface2 px-3 py-2 text-sm">{w.reason}<span className="ml-2 text-xs text-mute">{fmtDateTime(w.at)}</span></p>)}
          <div className="mt-4">{sel.banned ? <Btn className="w-full" onClick={() => api.unbanMember(sel.id)}>Unban karo</Btn> : <Btn variant="danger" className="w-full" disabled={sel.role === "owner"} onClick={() => api.banMember(sel.id)}><Gavel size={16} />Ban karo (foran)</Btn>}</div>
        </>}
      </Sheet>
      <Sheet open={!!warn} onClose={() => setWarn(null)} title={`${warn?.name} ko warning`}>
        <Field label="Wajah"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="jaise: Spam kiya" className={inputCls} /></Field>
        <div className="mb-3 flex flex-wrap gap-2">{["Spam", "Badtameezi", "Rules ki khilaf warzi", "Faltu forward"].map((r) => <button key={r} onClick={() => setReason(r)} className="rounded-full bg-surface2 px-3 py-1 text-sm font-semibold">{r}</button>)}</div>
        <Btn className="w-full" disabled={!reason.trim()} onClick={() => { warn && api.warnMember(warn.id, reason.trim()); setWarn(null); setReason(""); api.toast("Warning de di", "Member ko foran dikhegi", "info"); }}>Warning bhejo</Btn>
      </Sheet>
    </>
  );
}

export function CommandsTab() {
  const cmds = useStore((s) => s.owner.commands), log = useStore((s) => s.owner.cmdLog), members = useStore((s) => s.members);
  const [n, setN] = useState(""), [d, setD] = useState(""), [r, setR] = useState("");
  return (
    <>
      <Card title="Naya custom command"><div className="p-4">
        <div className="grid grid-cols-2 gap-3"><Field label="Naam"><div className="flex items-center rounded-xl border border-line bg-surface2 focus-within:border-accent"><span className="pl-3.5 font-mono text-accent">/</span><input value={n} onChange={(e) => setN(e.target.value.replace(/\s/g, ""))} placeholder="namaz" className="w-full bg-transparent px-1.5 py-2.5 outline-none" /></div></Field><Field label="Tafseel"><input value={d} onChange={(e) => setD(e.target.value)} placeholder="Kya karta hai" className={inputCls} /></Field></div>
        <Field label="Jawab (tokens: {namaz} {tarikh} {hijri} {user})"><textarea rows={3} value={r} onChange={(e) => setR(e.target.value)} placeholder="Aaj ke waqt:\n{namaz}" className={cn(inputCls, "resize-none")} /></Field>
        <Btn className="w-full" disabled={!n.trim() || !r.trim()} onClick={() => { api.addCommand(n, d || "Custom command", r); setN(""); setD(""); setR(""); }}><Plus size={16} />Command banao</Btn>
      </div></Card>
      <Card title={`Custom commands (${cmds.length})`}>{cmds.map((c) => (
        <div key={c.id} className="px-4 py-3"><div className="flex items-center gap-2"><span className="font-mono font-bold text-accent">/{c.name}</span><span className="flex-1 truncate text-sm text-mute">{c.desc}</span><span className="text-xs text-mute">{c.uses}x</span></div><p className="mt-1 whitespace-pre-wrap rounded-lg bg-surface2 px-3 py-2 text-xs text-mute">{c.reply}</p><div className="mt-2 flex gap-2"><Btn small variant="soft" onClick={() => { api.execCommand("/" + c.name); api.toast("Chala diya", "Chat me result dekhein", "info", 1800); }}><Terminal size={14} />Test chalao</Btn><Btn small variant="ghost" onClick={() => api.removeCommand(c.id)}><Trash2 size={14} />Hatao</Btn></div></div>))}</Card>
      <Card title="Built-in commands">{api.BUILTIN_COMMANDS.map((c) => <Row key={c.name} title={<span className="font-mono">/{c.name}</span>} sub={c.desc + (c.staff ? " (sirf admin)" : "")} />)}</Card>
      <Card title="Command history">{log.length === 0 ? <p className="p-5 text-center text-sm text-mute">Abhi koi command nahi chali</p> : log.slice(0, 30).map((l) => <Row key={l.id} title={<span><span className="font-mono text-accent">{l.cmd}</span> — {members.find((m) => m.id === l.by)?.name ?? "Koi"}</span>} sub={fmtDateTime(l.at)} />)}</Card>
    </>
  );
}

const PERM_LABEL: Record<string, string> = { delete: "Messages delete", ban: "Ban/Unban", mute: "Mute", pin: "Pin", announce: "Elaan", invite: "Invite links", roles: "Roles manage", slow: "Slow mode" };
const ROLES: { r: Role; l: string; c: string }[] = [{ r: "owner", l: "Owner", c: "#e8bd57" }, { r: "admin", l: "Admin", c: "#2ccf8a" }, { r: "mod", l: "Mod", c: "#4cc3ff" }, { r: "member", l: "Member", c: "#8fa59d" }];
export function RolesTab() {
  const members = useStore((s) => s.members), perms = useStore((s) => s.owner.perms), invites = useStore((s) => s.owner.invites);
  const [drag, setDrag] = useState<string | null>(null), [over, setOver] = useState<Role | null>(null), [pick, setPick] = useState<Member | null>(null);
  const [exp, setExp] = useState<number | null>(null), [max, setMax] = useState<number | null>(null);
  return (
    <>
      <p className="mb-2 text-xs text-mute">Member ko ek role se doosre me drag karein (ya tap karke chunein).</p>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {ROLES.map(({ r, l, c }) => (
          <div key={r} onDragOver={(e) => { e.preventDefault(); setOver(r); }} onDragLeave={() => setOver(null)} onDrop={() => { if (drag && r !== "owner") api.setRole(drag, r); setDrag(null); setOver(null); }}
            className={cn("min-h-[120px] rounded-2xl border-2 border-dashed p-2.5 transition", over === r ? "border-accent bg-accent/10" : "border-line bg-surface")}>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider" style={{ color: c }}><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</p>
            <div className="space-y-1.5">{members.filter((m) => m.role === r).map((m) => (
              <motion.div layout key={m.id} draggable={m.role !== "owner"} onDragStart={() => setDrag(m.id)} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => m.role !== "owner" && setPick(m)} className={cn("flex items-center gap-2 rounded-xl bg-surface2 p-1.5 pr-2", m.role !== "owner" && "cursor-grab active:cursor-grabbing")}><Avatar m={m} size={26} dot={false} /><span className="truncate text-xs font-semibold">{m.name.split(" ")[0]}</span></motion.div>
            ))}</div>
          </div>
        ))}
      </div>
      <Card title="Permissions (har role ke liye)"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-xs text-mute"><th className="px-4 py-2 text-left font-semibold">Ijazat</th>{ROLES.map((x) => <th key={x.r} className="px-2 py-2 font-bold" style={{ color: x.c }}>{x.l}</th>)}</tr></thead>
        <tbody>{Object.keys(PERM_LABEL).map((k) => <tr key={k} className="border-t border-line"><td className="px-4 py-2.5 font-medium">{PERM_LABEL[k]}</td>{ROLES.map((x) => <td key={x.r} className="px-2 py-2.5 text-center"><span className="inline-block"><Toggle on={perms[x.r][k]} disabled={x.r === "owner"} onChange={() => api.togglePerm(x.r, k)} /></span></td>)}</tr>)}</tbody></table></div></Card>

      <Card title="Invite manager"><div className="p-4">
        <div className="mb-3 grid grid-cols-2 gap-3"><Field label="Kab tak"><select value={exp ?? ""} onChange={(e) => setExp(e.target.value ? +e.target.value : null)} className={inputCls}><option value="">Kabhi expire nahi</option><option value="1">1 ghanta</option><option value="24">24 ghante</option><option value="168">7 din</option></select></Field><Field label="Zyada se zyada use"><select value={max ?? ""} onChange={(e) => setMax(e.target.value ? +e.target.value : null)} className={inputCls}><option value="">Unlimited</option><option value="1">1</option><option value="5">5</option><option value="20">20</option></select></Field></div>
        <Btn className="w-full" onClick={() => api.createInvite(exp, max)}><Link2 size={16} />Nayi invite link banao</Btn>
      </div>
        {invites.map((i) => { const expired = i.expiresAt !== null && i.expiresAt < Date.now(); const dead = i.revoked || expired || (i.max !== null && i.uses >= i.max); return (
          <div key={i.id} className="flex items-center gap-3 border-t border-line px-4 py-3"><div className="min-w-0 flex-1"><p className={cn("font-mono text-sm font-bold", dead && "line-through opacity-50")}>{i.code}</p><p className="text-xs text-mute">{i.uses}{i.max ? `/${i.max}` : ""} use · {i.revoked ? "Revoke" : expired ? "Expire" : i.expiresAt ? `${fmtDateTime(i.expiresAt)} tak` : "Hamesha"}</p></div>
            {!dead && <><button onClick={() => { navigator.clipboard?.writeText(`${SITE_URL}/?invite=${i.code}`); api.toast("Link copy ho gaya", i.code, "info", 1600); }} className="rounded-full p-2 text-mute hover:bg-surface2"><Copy size={16} /></button><Btn small variant="ghost" onClick={() => api.revokeInvite(i.id)}>Revoke</Btn></>}</div>); })}
      </Card>
      <Card><Row icon={<Palette size={18} />} title="Group branding" sub="Logo, banner, accent rang" onClick={() => api.go("groupedit")} /><Row icon={<Eye size={18} />} title="Group rules edit" onClick={() => api.go("rules")} /></Card>

      <Sheet open={!!pick} onClose={() => setPick(null)} title={pick ? `${pick.name} ka role` : ""}>
        {pick && <Seg value={pick.role} onChange={(r) => { api.setRole(pick.id, r); setPick(null); }} options={[{ v: "admin", l: "Admin" }, { v: "mod", l: "Mod" }, { v: "member", l: "Member" }]} />}
      </Sheet>
    </>
  );
}
void Ban; void Gavel;
