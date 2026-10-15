"use client";
// ════════════════════════════════════════════════════════════════════
//  ChatsApp DATA LAYER  —  every read/write the UI performs lives here.
//  Today: in-memory mock (store.ts + localStorage).
//  Tomorrow: replace each function body with a Supabase call; keep signatures.
// ════════════════════════════════════════════════════════════════════
import { getState, update } from "./store";
import type { AuditEntry, Member, Message, MsgType, Poll, ProfileStyle, Role, Settings, State, StickerPack } from "./types";
import { uid } from "@/lib/util";
import { ACHIEVEMENTS, photoArt, svgUri } from "./assets";
import { DEFAULT_LOC, DUAS, HIJRI_MONTHS, SURAHS, QURAN_LOCAL, hijri, prayerTimes, qiblaBearing, PRAYER_NAMES, type PrayerKey } from "./deen";
import { mkPeaks } from "./seed";
// Supabase write-through (fire-and-forget; UI stays reactive via local store)
import { dbInsertMessage, dbUpdateMessage, dbDeleteMessage, dbSetMute, dbSetBan, dbAddWarn, dbSetRole, dbPushRemoteCommand } from "./supabase";

const S = getState;
export const me = () => S().members.find((m) => m.id === S().me)!;
export const getMember = (id: string) => S().members.find((m) => m.id === id);
export const isStaff = (m?: Member) => !!m && (m.role === "owner" || m.role === "admin" || m.role === "mod");
export const isOwner = () => me().role === "owner";
export const displayName = (m?: Member) => (m ? (m.id === S().me && S().settings.nickname ? S().settings.nickname : m.nickname || m.name) : "Koi");

// ───────── navigation ─────────
export const go = (page: string, props?: any) => update((s) => ({ nav: { ...s.nav, stack: [...s.nav.stack, { page, props }] } }));
export const back = () => update((s) => ({ nav: { ...s.nav, stack: s.nav.stack.slice(0, -1) } }));
export const closeAll = () => update((s) => ({ nav: { ...s.nav, stack: [] } }));
export const setTab = (tab: State["nav"]["tab"]) => update((s) => ({ nav: { tab, stack: [] } }));
export const setActiveChat = (chatId: string) => {
  update((s) => {
    const msgs = s.messages.filter((m) => m.chatId === chatId);
    return { ui: { ...s.ui, activeChatId: chatId }, lastRead: msgs[msgs.length - 1]?.id ?? s.lastRead };
  });
};

// ───────── toasts / achievements ─────────
export function toast(title: string, body = "", kind: "msg" | "info" | "ach" = "info", ms = 4200) {
  const id = uid("t");
  update((s) => ({ ui: { ...s.ui, toasts: [...s.ui.toasts, { id, title, body, at: Date.now(), kind }].slice(-3) } }));
  setTimeout(() => dismissToast(id), ms);
}
export const dismissToast = (id: string) => update((s) => ({ ui: { ...s.ui, toasts: s.ui.toasts.filter((t) => t.id !== id) } }));
export function unlock(id: string) {
  if (S().achievements[id]) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  update((s) => ({ achievements: { ...s.achievements, [id]: Date.now() }, ui: { ...s.ui, achievement: a } }));
  setTimeout(() => update((s) => (s.ui.achievement?.id === id ? { ui: { ...s.ui, achievement: null } } : undefined)), 4200);
}
export const burstConfetti = () => update((s) => ({ ui: { ...s.ui, confetti: s.ui.confetti + 1 } }));

// ───────── audit / alerts ─────────
export function logAudit(action: string, kind: string, target?: string) {
  const e: AuditEntry = { id: uid("a"), at: Date.now(), by: S().me, action, kind, target };
  update((s) => ({ owner: { ...s.owner, audit: [e, ...s.owner.audit].slice(0, 300) } }));
}
export function addAlert(text: string, kind: string) {
  update((s) => ({ owner: { ...s.owner, alerts: [{ id: uid("al"), at: Date.now(), text, kind, seen: false }, ...s.owner.alerts].slice(0, 100) } }));
  if (isOwner()) toast("Admin alert", text, "info");
}
export const markAlertsSeen = () => update((s) => ({ owner: { ...s.owner, alerts: s.owner.alerts.map((a) => ({ ...a, seen: true })) } }));

// ───────── settings ─────────
export const patchSettings = (p: Partial<Settings>) => update((s) => ({ settings: { ...s.settings, ...p } }));
export const patchOnboarding = (p: Partial<State["onboarding"]>) => update((s) => ({ onboarding: { ...s.onboarding, ...p } }));
export const setChecklist = (k: keyof State["onboarding"]["checklist"], v = true) => update((s) => ({ onboarding: { ...s.onboarding, checklist: { ...s.onboarding.checklist, [k]: v } } }));
export const seeHint = (k: string) => update((s) => ({ onboarding: { ...s.onboarding, hints: { ...s.onboarding.hints, [k]: true } } }));
export const seeMarker = (k: string) => update((s) => ({ onboarding: { ...s.onboarding, markers: { ...s.onboarding.markers, [k]: true } } }));
export const setDraft = (text: string) => update((s) => ({ drafts: { ...s.drafts, madrasa: text } }));
export const getDraft = () => S().drafts.madrasa ?? "";
export const setMute = (dur: "8h" | "1w" | "always" | "off") => {
  const until = dur === "8h" ? Date.now() + 8 * 3600e3 : dur === "1w" ? Date.now() + 7 * 864e5 : null;
  patchSettings({ mute: { on: dur !== "off", until }, groupMute: dur !== "off" });
};
export function setProfile(p: Partial<Pick<Member, "name" | "about" | "avatar">> & { nickname?: string }) {
  update((s) => ({ members: s.members.map((m) => (m.id === s.me ? { ...m, ...p } : m)) }));
  if (p.name) setChecklist("name");
  if (p.avatar) setChecklist("photo");
  if (p.about) setChecklist("about");
  const m = me();
  if (m.avatar && m.about) unlock("profile");
}
export const setProfileStyle = (st: ProfileStyle, id = S().me) => update((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, style: st } : m)) }));
export const setNickname = (n: string) => patchSettings({ nickname: n });
export const setMyRole = (r: Role) => update((s) => ({ members: s.members.map((m) => (m.id === s.me ? { ...m, role: r } : m)) }));
export const getOnlineUsers = () => S().members.filter((m) => m.online && !m.banned);
export const blockUser = (id: string) => update((s) => ({ blocked: Array.from(new Set([...s.blocked, id])) }));
export const unblockUser = (id: string) => update((s) => ({ blocked: s.blocked.filter((x) => x !== id) }));

// ───────── messages ─────────
export const getMessages = () => S().messages;
const isMuted = (m: Member) => m.mutedUntil === null || (typeof m.mutedUntil === "number" && m.mutedUntil > Date.now());
export const isMemberMuted = isMuted;

export function canSend(): { ok: boolean; reason?: string } {
  const m = me();
  if (m.banned) return { ok: false, reason: "Aapko group se ban kar diya gaya hai" };
  if (isMuted(m)) return { ok: false, reason: m.mutedUntil === null ? "Aap mute hain — Owner ne aapko khamosh kiya hai" : "Aap thodi der ke liye mute hain" };
  const { slow } = S().owner;
  if (slow.on && !isStaff(m) && Date.now() < S().ui.slowUntil) return { ok: false, reason: `Slow mode: ${Math.ceil((S().ui.slowUntil - Date.now()) / 1000)}s ruko` };
  return { ok: true };
}

export type NewMsg = Partial<Message> & { type: MsgType };
export function sendMessage(p: NewMsg, opts: { skipChecks?: boolean } = {}): Message | null {
  if (!opts.skipChecks) {
    const c = canSend();
    if (!c.ok) { toast("Message nahi gaya", c.reason, "info"); return null; }
  }
  const s = S();
  const now = Date.now();
  const activeChatId = s.ui.activeChatId || (s.chats[0]?.id ?? "");
  const m: Message = {
    id: uid("m"), from: s.me, chatId: activeChatId, status: s.ui.offline ? "queued" : "sent", at: now, reactions: {}, ...p,
    expiresAt: s.settings.disappearing ? now + s.settings.disappearing : undefined,
  };
  // never let p override chatId with undefined
  if (!m.chatId) m.chatId = activeChatId;
  if (m.type === "image" || m.type === "video" || m.type === "doc") m.downloaded = true;
  // automod
  const text = (m.text ?? "") + " " + (m.caption ?? "");
  const bad = s.owner.autoMod.on && !isStaff(me()) ? s.owner.autoMod.words.find((w) => w && text.toLowerCase().includes(w.toLowerCase())) : null;
  if (bad) {
    update((st) => ({ messages: [...st.messages, { ...m, chatId: m.chatId, deleted: true, text: "", caption: "", type: "system", status: "read" }] }));
    toast("Auto-mod", `Aapka message hata diya gaya (mana shuda lafz: "${bad}")`, "info");
    addAlert(`${displayName(me())} ne mana shuda lafz likha: "${bad}"`, "automod");
    return null;
  }
  update((st) => ({ messages: [...st.messages, m], ui: { ...st.ui, slowUntil: st.owner.slow.on ? now + st.owner.slow.sec * 1000 : 0 }, drafts: p.type === "text" ? { ...st.drafts, madrasa: "" } : st.drafts }));
  // → Supabase (real backend)
  if (m.from === s.me && m.from !== "system") dbInsertMessage(m);
  // achievements
  if (m.type === "text" && !m.replyTo) unlock("first_msg");
  if (m.replyTo) unlock("reply");
  if (m.type === "image") unlock("first_photo");
  if (m.type === "voice") unlock("first_voice");
  if (m.type === "sticker" || m.type === "gif") unlock("first_sticker");
  if (m.type === "poll") unlock("first_poll");
  return m;
}
export const sendText = (text: string, replyTo?: string) => sendMessage({ type: "text", text, replyTo });

export function editMessage(id: string, text: string) {
  update((s) => ({ messages: s.messages.map((m) => (m.id === id && m.from === s.me && Date.now() - m.at < 15 * 60e3 ? { ...m, text, edited: true } : m)) }));
  dbUpdateMessage(id, { text });
}
export const canEdit = (m: Message) => m.from === S().me && m.type === "text" && Date.now() - m.at < 15 * 60e3 && !m.deleted;
export function deleteMessage(id: string, forEveryone: boolean) {
  const target = S().messages.find((m) => m.id === id);
  if (target && target.from !== S().me && isStaff(me())) logAudit("Message delete kiya", "delete", (target.text ?? target.type).slice(0, 40));
  update((s) => ({ messages: forEveryone ? s.messages.map((m) => (m.id === id ? { ...m, deleted: true, text: "", src: "", caption: "", pinned: false, starred: false } : m)) : s.messages.filter((m) => m.id !== id) }));
  if (forEveryone) dbDeleteMessage(id);
}
export const toggleStar = (id: string) => update((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m)) }));
export function togglePin(id: string) {
  const m = S().messages.find((x) => x.id === id);
  if (!m) return;
  if (!isStaff(me())) { toast("Sirf admin pin kar sakta hai", "", "info"); return; }
  update((s) => ({ messages: s.messages.map((x) => (x.id === id ? { ...x, pinned: !x.pinned } : x)) }));
  logAudit(m.pinned ? "Message unpin kiya" : "Message pin kiya", "pin", (m.text ?? m.type).slice(0, 40));
}
export function react(id: string, emoji: string) {
  let next: Record<string, string[]> = {};
  update((s) => {
    const m = s.messages.find((x) => x.id === id);
    if (!m) return;
    const cur = m.reactions[emoji] ?? [];
    const mine = cur.includes(s.me);
    next = {};
    Object.entries(m.reactions).forEach(([e, u]) => { const f = u.filter((x) => x !== s.me); if (f.length) next[e] = f; });
    if (!mine) next[emoji] = [...(next[emoji] ?? []), s.me];
    return {
      messages: s.messages.map((mm) => (mm.id === id ? { ...mm, reactions: next } : mm)),
    };
  });
  // persist reactions (best-effort; column may not exist yet)
  dbUpdateMessage(id, { reactions: next } as any);
}
export function forwardMessage(id: string) {
  const m = S().messages.find((x) => x.id === id);
  if (!m) return;
  const { id: _i, at: _a, reactions: _r, readBy: _rb, pinned: _p, starred: _s, replyTo: _rt, status: _st, from: _f, ...rest } = m;
  void _i; void _a; void _r; void _rb; void _p; void _s; void _rt; void _st; void _f;
  sendMessage({ ...rest, forwarded: true });
}
export function markAllRead() {
  const ms = S().messages;
  update(() => ({ lastRead: ms[ms.length - 1]?.id ?? "" }));
}
export const markDownloaded = (id: string) => update((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, downloaded: true } : m)) }));

export function votePoll(id: string, optionId: string) {
  let pollPatch: any = null;
  update((s) => {
    const m = s.messages.find((x) => x.id === id);
    if (!m || !m.poll || m.poll.closed) return;
    const cur = m.poll.votes[s.me] ?? [];
    let next: string[];
    if (m.poll.multi) next = cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId];
    else next = cur[0] === optionId ? [] : [optionId]; // change vote
    const votes = { ...m.poll.votes, [s.me]: next };
    if (!next.length) delete votes[s.me];
    pollPatch = { ...m.poll, votes };
    return { messages: s.messages.map((mm) => (mm.id === id && mm.poll ? { ...mm, poll: pollPatch } : mm)) };
  });
  if (pollPatch) dbUpdateMessage(id, { poll_data: pollPatch });
}
export const closePoll = (id: string) => {
  const m = S().messages.find((x) => x.id === id);
  update((s) => ({ messages: s.messages.map((x) => (x.id === id && x.poll ? { ...x, poll: { ...x.poll, closed: true } } : x)) }));
  if (m?.poll) announcePollResult(m.poll);
};
export function announcePollResult(p: Poll) {
  const counts = p.options.map((o) => ({ o, n: Object.values(p.votes).filter((v) => v.includes(o.id)).length }));
  const top = counts.sort((a, b) => b.n - a.n)[0];
  update((s) => ({ messages: [...s.messages, sysMsg(`Poll band: "${p.q}" — jeetne wala: ${top?.o.text ?? "-"} (${top?.n ?? 0} vote)`)] }));
}
export function createPoll(q: string, options: { text: string; img?: string }[], o: { multi: boolean; anonymous: boolean; durationMs?: number }) {
  const poll: Poll = { q, multi: o.multi, anonymous: o.anonymous, votes: {}, closesAt: o.durationMs ? Date.now() + o.durationMs : undefined, options: options.map((x, i) => ({ id: "o" + i, text: x.text, img: x.img })) };
  return sendMessage({ type: "poll", poll });
}

// ───────── scheduled ─────────
export function scheduleMessage(text: string, at: number, kind: "msg" | "announcement" = "msg") {
  update((s) => ({ scheduled: [...s.scheduled, { id: uid("sc"), text, at, kind }].sort((a, b) => a.at - b.at) }));
  if (kind === "announcement") logAudit("Announcement schedule ki", "announce", text.slice(0, 40));
}
export const cancelScheduled = (id: string) => update((s) => ({ scheduled: s.scheduled.filter((x) => x.id !== id) }));
export const editScheduled = (id: string, text: string, at: number) => update((s) => ({ scheduled: s.scheduled.map((x) => (x.id === id ? { ...x, text, at } : x)).sort((a, b) => a.at - b.at) }));

// ───────── announcements / owner ─────────
export function postAnnouncement(title: string, text: string) {
  const m = sendMessage({ type: "announcement", title, text }, { skipChecks: true });
  if (m) logAudit("Announcement bheji", "announce", title || text.slice(0, 40));
  return m;
}
export const getActiveAnnouncement = () => [...S().messages].reverse().find((m) => m.type === "announcement" && !m.deleted);

export function muteMember(id: string, ms: number | null) {
  update((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, mutedUntil: ms === null ? null : Date.now() + ms } : m)) }));
  logAudit(`Mute kiya (${ms === null ? "hamesha" : Math.round(ms / 60000) + " min"})`, "mute", getMember(id)?.name);
  dbSetMute(id, ms === null ? null : Date.now() + (ms as number));
}
export function unmuteMember(id: string) { update((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, mutedUntil: undefined } : m)) })); logAudit("Unmute kiya", "mute", getMember(id)?.name); dbSetMute(id, undefined as any); }
export function banMember(id: string) { update((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, banned: true, online: false } : m)) })); logAudit("Ban kiya", "ban", getMember(id)?.name); dbSetBan(id, true); }
export const banUser = banMember;
export function unbanMember(id: string) { update((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, banned: false } : m)) })); logAudit("Unban kiya", "ban", getMember(id)?.name); dbSetBan(id, false); }
export function warnMember(id: string, reason: string) {
  update((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, warns: [...m.warns, { id: uid("w"), reason, at: Date.now() }] } : m)) }));
  const m = getMember(id)!;
  logAudit(`Warning di (${m.warns.length}/3): ${reason}`, "warn", m.name);
  dbAddWarn(id, reason);
  if (m.warns.length >= 3) {
    muteMember(id, 3600e3);
    addAlert(`${m.name} ko 3 warning mil gayi — auto-mute (1 ghanta)`, "warn");
    update((s) => ({ messages: [...s.messages, sysMsg(`${m.name} ko 3 warnings par auto-mute kar diya gaya`)] }));
  }
}
export const clearWarns = (id: string) => update((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, warns: [] } : m)) }));
export function removeMember(id: string) {
  const n = getMember(id)?.name;
  update((s) => ({ members: s.members.filter((m) => m.id !== id) }));
  logAudit("Member nikala", "remove", n);
}
export function addMember(name: string) {
  const i = S().members.length;
  const m: Member = { id: uid("m"), name, about: "Naya member", role: "member", online: false, lastSeen: Date.now(), joined: Date.now(), color: ["#2ccf8a", "#4cc3ff", "#ff8a5c", "#e8bd57", "#ff6f91"][i % 5], mutedUntil: undefined, banned: false, warns: [], phone: "+92 300 0000000", tone: "Chime", version: S().owner.currentVersion, style: { banner: "plain", effect: "none", frame: "none", nameStyle: "plain", accent: "#2ccf8a", badges: [] } };
  update((s) => ({ members: [...s.members, m] }));
  logAudit("Member add kiya", "add", name);
  welcomeMember(m);
}
export function welcomeMember(m: Member) {
  update((s) => ({ messages: [...s.messages, sysMsg(`🌙 ${m.name} group me aa gaye! Assalamu Alaikum aur khush aamdeed — sab milke unka swagat karein.`)] }));
}
export function setRole(id: string, role: Role) {
  update((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, role } : m)) }));
  logAudit(`Role badla → ${role}`, "role", getMember(id)?.name);
  dbSetRole(id, role);
}
export const setSlowMode = (on: boolean, sec: number) => { update((s) => ({ owner: { ...s.owner, slow: { on, sec } } })); logAudit(on ? `Slow mode ON (${sec}s)` : "Slow mode OFF", "slow"); };
export const patchAutoMod = (p: Partial<State["owner"]["autoMod"]>) => update((s) => ({ owner: { ...s.owner, autoMod: { ...s.owner.autoMod, ...p } } }));
export const setRules = (rules: string) => { update((s) => ({ owner: { ...s.owner, rules } })); logAudit("Rules edit kiye", "rules"); };
export const setBranding = (b: Partial<State["owner"]["branding"]>) => { update((s) => ({ owner: { ...s.owner, branding: { ...s.owner.branding, ...b } } })); logAudit("Group branding badli", "brand"); };
export const togglePerm = (role: Role, key: string) => update((s) => ({ owner: { ...s.owner, perms: { ...s.owner.perms, [role]: { ...s.owner.perms[role], [key]: !s.owner.perms[role][key] } } } }));
export const setAnnounceDraft = (t: string) => update((s) => ({ owner: { ...s.owner, announceDraft: t } }));

export function createInvite(expiryHours: number | null, max: number | null) {
  const code = "MADRASA-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  update((s) => ({ owner: { ...s.owner, invites: [{ id: uid("i"), code, createdAt: Date.now(), expiresAt: expiryHours ? Date.now() + expiryHours * 3600e3 : null, uses: 0, max, revoked: false }, ...s.owner.invites] } }));
  logAudit("Invite link banayi", "invite", code);
}
export const revokeInvite = (id: string) => { update((s) => ({ owner: { ...s.owner, invites: s.owner.invites.map((i) => (i.id === id ? { ...i, revoked: true } : i)) } })); logAudit("Invite revoke ki", "invite"); };

// ───────── commands ─────────
export const BUILTIN_COMMANDS: { name: string; desc: string; staff?: boolean; args?: string }[] = [
  { name: "help", desc: "Saari commands ki list dikhao" },
  { name: "qibla", desc: "Qibla ki simt (degree) batao" },
  { name: "dua", desc: "Aaj ki ek dua" },
  { name: "tarikh", desc: "Aaj ki Islamic tarikh" },
  { name: "roll", desc: "Pasa phenko (1–6)" },
  { name: "quiz", desc: "Deen quiz game kholo" },
  { name: "ttt", desc: "Tic-tac-toe khelo" },
  { name: "paheli", desc: "Aaj ki paheli" },
  { name: "poll", desc: "Naya poll banao" },
  { name: "slow", desc: "Slow mode (seconds) — /slow 10 ya /slow off", staff: true, args: "10" },
  { name: "announce", desc: "Announcement bhejo", staff: true, args: "text" },
  { name: "mute", desc: "Member ko 1 ghante ke liye mute karo — /mute Bilal", staff: true, args: "naam" },
  { name: "ban", desc: "Member ko ban karo — /ban Bilal", staff: true, args: "naam" },
  { name: "warn", desc: "Member ko warning do — /warn Bilal", staff: true, args: "naam" },
];
export function getLocation() {
  try { const r = localStorage.getItem("chatsapp:loc"); if (r) return JSON.parse(r) as typeof DEFAULT_LOC; } catch { /* ignore */ }
  return DEFAULT_LOC;
}
export const saveLocation = (l: typeof DEFAULT_LOC) => { try { localStorage.setItem("chatsapp:loc", JSON.stringify(l)); } catch { /* ignore */ } };
export function prayerLines() {
  const l = getLocation(), t = prayerTimes(new Date(), l.lat, l.lng);
  const f = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return (["fajr", "dhuhr", "asr", "maghrib", "isha"] as PrayerKey[]).map((k) => `${PRAYER_NAMES[k]}: ${f(t[k])}`).join("\n") + `\n(${l.name})`;
}
export function hijriText() { const h = hijri(); return `${h.d} ${HIJRI_MONTHS[h.m - 1]} ${h.y} Hijri`; }
const postCmd = (cmd: string, text: string) => {
  update((s) => ({ messages: [...s.messages, sysMsg(text, { type: "cmd", cmd })], owner: { ...s.owner, cmdLog: [{ id: uid("l"), at: Date.now(), by: s.me, cmd: "/" + cmd }, ...s.owner.cmdLog].slice(0, 100) } }));
};
const findMember = (q: string) => S().members.find((m) => m.id !== S().me && m.name.toLowerCase().includes(q.trim().toLowerCase().replace(/^@/, "")));
/** returns true if text was a command (handled) */
export function execCommand(raw: string): { handled: boolean; open?: string } {
  const t = raw.trim();
  if (!t.startsWith("/")) return { handled: false };
  const [nm, ...rest] = t.slice(1).split(" ");
  const name = nm.toLowerCase(), arg = rest.join(" ").trim();
  const staff = isStaff(me());
  const custom = S().owner.commands.find((c) => c.name.toLowerCase() === name);
  if (custom) {
    const out = custom.reply.replace("{namaz}", prayerLines()).replace("{tarikh}", new Date().toLocaleDateString("en-GB")).replace("{hijri}", hijriText()).replace(/\{user\}/g, displayName(me()));
    postCmd(name, out);
    update((s) => ({ owner: { ...s.owner, commands: s.owner.commands.map((c) => (c.id === custom.id ? { ...c, uses: c.uses + 1 } : c)) } }));
    return { handled: true };
  }
  const b = BUILTIN_COMMANDS.find((c) => c.name === name);
  if (!b) { toast("Command nahi mili", `/${name} maujood nahi. "/" dabao list dekhne ke liye`, "info"); return { handled: true }; }
  if (b.staff && !staff) { toast("Sirf admin ke liye", `/${name} aap use nahi kar sakte`, "info"); return { handled: true }; }
  switch (name) {
    case "help": postCmd(name, "Commands:\n" + [...BUILTIN_COMMANDS.filter((c) => !c.staff || staff), ...S().owner.commands].map((c) => `/${c.name} — ${c.desc}`).join("\n")); break;
    case "qibla": { const l = getLocation(); postCmd(name, `🧭 ${l.name} se Qibla ki simt: ${qiblaBearing(l.lat, l.lng).toFixed(1)}° (shimal se ghari ki simt me)`); break; }
    case "dua": { const d = DUAS[Math.floor(Math.random() * DUAS.length)]; postCmd(name, `🤲 ${d.title}\n${d.ar}\n${d.rom}\n— ${d.tr}`); break; }
    case "tarikh": postCmd(name, `📅 Aaj ${hijriText()}`); break;
    case "roll": postCmd(name, `🎲 ${displayName(me())} ka pasa: ${1 + Math.floor(Math.random() * 6)}`); break;
    case "quiz": postCmd(name, "🧠 Deen Quiz shuru! Khel tab me jakar hissa lo."); return { handled: true, open: "quiz" };
    case "ttt": postCmd(name, "⭕❌ Tic-tac-toe ka challenge! Khel tab me aao."); return { handled: true, open: "ttt" };
    case "paheli": postCmd(name, "🧩 Aaj ki paheli ready hai! Khel tab me jawab do."); return { handled: true, open: "paheli" };
    case "poll": return { handled: true, open: "poll" };
    case "slow": if (arg === "off") setSlowMode(false, S().owner.slow.sec); else setSlowMode(true, Math.max(2, parseInt(arg) || 10)); postCmd(name, S().owner.slow.on ? `🐢 Slow mode ON: har ${S().owner.slow.sec}s me 1 message` : "Slow mode band"); break;
    case "announce": if (arg) postAnnouncement("Elaan", arg); break;
    case "mute": case "ban": case "warn": {
      const m = findMember(arg);
      if (!m) { toast("Member nahi mila", arg, "info"); break; }
      if (name === "mute") muteMember(m.id, 3600e3); else if (name === "ban") banMember(m.id); else warnMember(m.id, "Command se warning");
      postCmd(name, `${m.name} par /${name} laga diya gaya`); break;
    }
  }
  return { handled: true };
}
export const addCommand = (name: string, desc: string, reply: string) => { update((s) => ({ owner: { ...s.owner, commands: [...s.owner.commands, { id: uid("c"), name: name.replace(/^\//, "").toLowerCase().replace(/\s+/g, ""), desc, reply, uses: 0 }] } })); logAudit("Custom command banayi", "command", "/" + name); };
export const removeCommand = (id: string) => update((s) => ({ owner: { ...s.owner, commands: s.owner.commands.filter((c) => c.id !== id) } }));

// ───────── incoming (mock realtime) ─────────
export function receiveMessage(from: string, p: NewMsg) {
  const s = S();
  const sender = getMember(from);
  if (!sender || sender.banned || isMuted(sender) || s.blocked.includes(from)) return;
  const now = Date.now();
  const text = (p.text ?? "") + " " + (p.caption ?? "");
  const bad = s.owner.autoMod.on && !isStaff(sender) ? s.owner.autoMod.words.find((w) => w && text.toLowerCase().includes(w.toLowerCase())) : null;
  const m: Message = { id: uid("m"), from, chatId: p.chatId || s.ui.activeChatId || s.chats[0]?.id || "", status: "read", at: now, reactions: {}, expiresAt: s.settings.disappearing ? now + s.settings.disappearing : undefined, ...p };
  if (m.type === "image" || m.type === "video" || m.type === "doc") m.downloaded = s.settings.autoDl.photos.wifi;
  if (bad) {
    update((st) => ({ messages: [...st.messages, { ...m, type: "system", deleted: true, text: "", caption: "" }] }));
    addAlert(`${sender.name} ne mana shuda lafz likha: "${bad}" — message auto-delete ho gaya`, "automod");
    return;
  }
  update((st) => ({ messages: [...st.messages, m] }));
  const st = S();
  const inChat = st.nav.tab === "chat" && st.nav.stack.length === 0 && typeof document !== "undefined" && document.visibilityState === "visible";
  if (!inChat && !st.settings.groupMute && !dndActive()) {
    const body = m.type === "text" ? m.text ?? "" : m.type === "image" ? "📷 Photo" : m.type === "voice" ? "🎙️ Voice note" : "Naya message";
    toast(displayName(sender), body, "msg");
  }
}
export function dndActive() {
  const d = S().settings.dnd;
  if (!d.on) return false;
  const n = new Date(), v = n.getHours() * 60 + n.getMinutes();
  const [fh, fm] = d.from.split(":").map(Number), [th, tm] = d.to.split(":").map(Number);
  const a = fh * 60 + fm, b = th * 60 + tm;
  return a <= b ? v >= a && v < b : v >= a || v < b;
}
export const setOffline = (v: boolean) => update((s) => ({ ui: { ...s.ui, offline: v } }));
export function flushQueue() {
  if (S().ui.offline) return;
  update((s) => ({ messages: s.messages.map((m) => (m.status === "queued" ? { ...m, status: "sent", at: Date.now() } : m)) }));
}
export const clearQueue = () => update((s) => ({ messages: s.messages.filter((m) => m.status !== "queued") }));

// ───────── stickers / packs ─────────
export const addRecentEmoji = (e: string) => update((s) => ({ recentEmoji: [e, ...s.recentEmoji.filter((x) => x !== e)].slice(0, 24) }));
export const addRecentSticker = (src: string) => update((s) => ({ recentStickers: [src, ...s.recentStickers.filter((x) => x !== src)].slice(0, 16) }));
export const saveToPack = (packId: string, src: string) => update((s) => ({ stickerPacks: s.stickerPacks.map((p) => (p.id === packId ? { ...p, stickers: [src, ...p.stickers] } : p)) }));
export const createPack = (name: string) => update((s) => ({ stickerPacks: [...s.stickerPacks, { id: uid("pk"), name, icon: svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#2ccf8a"/><text x="32" y="44" font-size="34" text-anchor="middle">⭐</text></svg>'), stickers: [], custom: true } as StickerPack] }));
export const renamePack = (id: string, name: string) => update((s) => ({ stickerPacks: s.stickerPacks.map((p) => (p.id === id ? { ...p, name } : p)) }));
export const deletePack = (id: string) => update((s) => ({ stickerPacks: s.stickerPacks.filter((p) => p.id !== id) }));
export const removeSticker = (packId: string, i: number) => update((s) => ({ stickerPacks: s.stickerPacks.map((p) => (p.id === packId ? { ...p, stickers: p.stickers.filter((_, k) => k !== i) } : p)) }));

// ───────── deen ─────────
export function tasbeehTap() {
  const day = new Date().toDateString();
  update((s) => ({ tasbeeh: { total: s.tasbeeh.total + 1, today: (s.tasbeeh.day === day ? s.tasbeeh.today : 0) + 1, day } }));
}
export const toggleBookmark = (k: string) => { update((s) => ({ bookmarks: s.bookmarks.includes(k) ? s.bookmarks.filter((x) => x !== k) : [...s.bookmarks, k] })); unlock("quran"); };
export async function getSurah(n: number): Promise<{ ar: string[]; ur: string[] } | null> {
  if (QURAN_LOCAL[n]) return QURAN_LOCAL[n];
  const c = S().quranCache[n];
  if (c) return c;
  try {
    const [a, u] = await Promise.all([
      fetch(`https://api.alquran.cloud/v1/surah/${n}/quran-uthmani`).then((r) => r.json()),
      fetch(`https://api.alquran.cloud/v1/surah/${n}/ur.jalandhry`).then((r) => r.json()),
    ]);
    const val = { ar: a.data.ayahs.map((x: any) => x.text as string), ur: u.data.ayahs.map((x: any) => x.text as string) };
    update((s) => ({ quranCache: { ...s.quranCache, [n]: val } }));
    return val;
  } catch { return null; }
}
export const surahInfo = (n: number) => SURAHS[n - 1];

// ───────── storage / backup / devices ─────────
export function clearCache() {
  const freed = S().storage.cache;
  update((s) => ({ storage: { ...s.storage, cache: 0 } }));
  return freed;
}
export const clearStorage = (k: "media" | "docs" | "voice") => update((s) => ({ storage: { ...s.storage, [k]: 0 } }));
export function runBackup(onProgress: (p: number) => void) {
  return new Promise<void>((res) => {
    let p = 0;
    const iv = setInterval(() => {
      p += 4 + Math.random() * 9; onProgress(Math.min(100, p));
      if (p >= 100) { clearInterval(iv); update((s) => ({ backup: { last: Date.now(), size: s.backup.size + 1.2e6 } })); res(); }
    }, 160);
  });
}
export const logoutDevice = (id: string) => update((s) => ({ devices: s.devices.filter((d) => d.id !== id) }));

// ───────── remote control (owner superpowers) ─────────
const TAB = typeof window !== "undefined" ? uid("tab") : "ssr";
let bc: BroadcastChannel | null = null;
export function remoteChannel() {
  if (typeof window === "undefined" || bc) return bc;
  try {
    bc = new BroadcastChannel("chatsapp-remote");
    bc.onmessage = (e) => {
      const d = e.data;
      if (d?.tab === TAB) return;
      if (d?.type === "reload") {
        update((s) => ({ ui: { ...s.ui, remoteOverlay: { message: d.message || "App naya ho raha hai…", kind: d.kind } } }));
        setTimeout(() => wipeDeviceAndReload(d.version), 2600);
      }
    };
  } catch { bc = null; }
  return bc;
}
/** G2 — true fresh start: service worker, localStorage, sessionStorage, Cache Storage, IndexedDB */
export async function wipeDeviceAndReload(version?: string) {
  try { const regs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((regs ?? []).map((r) => r.unregister())); } catch { /* ignore */ }
  try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch { /* ignore */ }
  try { const dbs = await (indexedDB as any).databases?.(); await Promise.all((dbs ?? []).map((d: any) => indexedDB.deleteDatabase(d.name))); } catch { /* ignore */ }
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
  try { if (version) sessionStorage.setItem("chatsapp:justUpdated", version); } catch { /* ignore */ }
  location.reload();
}
export function reloadUsers(ids: string[] | "all", message: string) {
  const s = S();
  const targets = ids === "all" ? s.members.filter((m) => m.id !== s.me && !m.banned).map((m) => m.id) : ids;
  const job = { id: uid("job"), at: Date.now(), by: s.me, scope: ids === "all" ? ("all" as const) : ("user" as const), message, kind: "reload" as const, entries: targets.map((userId) => ({ userId, status: "pending" as const, at: Date.now() })) };
  update((st) => ({ owner: { ...st.owner, jobs: [job, ...st.owner.jobs].slice(0, 30), history: [{ id: uid("h"), at: Date.now(), by: st.me, kind: "reload" as const, version: st.owner.currentVersion, scope: ids === "all" ? "Sab members" : targets.map((t) => getMember(t)?.name).join(", "), note: message }, ...st.owner.history] } }));
  logAudit(ids === "all" ? "Sab ka app reload kiya" : "Member ka app reload kiya", "reload", ids === "all" ? "Sab" : getMember(targets[0])?.name);
  remoteChannel()?.postMessage({ type: "reload", kind: "reload", message, tab: TAB });
  // → real cross-device push via Supabase
  dbPushRemoteCommand({ type: "reload", message, at: Date.now(), by: s.me, target: ids === "all" ? "all" : targets });
  targets.forEach((uidd) => setTimeout(() => settleEntry(job.id, uidd), 900 + Math.random() * 3500));
  return job.id;
}
function settleEntry(jobId: string, userId: string, force?: "done" | "failed") {
  const offline = !getMember(userId)?.online;
  const status = force ?? (offline && Math.random() < 0.55 ? "failed" : Math.random() < 0.05 ? "failed" : "done");
  update((s) => ({ owner: { ...s.owner, jobs: s.owner.jobs.map((j) => (j.id === jobId ? { ...j, entries: j.entries.map((e) => (e.userId === userId ? { ...e, status, at: Date.now() } : e)) } : j)) } }));
}
export function retryFailed(jobId: string) {
  const j = S().owner.jobs.find((x) => x.id === jobId);
  if (!j) return;
  const ids = j.entries.filter((e) => e.status === "failed").map((e) => e.userId);
  update((s) => ({ owner: { ...s.owner, jobs: s.owner.jobs.map((x) => (x.id === jobId ? { ...x, entries: x.entries.map((e) => (ids.includes(e.userId) ? { ...e, status: "pending" } : e)) } : x)) } }));
  ids.forEach((u) => setTimeout(() => settleEntry(jobId, u, "done"), 800 + Math.random() * 2000));
}
export const NEXT_VERSION = { version: "2.5.0", notes: ["Naye Eid stickers aur GIFs", "Voice note player ab 2x speed pe bhi smooth", "Prayer times ki accuracy behtar", "Group insights me naye charts", "Chhoti chhoti bugs theek ki gayi"] };
export function detectUpdate(force = false) {
  const o = S().owner;
  if (o.available || (o.rollout && o.rollout.stage < 100)) return;
  if (!force && o.currentVersion === NEXT_VERSION.version) return;
  update((s) => ({ owner: { ...s.owner, available: s.owner.currentVersion === NEXT_VERSION.version ? { version: "2.6.0", notes: ["Naye wallpapers", "Speed improvements"] } : NEXT_VERSION } }));
  if (isOwner()) addAlert("Naya version tayyar hai! Remote tab me jakar push karein.", "update");
}
export function pushVersion(message: string) {
  const o = S().owner;
  if (!o.available) return false;
  const others = S().members.filter((m) => m.id !== S().me && !m.banned);
  const k = Math.max(1, Math.round(others.length * 0.1));
  const picks = [...others].sort(() => Math.random() - 0.5).slice(0, k).map((m) => m.id);
  update((s) => ({ owner: { ...s.owner, rollout: { version: o.available!.version, stage: 10, updated: picks, message }, history: [{ id: uid("h"), at: Date.now(), by: s.me, kind: "push", version: o.available!.version, scope: "Stage 10%", note: message }, ...s.owner.history] }, members: s.members.map((m) => (picks.includes(m.id) ? { ...m, version: o.available!.version } : m)) }));
  logAudit(`Version ${o.available.version} push (10%)`, "push");
  remoteChannel()?.postMessage({ type: "reload", kind: "push", message, version: o.available.version, tab: TAB });
  // → real cross-device push via Supabase
  dbPushRemoteCommand({ type: "push", message, version: o.available.version, at: Date.now(), by: S().me, target: "all" });
  return true;
}
export function advanceRollout(stage: 50 | 100) {
  const r = S().owner.rollout;
  if (!r) return;
  const others = S().members.filter((m) => m.id !== S().me && !m.banned);
  const want = stage === 100 ? others.length : Math.round(others.length * 0.5);
  const updated = [...r.updated];
  others.forEach((m) => { if (updated.length < want && !updated.includes(m.id)) updated.push(m.id); });
  update((s) => ({
    members: s.members.map((m) => (updated.includes(m.id) || (stage === 100 && m.id === s.me) ? { ...m, version: r.version } : m)),
    owner: { ...s.owner, rollout: { ...r, stage, updated }, ...(stage === 100 ? { currentVersion: r.version, available: null } : {}), history: [{ id: uid("h"), at: Date.now(), by: s.me, kind: "push" as const, version: r.version, scope: `Stage ${stage}%`, note: r.message }, ...s.owner.history] },
    ui: stage === 100 ? { ...s.ui, changelog: true } : s.ui,
  }));
  logAudit(`Version ${r.version} rollout ${stage}%`, "push");
}
export const dismissChangelog = () => update((s) => ({ ui: { ...s.ui, changelog: false }, owner: { ...s.owner, lastChangelogSeen: s.owner.currentVersion } }));
export const dismissRemoteOverlay = () => update((s) => ({ ui: { ...s.ui, remoteOverlay: null } }));
export const dismissAzaan = () => update((s) => ({ ui: { ...s.ui, azaan: null } }));
export const triggerAzaan = (name = "Zuhr") => update((s) => ({ ui: { ...s.ui, azaan: { name, at: Date.now() } } }));

// ───────── rooms ─────────
export const patchRoom = (id: string, fn: (r: State["rooms"][number]) => State["rooms"][number]) => update((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? fn(r) : r)) }));
export const createRoom = (title: string, startsAt?: number) => update((s) => ({ rooms: [{ id: uid("r"), title, host: s.me, live: !startsAt, startsAt, remind: !!startsAt, speakers: [s.me], listeners: [], hands: [], mutedSp: [] }, ...s.rooms] }));
export const endRoom = (id: string) => update((s) => ({ rooms: s.rooms.filter((r) => r.id !== id) }));

// ───────── link previews / media helpers ─────────
export function getLinkPreview(url: string) {
  let host = url;
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
  const known: Record<string, { title: string; desc: string; i: number }> = {
    "islamqa.info": { title: "IslamQA — Sawal o Jawab", desc: "Quran aur Sunnat ki roshni me deeni sawalat ke jawabat.", i: 2 },
    "youtube.com": { title: "YouTube video", desc: "Ye video YouTube par dekhein.", i: 5 },
    "youtu.be": { title: "YouTube video", desc: "Ye video YouTube par dekhein.", i: 5 },
    "wikipedia.org": { title: "Wikipedia", desc: "Aazad encyclopedia — maloomat ka khazana.", i: 4 },
    "quran.com": { title: "Quran.com — Quran padhein", desc: "Quran Arabic aur tarjume ke saath.", i: 3 },
  };
  const k = Object.keys(known).find((x) => host.endsWith(x));
  const info = k ? known[k] : { title: host, desc: "Link kholne ke liye dabayein.", i: host.length };
  return { host, title: info.title, desc: info.desc, img: photoArt(info.i) };
}

export function makeVoiceMessage(src: string, dur: number) {
  return sendMessage({ type: "voice", src, dur: Math.max(1, Math.round(dur)), peaks: mkPeaks(Math.floor(Math.random() * 999)) });
}
export const resetEverything = () => wipeDeviceAndReload();
export const unlockAll = () => ACHIEVEMENTS.forEach((a) => unlock(a.id));
export function simulateIncoming() {
  const others = S().members.filter((m) => m.id !== S().me && !m.banned && !isMuted(m) && !S().blocked.includes(m.id));
  const f = others[Math.floor(Math.random() * others.length)];
  if (f) receiveMessage(f.id, { type: "text", text: "Aur sunao, kya chal raha hai? 😄" });
}

// ───────── insights (REAL data only — no fake numbers) ─────────
export function getInsights() {
  const s = S();
  const real = s.messages.filter((m) => m.type !== "system" && !m.deleted);
  const dayStr = (d: Date) => d.toDateString();
  const today = new Date();
  const days: string[] = [];
  const perDay: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 864e5);
    days.push(["Itw", "Pir", "Mng", "Bdh", "Jum", "Jum", "Haf"][d.getDay()]);
    perDay.push(real.filter((m) => dayStr(new Date(m.at)) === dayStr(d)).length);
  }
  const hours = Array.from({ length: 24 }, (_, h) => real.filter((m) => new Date(m.at).getHours() === h).length);
  const heat = Array.from({ length: 7 }, (_, d) => {
    const dd = new Date(today.getTime() - (6 - d) * 864e5);
    return Array.from({ length: 24 }, (_, h) => real.filter((m) => dayStr(new Date(m.at)) === dayStr(dd) && new Date(m.at).getHours() === h).length);
  });
  const top = s.members
    .filter((m) => !m.banned)
    .map((m) => ({ id: m.id, n: real.filter((x) => x.from === m.id).length }))
    .filter((t) => t.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  return { perDay, days, hours, heat, top };
}

export const addScore = (k: "quiz" | "ttt" | "paheli", n = 1) => update((s) => ({ scores: { ...s.scores, [k]: s.scores[k] + n } }));
// system message helper — always carries the active chatId
const sysMsg = (text: string, extra: Partial<Message> = {}): Message => ({
  id: uid("m"), from: "system", chatId: getState().ui.activeChatId || getState().chats[0]?.id || "",
  type: "system", text, at: Date.now(), status: "read", reactions: {}, ...extra,
});
export const postSystem = (text: string) => update((s) => ({ messages: [...s.messages, sysMsg(text)] }));
export function applyRamadanPack() {
  const d = new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10);
  patchSettings({ theme: "dark", chatTheme: "zafran", wallpaper: "raat", wallDim: 0.3, ramadan: { mode: "on", start: d } });
  burstConfetti();
}
export function startOnboardingAgain() { update((s) => ({ onboarding: { ...s.onboarding, done: false } })); }
export const finishOnboarding = () => { const m = me(); patchOnboarding({ done: true, welcomed: true }); welcomeMember(m); };
