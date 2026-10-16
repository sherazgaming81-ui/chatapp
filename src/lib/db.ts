"use client";
// ChatsApp Supabase adapter — real backend, no mocks.
// Query patterns verified against the live project.
import { supabase, MAIN_GROUP_ID, setMainGroupId, OWNER_EMAIL } from "./supabase";
import { getState, update, patchUI, toast } from "./store";
import type { ChatMeta, Member, Message, Role } from "./types";

const sb = () => supabase();
const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// ───────── row mappers ─────────
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
    const main = chatRows.find((c: any) => c.is_main_group) || chatRows.find((c: any) => c.type === "group") || chatRows[0];
    if (main?.id) {
      setMainGroupId(main.id);
      if (!myChatIds.includes(main.id)) myChatIds.push(main.id);
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

  const prev = getState();
  update({
    me: userId,
    session: true,
    loading: false,
    members,
    messages,
    chats,
    pins,
    ui: { ...prev.ui, activeChatId: prev.ui.activeChatId || MAIN_GROUP_ID || chats[0]?.id || null },
  });
  return true;
}

// ───────── writes ─────────
export async function sendText(chatId: string, text: string, replyTo?: string): Promise<Message | null> {
  const s = getState();
  if (!text.trim() || !chatId) return null;
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
  return m;
}

export async function deleteMessage(id: string) {
  update({ messages: getState().messages.map((m) => (m.id === id ? { ...m, deleted: true, text: "", src: undefined } : m)) });
  try {
    await sb().from("messages").update({ is_deleted: true, text: "" }).eq("id", id);
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
}
export async function setBan(userId: string, banned: boolean, reason = "") {
  try {
    if (banned) await sb().from("bans").upsert({ chat_id: MAIN_GROUP_ID, user_id: userId, reason });
    else await sb().from("bans").delete().eq("chat_id", MAIN_GROUP_ID).eq("user_id", userId);
  } catch { /* ignore */ }
  update({ members: getState().members.map((m) => (m.id === userId ? { ...m, banned } : m)) });
}
export async function addWarn(userId: string, reason: string) {
  try {
    const { data } = await sb().from("warns").select("count").eq("chat_id", MAIN_GROUP_ID).eq("user_id", userId).single();
    const c = (data?.count || 0) + 1;
    await sb().from("warns").upsert({ chat_id: MAIN_GROUP_ID, user_id: userId, count: c, reason });
  } catch { /* ignore */ }
  const ms = getState().members.map((m) => (m.id === userId ? { ...m, warns: [...m.warns, { reason, at: Date.now() }] } : m));
  update({ members: ms });
  const target = ms.find((m) => m.id === userId);
  if (target && target.warns.length >= 3) await setMute(userId, Date.now() + 3600e3);
}
export async function setRole(userId: string, role: Role) {
  try {
    await sb().from("user_roles").upsert({ user_id: userId, role });
  } catch { /* ignore */ }
  update({ members: getState().members.map((m) => (m.id === userId ? { ...m, role } : m)) });
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
  ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p: any) => {
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
      return { messages: [...st.messages, m], chats };
    });
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
