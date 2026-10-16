"use client";
// ChatsApp Supabase adapter — real backend, no mocks.
// Query patterns verified against the live project.
import { supabase, MAIN_GROUP_ID, setMainGroupId, OWNER_EMAIL } from "./supabase";
import { getState, update, patchUI, toast } from "./store";import type { ChatMeta, Member, Message, Role } from "./types";
import { unlockBadge } from "./achievements";

const sb = () => supabase();
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ───────── row mappers ─────────
function toPrivacy(p: any) {
  // Supabase columns (agar hon) warna undefined → DEFAULT_PRIVACY
  const g = (v: any) => (v === "everyone" || v === "contacts" || v === "nobody" ? v : undefined);
  const pr = {
    lastSeen: g(p.privacy_lastseen),
    photo: g(p.privacy_photo),
    about: g(p.privacy_about),
    online: g(p.privacy_online),
  };
  return Object.values(pr).every((v) => v === undefined) ? undefined : pr;
}
function toMember(p: any, role: Role, mute: any, ban: any, warns: any[]): Member {
  return {
    id: p.id,
    name: p.display_name || "Member",
    about: p.about || "",
    role,
    online: !!p.online,
    lastSeen: p.last_seen || 0,
    avatar: p.photo_url || undefined,
    banned: !!ban,
    mutedUntil: mute ? (mute.until === 0 ? null : mute.until) : undefined,
    warns: (warns || []).map((w: any) => ({ reason: w.reason || "Warning", at: 0 })),
    privacy: toPrivacy(p),
  };
}

function toMessage(r: any): Message {
  return {
    id: r.id,
    from: r.sender_id,
    chatId: r.chat_id || MAIN_GROUP_ID,
    type: (r.type as Message["type"]) || "text",
    text: r.text || "",
    at: r.created_at || Date.now(),
    replyTo: r.reply_to || undefined,
    edited: !!(r as any).edited,
    reactions: (r as any).reactions || {},
    src: r.media_url || undefined,
    dur: (r as any).duration || undefined,
    caption: (r as any).caption || undefined,
    deleted: !!r.is_deleted,
    readBy: Array.isArray(r.read_by) ? r.read_by.filter((x: any) => typeof x === "string") : [],
  };
}

// ───────── auth ─────────
export async function getSession() {
  const { data } = await sb().auth.getSession();
  return data.session;
}
export function signInWithGoogle() {
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  return sb().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
}
export function signOut() {
  return sb().auth.signOut();
}
export function onAuthChange(cb: (s: any) => void) {
  const { data } = sb().auth.onAuthStateChange((_e, s) => cb(s));
  return () => data.subscription.unsubscribe();
}

// ───────── initial load ─────────
export async function load(userId: string, email: string): Promise<boolean> {
  // 0. ALL chats the user participates in — never hardcode ids
  let myChatIds: string[] = [];
  let chatRows: any[] = [];
  try {
    const { data: parts } = await sb().from("chat_participants").select("chat_id").eq("user_id", userId);
    myChatIds = [...new Set((parts || []).map((p: any) => p.chat_id))];
    if (myChatIds.length > 0) {
      const { data: chats } = await sb().from("chats").select("id,type,name,photo_url,is_main_group").in("id", myChatIds);
      chatRows = chats || [];
    } else {
      const { data: chats } = await sb().from("chats").select("id,type,name,photo_url,is_main_group").limit(20);
      chatRows = chats || [];
    }
    let main = chatRows.find((c: any) => c.is_main_group) || chatRows.find((c: any) => c.type === "group") || null;
    // FIX: agar user ke paas sirf DMs hain (main group nahi mila), to real main group dhoondo aur auto-join karo
    // (RLS fix ke baad is_main_group=true sab authenticated users dekh sakte hain)
    if (!main) {
      try {
        const { data: mg } = await sb().from("chats").select("id,type,name,photo_url,is_main_group").eq("is_main_group", true).maybeSingle();
        if (mg?.id) {
          main = mg;
          // user ko main group me add karo (agar pehle se nahi)
          try {
            const { data: ex2 } = await sb().from("chat_participants").select("chat_id").eq("chat_id", mg.id).eq("user_id", userId).maybeSingle();
            if (!ex2) await sb().from("chat_participants").insert({ chat_id: mg.id, user_id: userId });
          } catch { /* ignore */ }
          if (!chatRows.find((c: any) => c.id === mg.id)) chatRows.push(mg);
        }
      } catch { /* ignore */ }
    }
    if (!main) main = chatRows[0] || null;
    if (main?.id) {
      setMainGroupId(main.id);
      if (!myChatIds.includes(main.id)) myChatIds.push(main.id);
      // ensure user is a participant (RLS needs this to read messages)
      // NOTE: upsert nahi — sirf INSERT (RLS UPDATE allow nahi karta, 403 ata hai)
      try {
        const { data: ex } = await sb().from("chat_participants").select("chat_id").eq("chat_id", main.id).eq("user_id", userId).maybeSingle();
        if (!ex) await sb().from("chat_participants").insert({ chat_id: main.id, user_id: userId });
      } catch { /* ignore */ }
    }
  } catch { /* keep going */ }
  const allChatIds = myChatIds.length > 0 ? myChatIds : [MAIN_GROUP_ID];

  // 1. profile (create + auto-join main group for newcomers)
  try {
    const { data: prof } = await sb().from("profiles").select("*").eq("id", userId).single();
    if (!prof) {
      const name = email.split("@")[0].replace(/[._-]/g, " ");
      await sb().from("profiles").insert({ id: userId, display_name: name, email, photo_url: "", about: "", online: true, last_seen: Date.now() });
      if (MAIN_GROUP_ID) await sb().from("chat_participants").insert({ chat_id: MAIN_GROUP_ID, user_id: userId });
      if (email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
        await sb().from("user_roles").upsert({ user_id: userId, role: "owner" });
      }
      // Phase 6 — F12: naya user → profile wizard dikhao
      try { localStorage.setItem(`chatsapp:newuser:${userId}`, "1"); } catch { /* ignore */ }
    } else {
      await sb().from("profiles").update({ online: true, last_seen: Date.now() }).eq("id", userId);
    }
  } catch { /* keep going */ }

  // 2. members + roles + moderation
  let members: Member[] = [];
  let profiles: any[] = [];
  try {
    const [{ data: profs }, { data: roles }, { data: mutes }, { data: bans }, { data: warns }] = await Promise.all([
      sb().from("profiles").select("*"),
      sb().from("user_roles").select("*"),
      MAIN_GROUP_ID ? sb().from("mutes").select("*").eq("chat_id", MAIN_GROUP_ID) : Promise.resolve({ data: [] }),
      MAIN_GROUP_ID ? sb().from("bans").select("*").eq("chat_id", MAIN_GROUP_ID) : Promise.resolve({ data: [] }),
      MAIN_GROUP_ID ? sb().from("warns").select("*").eq("chat_id", MAIN_GROUP_ID) : Promise.resolve({ data: [] }),
    ]);
    profiles = profs || [];
    const roleOf = (id: string): Role => {
      const r = (roles || []).find((x: any) => x.user_id === id)?.role;
      return r === "owner" || r === "admin" || r === "mod" ? r : "member";
    };
    members = profiles.map((p: any) =>
      toMember(
        p,
        roleOf(p.id),
        (mutes || []).find((x: any) => x.user_id === p.id),
        (bans || []).find((x: any) => x.user_id === p.id),
        (warns || []).filter((x: any) => x.user_id === p.id)
      )
    );
  } catch { /* keep going */ }

  // 3. messages for ALL chats
  let messages: Message[] = [];
  try {
    const { data: msgs } = await sb().from("messages").select("*").in("chat_id", allChatIds).order("created_at", { ascending: true }).limit(1500);
    messages = (msgs || []).map(toMessage);
  } catch { /* keep going */ }

  // 4. chat list meta (group + DMs)
  let chats: ChatMeta[] = [];
  try {
    let dmParts: any[] = [];
    const dmIds = chatRows.filter((c: any) => c.type !== "group" && !c.is_main_group).map((c: any) => c.id);
    if (dmIds.length > 0) {
      const { data } = await sb().from("chat_participants").select("chat_id,user_id").in("chat_id", dmIds);
      dmParts = data || [];
    }
    const lastAt: Record<string, number> = {};
    messages.forEach((m) => {
      if (!lastAt[m.chatId] || m.at > lastAt[m.chatId]) lastAt[m.chatId] = m.at;
    });
    chats = chatRows
      .filter((c: any) => allChatIds.includes(c.id))
      .map((c: any) => {
        const isGroup = c.is_main_group || c.type === "group";
        if (isGroup)
          return { id: c.id, type: "group" as const, name: c.name || "Madrasa Group", photo: c.photo_url || "", lastAt: lastAt[c.id] || 0 };
        const otherId = dmParts.find((p: any) => p.chat_id === c.id && p.user_id !== userId)?.user_id;
        const other = profiles.find((p: any) => p.id === otherId);
        return {
          id: c.id,
          type: "dm" as const,
          name: other?.display_name || c.name || "Chat",
          photo: other?.photo_url || c.photo_url || "",
          otherId,
          lastAt: lastAt[c.id] || 0,
        };
      });
    chats.sort((a, b) => (a.type === "group" ? -1 : b.type === "group" ? 1 : b.lastAt - a.lastAt));
  } catch { /* keep going */ }

  // 5. pinned messages per chat (from group_settings)
  let pins: Record<string, string[]> = {};
  try {
    const { data } = await sb().from("group_settings").select("key,value").like("key", "pinned_%");
    (data || []).forEach((r: any) => {
      const cid = String(r.key).replace(/^pinned_/, "");
      if (Array.isArray(r.value)) pins[cid] = r.value.filter((x: any) => typeof x === "string");
    });
  } catch { /* keep going */ }

  // 6. group rules + descriptions (D1/D12)
  let groupRules: Record<string, { text: string; updatedAt: number; updatedBy: string }> = {};
  let groupDescs: Record<string, string> = {};
  try {
    const { data } = await sb().from("group_settings").select("key,value").or("key.like.rules_%,key.like.desc_%");
    (data || []).forEach((r: any) => {
      const k = String(r.key);
      if (k.startsWith("rules_")) {
        const cid = k.replace(/^rules_/, "");
        const v = r.value;
        if (v && typeof v === "object" && !Array.isArray(v)) {
          groupRules[cid] = { text: String((v as any).text || ""), updatedAt: Number((v as any).updatedAt) || 0, updatedBy: String((v as any).updatedBy || "") };
        } else if (typeof v === "string" && v) {
          groupRules[cid] = { text: v, updatedAt: 0, updatedBy: "" };
        }
      } else if (k.startsWith("desc_")) {
        const v = r.value;
        groupDescs[k.replace(/^desc_/, "")] = typeof v === "string" ? v : String(v ?? "");
      }
    });
  } catch { /* keep going */ }

  const prev = getState();
  // E1 — apni privacy localStorage se merge karo (server columns na hon to bhi kaam kare)
  try {
    const { getPrivacy } = await import("./prefs");
    const myPr = getPrivacy(userId);
    members = members.map((m) => (m.id === userId ? { ...m, privacy: m.privacy || myPr } : m));
  } catch { /* ignore */ }
  // Phase 8 — slow mode + auto-mod settings sab chats ke liye preload
  try {
    const { preloadOwnerSettings } = await import("./owner");
    preloadOwnerSettings(allChatIds).catch(() => {});
  } catch { /* ignore */ }
  // WhatsApp-style: reload par bhi unread badges (lastRead ke baad wale dusron ke msgs)
  let unread: Record<string, number> = {};
  try {
    for (const c of chats) {
      let lastId: string | null = null;
      try { lastId = localStorage.getItem(`chatsapp:lastRead:${c.id}`); } catch { /* ignore */ }
      if (!lastId) continue; // kabhi khola hi nahi → 0
      const cms = messages.filter((m) => m.chatId === c.id && m.from !== userId && !m.deleted);
      const idx = cms.findIndex((m) => m.id === lastId);
      const n = idx === -1 ? 0 : cms.length - idx - 1;
      if (n > 0) unread[c.id] = n;
    }
  } catch { /* ignore */ }
  update({
    me: userId,
    session: true,
    loading: false,
    members,
    messages,
    chats,
    pins,
    unread,
    groupRules,
    groupDescs,
    starred: getStarred(),
    ui: { ...prev.ui, activeChatId: prev.ui.activeChatId || MAIN_GROUP_ID || chats[0]?.id || null },
  });
  return true;
}

// ───────── E1 — privacy server sync (best-effort; columns na hon to local hi) ─────────
export async function savePrivacyServer(userId: string, pr: { lastSeen: string; photo: string; about: string; online: string }) {
  try {
    await sb().from("profiles").update({
      privacy_lastseen: pr.lastSeen,
      privacy_photo: pr.photo,
      privacy_about: pr.about,
      privacy_online: pr.online,
    }).eq("id", userId);
  } catch { /* columns may not exist — localStorage is source of truth */ }
  // apne member object me foran reflect karo
  try {
    update({ members: getState().members.map((m) => (m.id === userId ? { ...m, privacy: { ...pr } as any } : m)) });
  } catch { /* ignore */ }
}

// ───────── writes ─────────
/* ───────── 19 — lazy load purane messages (upar scroll par) ───────── */
export async function loadOlderMessages(chatId: string, before: number, limit = 60): Promise<boolean> {
  try {
    const { data } = await sb()
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .lt("created_at", new Date(before).toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!data || data.length === 0) return false;
    const older = data.map(toMessage).reverse();
    const s = getState();
    const ids = new Set(s.messages.map((m) => m.id));
    const fresh = older.filter((m) => !ids.has(m.id));
    if (fresh.length > 0) update({ messages: [...fresh, ...s.messages] });
    return data.length >= limit; // aur hain ya nahi
  } catch { return false; }
}

/* ───────── 13 — pull-to-refresh: taaza messages lao ───────── */
export async function refreshChat(chatId: string): Promise<void> {
  try {
    const { data } = await sb()
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data) return;
    const fresh = data.map(toMessage).reverse();
    const freshIds = new Set(fresh.map((m) => m.id));
    const s = getState();
    // dusre chats untouched + is chat ke purane (jo fresh me nahi) + taaza
    const kept = s.messages.filter((m) => m.chatId !== chatId || !freshIds.has(m.id));
    update({ messages: [...kept, ...fresh] });
  } catch { /* ignore */ }
}

export async function sendText(chatId: string, text: string, replyTo?: string): Promise<Message | null> {
  const s = getState();
  if (!text.trim() || !chatId) return null;
  // Phase 8 — slow mode + auto-mod (owner.ts se, lazy import taake circular na ho)
  try {
    const ow = await import("./owner");
    const slowSec = ow.getCachedSlowMode(chatId);
    if (slowSec > 0) {
      const wait = ow.checkSlowMode(chatId, s.me, slowSec);
      if (wait > 0) { toast(`Slow mode 🐢`, `${wait}s ruko phir bhejo`); return null; }
    }
    const bw = ow.getCachedBadWords(chatId);
    if (bw.words.length > 0) {
      const hit = ow.findBadWord(text, bw.words);
      if (hit) {
        const me = s.members.find((m) => m.id === s.me);
        const staff = me && (me.role === "owner" || me.role === "admin" || me.role === "mod");
        if (!staff) {
          if (bw.action === "warn" || bw.action === "both") {
            addWarn(s.me, `Banned lafz: "${hit}"`).catch(() => {});
            toast("⚠️ Warning", `Mana lafz istemal kiya: "${hit}"`);
          }
          if (bw.action === "delete" || bw.action === "both") {
            toast("Message delete hua 🚫", "Banned lafz tha");
            return null;
          }
        }
      }
    }
  } catch { /* owner.ts fail ho to normal bhejo */ }
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "text", text: text.trim(), at: Date.now(), reactions: {}, replyTo };
  update({ messages: [...s.messages, m] });
  try {
    await sb().from("messages").insert({
      id: m.id, chat_id: chatId, sender_id: m.from, type: "text",
      text: m.text, media_url: "", reply_to: replyTo || null,
      created_at: m.at, read_by: [],
    });
  } catch {
    toast("Message nahi gaya", "Internet check karo");
  }
  checkMessageBadges();
  // Phase 7 — apna jawab bhi paheli se milao
  setTimeout(() => checkRiddleAnswer(chatId, m.text, m.from).catch(() => {}), 300);
  return m;
}

export async function sendMedia(chatId: string, file: File, kind: "image" | "voice", dur?: number): Promise<Message | null> {
  const s = getState();
  if (!chatId) return null;
  // store as data URL (simple, works with media_url text column)
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const m: Message = { id: uid("m"), from: s.me, chatId, type: kind, text: "", at: Date.now(), reactions: {}, src: dataUrl, dur };
  update({ messages: [...s.messages, m] });
  try {
    await sb().from("messages").insert({
      id: m.id, chat_id: chatId, sender_id: m.from, type: kind,
      text: "", media_url: dataUrl, reply_to: null, created_at: m.at, read_by: [],
    });
  } catch {
    toast("Media nahi gaya", "Internet check karo");
  }
  checkMessageBadges();
  return m;
}

export async function deleteMessage(id: string) {
  update({ messages: getState().messages.map((m) => (m.id === id ? { ...m, deleted: true, text: "", src: undefined } : m)) });
  try {
    await sb().from("messages").update({ is_deleted: true, text: "" }).eq("id", id);
  } catch { /* ignore */ }
}

/* ───────── Phase 6 — F6 badges: message-count based ───────── */
function checkMessageBadges() {
  try {
    const s = getState();
    const mine = s.messages.filter((m) => m.from === s.me && !m.deleted).length;
    if (mine >= 1) unlockBadge("pehla-salam");
    if (mine >= 100) unlockBadge("mehfil");
  } catch { /* ignore */ }
}

// B16 — edit own text message (15 min window enforced by caller)
export async function editMessage(msgId: string, text: string) {
  const t = text.trim();
  if (!t) return;
  update({ messages: getState().messages.map((m) => (m.id === msgId ? { ...m, text: t, edited: true } : m)) });
  patchUI({ editingMsg: null });
  try {
    await sb().from("messages").update({ text: t, edited: true }).eq("id", msgId);
  } catch {
    // edited column may not exist — text-only fallback
    try { await sb().from("messages").update({ text: t }).eq("id", msgId); } catch { /* ignore */ }
  }
}

// A9/A11/A17 — mark others' messages in this chat as read (best-effort)
export function markRead(chatId: string) {
  try {
    if (!chatId || typeof document === "undefined" || document.hidden) return;
    const s = getState();
    const me = s.me;
    if (!me) return;
    const unread = s.messages.filter(
      (m) => m.chatId === chatId && m.from !== me && !m.deleted && !(m.readBy || []).includes(me)
    );
    if (unread.length > 0) {
      update({
        messages: s.messages.map((m) =>
          m.chatId === chatId && m.from !== me && !m.deleted && !(m.readBy || []).includes(me)
            ? { ...m, readBy: [...(m.readBy || []), me] }
            : m
        ),
      });
      // server sync — latest 30, fire and forget (RLS may block; local still works)
      unread.slice(-30).forEach((m) => {
        const arr = [...(m.readBy || []).filter((x) => x !== me), me];
        sb().from("messages").update({ read_by: arr }).eq("id", m.id).then(() => {}, () => {});
      });
    }
    // remember last-read position per chat
    const last = [...s.messages].reverse().find((m) => m.chatId === chatId && !m.deleted);
    if (last) {
      try { localStorage.setItem(`chatsapp:lastRead:${chatId}`, last.id); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

export async function toggleReaction(msgId: string, emoji: string) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const users = m.reactions[emoji] || [];
  const has = users.includes(s.me);
  const next = { ...m.reactions, [emoji]: has ? users.filter((u) => u !== s.me) : [...users, s.me] };
  if (next[emoji].length === 0) delete next[emoji];
  update({ messages: s.messages.map((x) => (x.id === msgId ? { ...x, reactions: next } : m)) });
  try {
    await sb().from("messages").update({ reactions: next }).eq("id", msgId);
  } catch { /* column may not exist — local still works */ }
}

// ───────── moderation (owner) ─────────
export async function setMute(userId: string, until: number | null | undefined) {
  try {
    if (until === undefined) await sb().from("mutes").delete().eq("chat_id", MAIN_GROUP_ID).eq("user_id", userId);
    else await sb().from("mutes").upsert({ chat_id: MAIN_GROUP_ID, user_id: userId, until: until === null ? 0 : until });
  } catch { /* ignore */ }
  update({ members: getState().members.map((m) => (m.id === userId ? { ...m, mutedUntil: until } : m)) });
  try { const { logAudit } = await import("./owner"); await logAudit(until === undefined ? "unmute" : "mute", userId, until === null ? "hamesha" : until === undefined ? "unmute" : new Date(until).toLocaleString()); } catch { /* ignore */ }
}
export async function setBan(userId: string, banned: boolean, reason = "") {
  try {
    if (banned) await sb().from("bans").upsert({ chat_id: MAIN_GROUP_ID, user_id: userId, reason });
    else await sb().from("bans").delete().eq("chat_id", MAIN_GROUP_ID).eq("user_id", userId);
  } catch { /* ignore */ }
  update({ members: getState().members.map((m) => (m.id === userId ? { ...m, banned } : m)) });
  try { const { logAudit } = await import("./owner"); await logAudit(banned ? "ban" : "unban", userId, reason || (banned ? "ban" : "unban")); } catch { /* ignore */ }
}
export async function addWarn(userId: string, reason: string) {
  try {
    const { data } = await sb().from("warns").select("count").eq("chat_id", MAIN_GROUP_ID).eq("user_id", userId).single();
    const c = (data?.count || 0) + 1;
    await sb().from("warns").upsert({ chat_id: MAIN_GROUP_ID, user_id: userId, count: c, reason });
  } catch { /* ignore */ }
  const ms = getState().members.map((m) => (m.id === userId ? { ...m, warns: [...m.warns, { reason, at: Date.now() }] } : m));
  update({ members: ms });
  try { const { logAudit } = await import("./owner"); await logAudit("warn", userId, reason); } catch { /* ignore */ }
  const target = ms.find((m) => m.id === userId);
  if (target && target.warns.length >= 3) await setMute(userId, Date.now() + 3600e3);
}
export async function setRole(userId: string, role: Role) {
  const prev = getState().members.find((m) => m.id === userId)?.role;
  try {
    await sb().from("user_roles").upsert({ user_id: userId, role });
  } catch { /* ignore */ }
  update({ members: getState().members.map((m) => (m.id === userId ? { ...m, role } : m)) });
  try { const { logAudit } = await import("./owner"); await logAudit("role", userId, `${prev || "?"} → ${role}`); } catch { /* ignore */ }
}
export async function postAnnouncement(text: string) {  const s = getState();
  if (!MAIN_GROUP_ID || !text.trim()) return;
  const m: Message = { id: uid("m"), from: s.me, chatId: MAIN_GROUP_ID, type: "announcement", text: text.trim(), at: Date.now(), reactions: {} };
  update({ messages: [...s.messages, m] });
  try {
    await sb().from("messages").insert({
      id: m.id, chat_id: MAIN_GROUP_ID, sender_id: m.from, type: "announcement",
      text: m.text, media_url: "", reply_to: null, created_at: m.at, read_by: [],
    });
  } catch { /* ignore */ }
}

// ───────── B5 polls ─────────
// Poll definition (question + options + endsAt) lives in the message `caption` column as JSON.
// Votes live in the message `reactions` jsonb under special keys "__poll_<idx>" -> userIds.
// This needs NO new tables and syncs live through the existing UPDATE realtime handler.
export interface PollData { q: string; opts: string[]; endsAt: number }
export function parsePoll(caption?: string): PollData | null {
  try {
    const d = JSON.parse(caption || "");
    if (d && typeof d.q === "string" && Array.isArray(d.opts) && d.opts.length >= 2) return d;
  } catch { /* ignore */ }
  return null;
}
export async function sendPoll(chatId: string, q: string, opts: string[], endsAt: number): Promise<Message | null> {
  const s = getState();
  if (!chatId || !q.trim() || opts.filter((o) => o.trim()).length < 2) return null;
  const poll: PollData = { q: q.trim(), opts: opts.map((o) => o.trim()).filter(Boolean).slice(0, 5), endsAt };
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "poll", text: poll.q, at: Date.now(), reactions: {}, caption: JSON.stringify(poll) };
  update({ messages: [...s.messages, m] });
  try {
    await sb().from("messages").insert({
      id: m.id, chat_id: chatId, sender_id: m.from, type: "poll",
      text: m.text, media_url: "", caption: m.caption, reply_to: null, created_at: m.at, read_by: [],
    });
  } catch {
    toast("Poll nahi gaya", "Internet check karo");
  }
  return m;
}
export async function votePoll(msgId: string, idx: number) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const poll = parsePoll(m.caption);
  if (!poll || poll.endsAt < Date.now()) return;
  const next = { ...m.reactions };
  // single-choice: remove own id from all poll keys, then add to chosen
  for (const k of Object.keys(next)) {
    if (k.startsWith("__poll_")) {
      const rest = (next[k] as string[]).filter((u) => u !== s.me);
      if (rest.length === 0) delete next[k]; else next[k] = rest;
    }
  }
  const key = `__poll_${idx}`;
  const cur = (next[key] as string[]) || [];
  if (!cur.includes(s.me)) next[key] = [...cur, s.me];
  update({ messages: s.messages.map((x) => (x.id === msgId ? { ...x, reactions: next } : x)) });
  try {
    await sb().from("messages").update({ reactions: next }).eq("id", msgId);
  } catch { /* ignore — local still works */ }
}
export function pollVotes(m: Message): { counts: number[]; total: number; mine: number } {
  const poll = parsePoll(m.caption);
  const n = poll ? poll.opts.length : 0;
  const counts = new Array(n).fill(0);
  let mine = -1;
  const me = getState().me;
  for (let i = 0; i < n; i++) {
    const users = (m.reactions[`__poll_${i}`] as string[]) || [];
    counts[i] = users.length;
    if (users.includes(me)) mine = i;
  }
  return { counts, total: counts.reduce((a, b) => a + b, 0), mine };
}

// ───────── B6 location share ─────────
export async function sendLocation(chatId: string, lat: number, lng: number): Promise<Message | null> {
  const s = getState();
  if (!chatId) return null;
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "location", text: "", at: Date.now(), reactions: {}, caption: JSON.stringify({ lat, lng }) };
  update({ messages: [...s.messages, m] });
  try {
    await sb().from("messages").insert({
      id: m.id, chat_id: chatId, sender_id: m.from, type: "location",
      text: "", media_url: "", caption: m.caption, reply_to: null, created_at: m.at, read_by: [],
    });
  } catch {
    toast("Location nahi gayi", "Internet check karo");
  }
  return m;
}

// ───────── B7 contact share ─────────
export async function sendContact(chatId: string, name: string, phone: string): Promise<Message | null> {
  const s = getState();
  if (!chatId || !name.trim()) return null;
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "contact", text: "", at: Date.now(), reactions: {}, caption: JSON.stringify({ name: name.trim(), phone: phone.trim() }) };
  update({ messages: [...s.messages, m] });
  try {
    await sb().from("messages").insert({
      id: m.id, chat_id: chatId, sender_id: m.from, type: "contact",
      text: "", media_url: "", caption: m.caption, reply_to: null, created_at: m.at, read_by: [],
    });
  } catch {
    toast("Contact nahi gaya", "Internet check karo");
  }
  return m;
}

// ───────── B13 starred messages ─────────
// Primary store: localStorage (reliable). Best-effort sync to Supabase user_chat_settings if the table/shape allows.
const STAR_KEY = "chatsapp:starred";
export function getStarred(): string[] {
  try {
    const raw = localStorage.getItem(STAR_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}
async function syncStarred(ids: string[]) {
  try {
    const me = getState().me;
    if (!me) return;
    await sb().from("user_chat_settings").upsert({ user_id: me, settings: { starred: ids } }, { onConflict: "user_id" });
  } catch { /* table/shape may differ — localStorage is the source of truth */ }
}
export function isStarred(msgId: string): boolean {
  return getState().starred.includes(msgId);
}
export function toggleStar(msgId: string): boolean {
  const cur = getState().starred;
  const starred = cur.includes(msgId);
  const next = starred ? cur.filter((x) => x !== msgId) : [...cur, msgId];
  try { localStorage.setItem(STAR_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  update({ starred: next });
  syncStarred(next);
  return !starred;
}
// called once during load() to hydrate from localStorage
export function hydrateStarred() {
  update({ starred: getStarred() });
}

// ───────── pins (stored in group_settings as pinned_<chatId> → string[]) ─────────
export async function getPins(chatId: string): Promise<string[]> {
  try {
    const { data } = await sb().from("group_settings").select("value").eq("key", `pinned_${chatId}`).single();
    const v = data?.value;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}
export async function togglePin(chatId: string, msgId: string): Promise<string[]> {
  const s = getState();
  const cur = s.pins[chatId] || [];
  const next = cur.includes(msgId) ? cur.filter((x) => x !== msgId) : [...cur, msgId];
  update({ pins: { ...s.pins, [chatId]: next } });
  try {
    await sb().from("group_settings").upsert({ key: `pinned_${chatId}`, value: next });
  } catch { /* ignore — local still works */ }
  return next;
}

// ───────── D1/D12 group meta (group_settings: desc_<chatId>, rules_<chatId>) ─────────
export async function setGroupSetting(key: string, value: any) {
  try { await sb().from("group_settings").upsert({ key, value }); } catch { /* ignore */ }
}
export interface GroupRules { text: string; updatedAt: number; updatedBy: string }
export async function setGroupDesc(chatId: string, desc: string) {
  update({ groupDescs: { ...getState().groupDescs, [chatId]: desc } });
  await setGroupSetting(`desc_${chatId}`, desc);
}
export async function setGroupRules(chatId: string, text: string) {
  const r: GroupRules = { text, updatedAt: Date.now(), updatedBy: getState().me };
  update({ groupRules: { ...getState().groupRules, [chatId]: r } });
  await setGroupSetting(`rules_${chatId}`, r);
}
export async function setGroupPhoto(chatId: string, dataUrl: string) {
  update({ chats: getState().chats.map((c) => (c.id === chatId ? { ...c, photo: dataUrl } : c)) });
  try {
    await sb().from("chats").update({ photo_url: dataUrl }).eq("id", chatId);
  } catch {
    toast("Photo save nahi hui", "Dobara koshish karo");
  }
}

/* ───────── Phase 6 — F9 auto welcome message ───────── */
export async function getWelcomeEnabled(chatId: string): Promise<boolean> {
  try {
    const { data } = await sb().from("group_settings").select("value").eq("key", `welcome_${chatId}`).single();
    // default ON (pehli dafa key nahi hogi → welcome bhejo)
    if (!data) return true;
    return data.value !== false && data.value?.on !== false;
  } catch { return true; }
}
export async function setWelcomeEnabled(chatId: string, on: boolean) {
  await setGroupSetting(`welcome_${chatId}`, { on });
}
/** Naye member ke liye welcome bhejo — claim flag se duplicate roko. Sirf staff call kare. */
export async function maybeWelcomeMember(chatId: string, newUserId: string, newUserName: string) {
  try {
    const me = getState().me;
    if (!me || newUserId === me) return;
    if (!(await getWelcomeEnabled(chatId))) return;
    // distributed claim: pehle flag insert karo — duplicate key par fail = koi aur bhej chuka
    const flagKey = `welcomed_${chatId}_${newUserId}`;
    const { error } = await sb().from("group_settings").insert({ key: flagKey, value: { by: me, at: Date.now() } });
    if (error) return; // kisi aur ne claim kar liya
    const s = getState();
    const m: Message = {
      id: uid("m"), from: me, chatId, type: "text",
      text: `Assalam-o-Alaikum ${newUserName}! 🌙 Madrasa Group me khush amdeed!`,
      at: Date.now(), reactions: {},
    };
    update({ messages: [...s.messages, m] });
    await sb().from("messages").insert({
      id: m.id, chat_id: chatId, sender_id: me, type: "text",
      text: m.text, media_url: "", reply_to: null, created_at: m.at, read_by: [],
    });
  } catch { /* ignore */ }
}

// ───────── D11 group insights — REAL data only, Supabase se count ─────────
export interface GroupInsights {
  perDay: { label: string; count: number; key: string }[];
  perHour: number[]; // 24 buckets
  top: { id: string; count: number }[];
  total: number;
  media: number;
}
export async function getGroupInsights(chatId: string): Promise<GroupInsights | null> {
  try {
    const weekAgo = Date.now() - 7 * 86400e3;
    const { data, error } = await sb().from("messages")
      .select("sender_id,created_at,type")
      .eq("chat_id", chatId)
      .gte("created_at", weekAgo)
      .limit(5000);
    if (error) return null;
    const rows = (data || []) as any[];
    const days: { label: string; count: number; key: string }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const label = i === 0 ? "Aaj" : i === 1 ? "Kal" : d.toLocaleDateString("ur-Latn", { weekday: "short" });
      days.push({ label, count: 0, key });
    }
    const perHour = new Array(24).fill(0);
    const bySender = new Map<string, number>();
    let media = 0;
    for (const r of rows) {
      const at = Number(r.created_at) || 0;
      const d = new Date(at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const day = days.find((x) => x.key === key);
      if (day) day.count++;
      perHour[d.getHours()]++;
      bySender.set(r.sender_id, (bySender.get(r.sender_id) || 0) + 1);
      if (r.type === "image" || r.type === "voice") media++;
    }
    const top = [...bySender.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { perDay: days, perHour, top, total: rows.length, media };
  } catch { return null; }
}
export async function getChatCounts(chatId: string): Promise<{ messages: number; media: number }> {
  try {
    const [{ count: messages }, { count: media }] = await Promise.all([
      sb().from("messages").select("id", { count: "exact", head: true }).eq("chat_id", chatId),
      sb().from("messages").select("id", { count: "exact", head: true }).eq("chat_id", chatId).in("type", ["image", "voice"]),
    ]);
    return { messages: messages || 0, media: media || 0 };
  } catch { return { messages: 0, media: 0 }; }
}

// ───────── presence ─────────
export function touchPresence(online: boolean) {
  try {
    const me = getState().me;
    if (me) sb().from("profiles").update({ online, last_seen: Date.now() }).eq("id", me).then(() => {}, () => {});
  } catch { /* ignore */ }
}

// ───────── realtime ─────────
export function startRealtime() {
  const ch = sb().channel("chatsapp-room", { config: { presence: { key: getState().me } } });

  // NO chat_id filter — DMs must arrive too
  ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (p: any) => {
    const s = getState();
    if (p.new.sender_id === s.me) return;
    if (s.messages.some((x) => x.id === p.new.id)) return;
    const sender = s.members.find((x) => x.id === p.new.sender_id);
    if (sender?.banned) return;
    const m = toMessage(p.new);
    update((st) => {
      let chats = st.chats;
      if (m.chatId && !chats.some((c) => c.id === m.chatId)) {
        const other = st.members.find((x) => x.id === m.from && x.id !== st.me);
        chats = [...chats, { id: m.chatId, type: "dm", name: other?.name || "Chat", photo: other?.avatar || "", otherId: other?.id, lastAt: m.at }];
      } else {
        chats = chats.map((c) => (c.id === m.chatId ? { ...c, lastAt: m.at } : c));
      }
      // WhatsApp-style unread: jo chat khuli nahi, uska count barhao (khud ke msg pehle hi filtered)
      let unread = st.unread;
      const activeId = st.ui.activeChatId || st.chats[0]?.id;
      if (m.chatId && m.chatId !== activeId && !m.deleted) {
        unread = { ...unread, [m.chatId]: (unread[m.chatId] || 0) + 1 };
      }
      return { messages: [...st.messages, m], chats, unread };
    });
    // 1 — notification sound: sirf tab inactive ho ya dusri chat khuli ho to baje 🔊
    try {
      const { playPop } = await import("./sound");
      const { getSound, isChatMuted } = await import("./prefs");
      const s2 = getState();
      const activeId2 = s2.ui.activeChatId || s2.chats[0]?.id;
      const tabHidden = typeof document !== "undefined" && document.hidden;
      if (getSound() && m.chatId && !isChatMuted(m.chatId) && (tabHidden || m.chatId !== activeId2)) {
        playPop();
      }
    } catch { /* ignore */ }
    // Phase 7 — paheli ka jawab check karo
    if (m.type === "text" && m.text) {
      setTimeout(() => checkRiddleAnswer(m.chatId, m.text, m.from).catch(() => {}), 300);
    }
  });
  ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p: any) => {
    const m = toMessage(p.new);
    update((st) => ({ messages: st.messages.map((x) => (x.id === m.id ? { ...m } : x)) }));
  });
  ch.on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (p: any) => {
    update((st) => ({
      members: st.members.map((x) =>
        x.id === p.new.id
          ? { ...x, online: !!p.new.online, lastSeen: p.new.last_seen || x.lastSeen, name: p.new.display_name || x.name, avatar: p.new.photo_url || x.avatar, about: p.new.about ?? x.about }
          : x
      ),
    }));
  });
  // Phase 6 — F9: naya member join kare to auto welcome (sirf staff bhejega)
  ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, (p: any) => {
    try {
      const st = getState();
      const meM = st.members.find((x) => x.id === st.me);
      const staff = meM && (meM.role === "owner" || meM.role === "admin" || meM.role === "mod");
      if (!staff || !MAIN_GROUP_ID) return;
      const nm = p.new?.display_name || "Dost";
      // thodi delay taake profile poori tarah ban jaye, phir welcome
      setTimeout(() => { maybeWelcomeMember(MAIN_GROUP_ID, p.new.id, nm); }, 4000);
    } catch { /* ignore */ }
  });
  const refreshMod = () => {
    // light moderation refresh
    (async () => {
      try {
        if (!MAIN_GROUP_ID) return;
        const [{ data: mutes }, { data: bans }, { data: warns }] = await Promise.all([
          sb().from("mutes").select("*").eq("chat_id", MAIN_GROUP_ID),
          sb().from("bans").select("*").eq("chat_id", MAIN_GROUP_ID),
          sb().from("warns").select("*").eq("chat_id", MAIN_GROUP_ID),
        ]);
        update((st) => ({
          members: st.members.map((x) => ({
            ...x,
            banned: !!(bans || []).find((b: any) => b.user_id === x.id),
            mutedUntil: (() => { const mu = (mutes || []).find((mm: any) => mm.user_id === x.id); return mu ? (mu.until === 0 ? null : mu.until) : undefined; })(),
            warns: (warns || []).filter((w: any) => w.user_id === x.id).map((w: any) => ({ reason: w.reason || "Warning", at: 0 })),
          })),
        }));
      } catch { /* ignore */ }
    })();
  };
  ch.on("postgres_changes", { event: "*", schema: "public", table: "mutes", filter: `chat_id=eq.${MAIN_GROUP_ID}` }, refreshMod);
  ch.on("postgres_changes", { event: "*", schema: "public", table: "bans", filter: `chat_id=eq.${MAIN_GROUP_ID}` }, refreshMod);
  ch.on("postgres_changes", { event: "*", schema: "public", table: "warns", filter: `chat_id=eq.${MAIN_GROUP_ID}` }, refreshMod);

  ch.on("postgres_changes", { event: "*", schema: "public", table: "group_settings" }, (p: any) => {
    const key = p.new?.key || p.old?.key || "";
    if (typeof key === "string" && key.startsWith("pinned_")) {
      const cid = key.replace(/^pinned_/, "");
      const v = p.new?.value;
      const ids = Array.isArray(v) ? v.filter((x: any) => typeof x === "string") : [];
      update((st) => ({ pins: { ...st.pins, [cid]: ids } }));
    } else if (typeof key === "string" && key.startsWith("rules_")) {
      // D12 — rules realtime
      const cid = key.replace(/^rules_/, "");
      const v = p.new?.value;
      const r = v && typeof v === "object" && !Array.isArray(v)
        ? { text: String((v as any).text || ""), updatedAt: Number((v as any).updatedAt) || 0, updatedBy: String((v as any).updatedBy || "") }
        : { text: typeof v === "string" ? v : "", updatedAt: Date.now(), updatedBy: "" };
      update((st) => ({ groupRules: { ...st.groupRules, [cid]: r } }));
    } else if (typeof key === "string" && key.startsWith("desc_")) {
      // D1 — description realtime
      const cid = key.replace(/^desc_/, "");
      const v = p.new?.value;
      update((st) => ({ groupDescs: { ...st.groupDescs, [cid]: typeof v === "string" ? v : String(v ?? "") } }));
    } else if (typeof key === "string" && key.startsWith("slowmode_")) {
      // Phase 8 — slow mode realtime (sab users ke local cache me)
      const cid = key.replace(/^slowmode_/, "");
      try { localStorage.setItem(`chatsapp:slowmode:${cid}`, String(Number(p.new?.value) || 0)); } catch { /* ignore */ }
      if (Number(p.new?.value) > 0) toast("Slow mode 🐢", `Har ${p.new.value}s me 1 message`);
    } else if (typeof key === "string" && key.startsWith("badwords_")) {
      // Phase 8 — auto-mod realtime
      const cid = key.replace(/^badwords_/, "");
      try { if (p.new?.value) localStorage.setItem(`chatsapp:badwords:${cid}`, JSON.stringify(p.new.value)); } catch { /* ignore */ }
    }
  });

  ch.on("presence", { event: "sync" }, () => {
    const ids = Object.keys(ch.presenceState());
    update((st) => ({ members: st.members.map((x) => (ids.includes(x.id) ? { ...x, online: true } : x)) }));
  });
  ch.on("broadcast", { event: "typing" }, (p: any) => {
    const uidv = p.payload?.userId;
    const s = getState();
    if (uidv && uidv !== s.me && !s.ui.typing.includes(uidv)) {
      patchUI({ typing: [...s.ui.typing, uidv] });
      setTimeout(() => patchUI({ typing: getState().ui.typing.filter((t) => t !== uidv) }), 3500);
    }
  });

  ch.subscribe(async (status: string) => {
    if (status === "SUBSCRIBED") {
      await ch.track({ online_at: Date.now() });
      touchPresence(true);
    }
  });

  let typingTimer: any = null;
  const sendTyping = () => {
    if (typingTimer) return;
    try { ch.send({ type: "broadcast", event: "typing", payload: { userId: getState().me } }); } catch { /* ignore */ }
    typingTimer = setTimeout(() => { typingTimer = null; }, 3000);
  };

  window.addEventListener("beforeunload", () => touchPresence(false));
  return { stop: () => { touchPresence(false); try { sb().removeChannel(ch); } catch { /* ignore */ } }, sendTyping };
}

export { uid };

// ───────── Phase 7 — Games & Fun ─────────
import { pickQuizQuestions, parseQuiz, quizAnswered, quizScores, parseTTT, tttWinner, dailyRiddle, parseRiddle, isRiddleAnswer, normAnswer } from "./games";

/** I1 — Deen Quiz shuru karo (5 sawal, har sawal 15 sec) */
export async function sendQuiz(chatId: string): Promise<Message | null> {
  const s = getState();
  if (!chatId) return null;
  // ek waqt me ek hi active quiz
  const active = s.messages.find((m) => m.chatId === chatId && m.type === "quiz" && !m.deleted && !parseQuiz(m.caption)?.done);
  if (active) { toast("Quiz pehle se chal raha hai", "Khatam hone ka intezar karo"); return null; }
  const questions = pickQuizQuestions();
  const state = { questions, current: 0, qEndsAt: Date.now() + 15000, done: false };
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "quiz", text: "🧠 Deen Quiz!", at: Date.now(), reactions: {}, caption: JSON.stringify(state) };
  update({ messages: [...s.messages, m] });
  try {
    await sb().from("messages").insert({
      id: m.id, chat_id: chatId, sender_id: m.from, type: "quiz",
      text: m.text, media_url: "", caption: m.caption, reply_to: null, created_at: m.at, read_by: [],
    });
  } catch { toast("Quiz nahi gaya", "Internet check karo"); }
  return m;
}
/** Quiz ka jawab do — ek sawal par ek hi jawab (badal sakte ho timer tak) */
export async function answerQuiz(msgId: string, qIdx: number, optIdx: number) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st = parseQuiz(m.caption);
  if (!st || st.done || st.current !== qIdx || Date.now() > st.qEndsAt) return;
  const next = { ...m.reactions };
  for (let o = 0; o < 4; o++) {
    const k = `__quiz_${qIdx}_${o}`;
    const rest = ((next[k] as string[]) || []).filter((u) => u !== s.me);
    if (rest.length === 0) delete next[k]; else next[k] = rest;
  }
  const key = `__quiz_${qIdx}_${optIdx}`;
  next[key] = [...((next[key] as string[]) || []), s.me];
  update({ messages: s.messages.map((x) => (x.id === msgId ? { ...x, reactions: next } : x)) });
  try { await sb().from("messages").update({ reactions: next }).eq("id", msgId); } catch { /* ignore */ }
}
/** Agle sawal par jao (timer khatam par starter ka client chalata hai) */
export async function advanceQuiz(msgId: string) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st = parseQuiz(m.caption);
  if (!st || st.done) return;
  const nextIdx = st.current + 1;
  const done = nextIdx >= st.questions.length;
  const nextState = { ...st, current: nextIdx, qEndsAt: Date.now() + 15000, done };
  const caption = JSON.stringify(nextState);
  update({ messages: s.messages.map((x) => (x.id === msgId ? { ...x, caption } : x)) });
  try { await sb().from("messages").update({ caption }).eq("id", msgId); } catch { /* ignore */ }
  if (done) {
    // winner announce
    const scores = quizScores(m.reactions, st.questions);
    if (scores.length > 0) {
      const top = scores[0];
      const name = s.members.find((x) => x.id === top.id)?.name || "Koi";
      postSystem(chatId_of(m), `🏆 Quiz khatam! Winner: ${name} (${top.pts} points)`);
    } else {
      postSystem(chatId_of(m), "🏆 Quiz khatam! Kisi ne jawab nahi diya 😅");
    }
  }
}
function chatId_of(m: Message): string { return m.chatId; }
/** system message bhejo (winner announcements waghera) */
export async function postSystem(chatId: string, text: string) {
  const s = getState();
  if (!chatId || !text.trim()) return;
  const m: Message = { id: uid("m"), from: "system", chatId, type: "system", text: text.trim(), at: Date.now(), reactions: {} };
  update({ messages: [...s.messages, m] });
  try {
    await sb().from("messages").insert({
      id: m.id, chat_id: chatId, sender_id: s.me, type: "system",
      text: m.text, media_url: "", reply_to: null, created_at: m.at, read_by: [],
    });
  } catch { /* ignore */ }
}

/** I2 — TicTacToe challenge bhejo */
export async function sendTicTacToe(chatId: string, opponentId: string): Promise<Message | null> {
  const s = getState();
  if (!chatId || !opponentId || opponentId === s.me) return null;
  const state = {
    challenger: s.me, opponent: opponentId, accepted: false,
    board: Array(9).fill(""), turn: s.me, winner: null,
  };
  const oppName = s.members.find((x) => x.id === opponentId)?.name || "member";
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "tictactoe", text: `⭕❌ TicTacToe challenge: ${oppName}`, at: Date.now(), reactions: {}, caption: JSON.stringify(state) };
  update({ messages: [...s.messages, m] });
  try {
    await sb().from("messages").insert({
      id: m.id, chat_id: chatId, sender_id: m.from, type: "tictactoe",
      text: m.text, media_url: "", caption: m.caption, reply_to: null, created_at: m.at, read_by: [],
    });
  } catch { toast("Challenge nahi gaya", "Internet check karo"); }
  return m;
}
export async function acceptTicTacToe(msgId: string) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st = parseTTT(m.caption);
  if (!st || st.accepted || st.opponent !== s.me) return;
  // challenger = X, opponent = O; challenger pehle khelega
  const next = { ...st, accepted: true, turn: st.challenger };
  const caption = JSON.stringify(next);
  update({ messages: s.messages.map((x) => (x.id === msgId ? { ...x, caption } : x)) });
  try { await sb().from("messages").update({ caption }).eq("id", msgId); } catch { /* ignore */ }
}
export async function tttMove(msgId: string, cell: number) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st = parseTTT(m.caption);
  if (!st || !st.accepted || st.winner || st.turn !== s.me) return;
  if (cell < 0 || cell > 8 || st.board[cell]) return;
  const mark = s.me === st.challenger ? "X" : "O";
  const board = [...st.board];
  board[cell] = mark;
  const winMark = tttWinner(board);
  let winner: string | null = null;
  if (winMark === "X") winner = st.challenger;
  else if (winMark === "O") winner = st.opponent;
  else if (winMark === "draw") winner = "draw";
  const nextTurn = winner ? st.turn : (st.turn === st.challenger ? st.opponent : st.challenger);
  const next = { ...st, board, turn: nextTurn, winner };
  const caption = JSON.stringify(next);
  update({ messages: s.messages.map((x) => (x.id === msgId ? { ...x, caption } : x)) });
  try { await sb().from("messages").update({ caption }).eq("id", msgId); } catch { /* ignore */ }
  if (winner) {
    const wname = winner === "draw" ? null : s.members.find((x) => x.id === winner)?.name || "Koi";
    postSystem(m.chatId, winner === "draw" ? "⭕❌ TicTacToe draw ho gaya! Rematch? 🔄" : `⭕❌ ${wname} jeet gaya! 🎉`);
  }
}

/** I3 — Daily Paheli bhejo */
export async function sendRiddle(chatId: string): Promise<Message | null> {
  const s = getState();
  if (!chatId) return null;
  const today = new Date().toISOString().slice(0, 10);
  const active = s.messages.find((m) => m.chatId === chatId && m.type === "riddle" && !m.deleted && !parseRiddle(m.caption)?.solved);
  if (active) { toast("Paheli pehle se chal rahi hai", "Pehle iska jawab do!"); return null; }
  const { riddle } = dailyRiddle();
  const state = { q: riddle.q, a: riddle.a, alt: riddle.alt, day: today, solved: false, winner: null };
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "riddle", text: "🧩 Aaj ki Paheli!", at: Date.now(), reactions: {}, caption: JSON.stringify(state) };
  update({ messages: [...s.messages, m] });
  try {
    await sb().from("messages").insert({
      id: m.id, chat_id: chatId, sender_id: m.from, type: "riddle",
      text: m.text, media_url: "", caption: m.caption, reply_to: null, created_at: m.at, read_by: [],
    });
  } catch { toast("Paheli nahi gayi", "Internet check karo"); }
  return m;
}
/** kisi text message ko active paheli ke jawab se milao */
export async function checkRiddleAnswer(chatId: string, text: string, senderId: string) {
  if (senderId === "system") return;
  const s = getState();
  const r = s.messages.find((m) => m.chatId === chatId && m.type === "riddle" && !m.deleted && !parseRiddle(m.caption)?.solved);
  if (!r) return;
  const st = parseRiddle(r.caption);
  if (!st || normAnswer(text).length < 2) return;
  if (isRiddleAnswer(text, st)) {
    const next = { ...st, solved: true, winner: senderId };
    const caption = JSON.stringify(next);
    update({ messages: s.messages.map((x) => (x.id === r.id ? { ...x, caption } : x)) });
    try { await sb().from("messages").update({ caption }).eq("id", r.id); } catch { /* ignore */ }
    const name = getState().members.find((x) => x.id === senderId)?.name || "Kisi ne";
    postSystem(chatId, `🧩 Paheli solve! ${name} ne sahi jawab diya: "${st.a}" 🎉`);
  }
}

/** B10 — Sticker bhejo */
export async function sendSticker(chatId: string, stickerId: string): Promise<Message | null> {
  const s = getState();
  if (!chatId || !stickerId) return null;
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "sticker", text: stickerId, at: Date.now(), reactions: {} };
  update({ messages: [...s.messages, m] });
  try {
    await sb().from("messages").insert({
      id: m.id, chat_id: chatId, sender_id: m.from, type: "sticker",
      text: m.text, media_url: "", reply_to: null, created_at: m.at, read_by: [],
    });
  } catch { toast("Sticker nahi gaya", "Internet check karo"); }
  return m;
}
