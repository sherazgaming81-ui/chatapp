"use client";
// ════════════════════════════════════════════════════════════════════
//  ChatsApp SUPABASE ADAPTER — real backend wiring.
//  Replaces the mock engine/seed. UI components are untouched;
//  they keep reading from the store via useStore().
// ════════════════════════════════════════════════════════════════════
import { supabase, OWNER_EMAIL, MAIN_GROUP_ID, setMainGroupId } from "@/lib/supabase";
import { getState, update, replaceState } from "./store";
import type { Member, Message, Role, State } from "./types";
import { uid } from "@/lib/util";

const sb = () => supabase();
const COLORS = ["#2ccf8a", "#4cc3ff", "#ff8a5c", "#e8bd57", "#ff6f91", "#b48cff"];

// ───────── row → Member / Message ─────────
function toMember(p: any, role: Role, mute: any, ban: any, warns: any[]): Member {
  return {
    id: p.id,
    name: p.display_name || "Member",
    about: p.about || "",
    role,
    online: !!p.online,
    lastSeen: p.last_seen || 0,
    joined: 0,
    color: COLORS[Math.abs(hash(p.id)) % COLORS.length],
    avatar: p.photo_url || undefined,
    mutedUntil: mute ? (mute.until === 0 ? null : mute.until) : undefined,
    banned: !!ban,
    warns: warns.map((w: any, i: number) => ({ id: "w" + i, reason: w.reason || "Warning", at: 0 })),
    phone: "",
    tone: "Chime",
    version: "3.0.0",
    style: { banner: "plain", effect: "none", frame: "none", nameStyle: "plain", accent: "#2ccf8a", badges: role === "owner" ? ["founder"] : [] },
  };
}
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

function toMessage(r: any): Message {
  const poll = r.poll_data as any;
  return {
    id: r.id,
    from: r.sender_id,
    type: (r.type as any) || "text",
    text: r.text || "",
    at: r.created_at || Date.now(),
    status: "read",
    replyTo: r.reply_to || undefined,
    edited: false,
    reactions: (r as any).reactions || {},
    readBy: (r.read_by || []).map((id: string) => ({ id, at: r.created_at || 0 })),
    src: r.media_url || undefined,
    poll: poll || undefined,
    deleted: !!r.is_deleted,
  };
}

// ───────── auth ─────────
export async function getSession() {
  const { data } = await sb().auth.getSession();
  return data.session;
}
export async function signInWithGoogle() {
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
  await sb().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
}
export async function signOut() {
  await sb().auth.signOut();
}
export function onAuthChange(cb: (session: any) => void) {
  const { data } = sb().auth.onAuthStateChange((_e, s) => cb(s));
  return () => data.subscription.unsubscribe();
}

// ───────── initial load (NO fake data — only real Supabase rows) ─────────
export async function loadRealData(userId: string, email: string): Promise<{ ok: boolean; isNew?: boolean }> {
  // 0. find the REAL main group chat id (never hardcode "madrasa")
  try {
    const { data: chats } = await sb().from("chats").select("id,is_main_group,type").limit(20);
    const main = chats?.find((c: any) => c.is_main_group) || chats?.find((c: any) => c.type === "group") || chats?.[0];
    if (main?.id) setMainGroupId(main.id);
  } catch { /* ignore, keep default */ }
  // 1. ensure profile
  const { data: prof } = await sb().from("profiles").select("*").eq("id", userId).single();
  let isNew = false;
  if (!prof) {
    isNew = true;
    const name = email.split("@")[0].replace(/[._-]/g, " ");
    await sb().from("profiles").insert({ id: userId, display_name: name, email, photo_url: "", about: "", online: true, last_seen: Date.now() });
    // auto-join main group
    await sb().from("chat_participants").insert({ chat_id: MAIN_GROUP_ID, user_id: userId });
    if (email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      await sb().from("user_roles").upsert({ user_id: userId, role: "owner" });
    }
  } else {
    await sb().from("profiles").update({ online: true, last_seen: Date.now() }).eq("id", userId);
  }

  // 2. load all profiles + roles + moderation
  const [{ data: profiles }, { data: roles }, { data: mutes }, { data: bans }, { data: warns }] = await Promise.all([
    sb().from("profiles").select("*"),
    sb().from("user_roles").select("*"),
    sb().from("mutes").select("*").eq("chat_id", MAIN_GROUP_ID),
    sb().from("bans").select("*").eq("chat_id", MAIN_GROUP_ID),
    sb().from("warns").select("*").eq("chat_id", MAIN_GROUP_ID),
  ]);
  const roleOf = (id: string): Role => {
    const r = (roles || []).find((x: any) => x.user_id === id)?.role;
    if (r === "owner" || r === "admin" || r === "mod") return r;
    return "member";
  };
  const members: Member[] = (profiles || []).map((p: any) =>
    toMember(
      p,
      roleOf(p.id),
      (mutes || []).find((x: any) => x.user_id === p.id),
      (bans || []).find((x: any) => x.user_id === p.id),
      (warns || []).filter((x: any) => x.user_id === p.id)
    )
  );

  // 3. load messages (latest 300)
  const { data: msgs } = await sb()
    .from("messages")
    .select("*")
    .eq("chat_id", MAIN_GROUP_ID)
    .order("created_at", { ascending: true })
    .limit(300);
  const messages: Message[] = (msgs || []).map(toMessage);

  // 4. group settings (rules, branding)
  const { data: gset } = await sb().from("group_settings").select("*");
  const gmap: Record<string, any> = {};
  (gset || []).forEach((g: any) => { gmap[g.key] = g.value; });

  // 5. populate store — keep local UI prefs from previous session
  const prev = getState();
  replaceState({
    me: userId,
    members,
    messages,
    lastRead: messages[messages.length - 1]?.id ?? "",
    owner: {
      ...prev.owner,
      rules: gmap.rules?.text || prev.owner.rules,
      branding: { ...prev.owner.branding, ...(gmap.branding || {}) },
    },
  });
  return { ok: true, isNew };
}

// ───────── writes ─────────
export async function dbInsertMessage(m: Message) {
  try {
    await sb().from("messages").insert({
      id: m.id,
      chat_id: MAIN_GROUP_ID,
      sender_id: m.from,
      type: m.type,
      text: m.text || "",
      media_url: m.src || "",
      reply_to: m.replyTo || null,
      created_at: m.at,
      read_by: [],
      poll_data: m.poll || null,
    });
  } catch { /* offline / rls — local still works */ }
}
export async function dbUpdateMessage(id: string, patch: Record<string, any>) {
  try { await sb().from("messages").update(patch).eq("id", id); } catch { /* ignore */ }
}
export async function dbDeleteMessage(id: string) {
  try { await sb().from("messages").update({ is_deleted: true, text: "" }).eq("id", id); } catch { /* ignore */ }
}
export async function dbSetMute(userId: string, until: number | null) {
  try {
    if (until === undefined) await sb().from("mutes").delete().eq("chat_id", MAIN_GROUP_ID).eq("user_id", userId);
    else await sb().from("mutes").upsert({ chat_id: MAIN_GROUP_ID, user_id: userId, until: until === null ? 0 : until });
  } catch { /* ignore */ }
}
export async function dbSetBan(userId: string, banned: boolean, reason = "") {
  try {
    if (banned) await sb().from("bans").upsert({ chat_id: MAIN_GROUP_ID, user_id: userId, reason });
    else await sb().from("bans").delete().eq("chat_id", MAIN_GROUP_ID).eq("user_id", userId);
  } catch { /* ignore */ }
}
export async function dbAddWarn(userId: string, reason: string) {
  try {
    const { data } = await sb().from("warns").select("count").eq("chat_id", MAIN_GROUP_ID).eq("user_id", userId).single();
    const c = (data?.count || 0) + 1;
    await sb().from("warns").upsert({ chat_id: MAIN_GROUP_ID, user_id: userId, count: c, reason });
  } catch { /* ignore */ }
}
export async function dbSetRole(userId: string, role: string) {
  try { await sb().from("user_roles").upsert({ user_id: userId, role }); } catch { /* ignore */ }
}
export async function dbTouchPresence(online: boolean) {
  try {
    const me = getState().me;
    if (me) await sb().from("profiles").update({ online, last_seen: Date.now() }).eq("id", me);
  } catch { /* ignore */ }
}

// ───────── realtime ─────────
export function startRealtime(opts: {
  onMessage: (m: Message) => void;
  onMessageUpdate: (m: Message) => void;
  onPresence: (onlineIds: string[]) => void;
  onTyping: (userId: string) => void;
  onModeration: () => void;
}) {
  const ch = sb().channel("madrasa-room", { config: { presence: { key: getState().me } } });

  ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${MAIN_GROUP_ID}` },
    (p: any) => { if (p.new.sender_id !== getState().me) opts.onMessage(toMessage(p.new)); });
  ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `chat_id=eq.${MAIN_GROUP_ID}` },
    (p: any) => opts.onMessageUpdate(toMessage(p.new)));
  ch.on("postgres_changes", { event: "*", schema: "public", table: "mutes", filter: `chat_id=eq.${MAIN_GROUP_ID}` }, () => opts.onModeration());
  ch.on("postgres_changes", { event: "*", schema: "public", table: "bans", filter: `chat_id=eq.${MAIN_GROUP_ID}` }, () => opts.onModeration());
  ch.on("postgres_changes", { event: "*", schema: "public", table: "warns", filter: `chat_id=eq.${MAIN_GROUP_ID}` }, () => opts.onModeration());
  ch.on("postgres_changes", { event: "*", schema: "public", table: "profiles" },
    (p: any) => {
      const s = getState();
      const m = s.members.find((x) => x.id === p.new.id);
      if (m) update((st) => ({ members: st.members.map((x) => (x.id === p.new.id ? { ...x, online: !!p.new.online, lastSeen: p.new.last_seen || x.lastSeen, name: p.new.display_name || x.name, avatar: p.new.photo_url || x.avatar, about: p.new.about ?? x.about } : x)) }));
    });

  ch.on("presence", { event: "sync" }, () => {
    const st = ch.presenceState();
    const ids = Object.keys(st);
    opts.onPresence(ids);
  });
  ch.on("broadcast", { event: "typing" }, (p: any) => {
    if (p.payload?.userId && p.payload.userId !== getState().me) opts.onTyping(p.payload.userId);
  });
  // remote commands via group_settings (instant, cross-device)
  ch.on("postgres_changes", { event: "*", schema: "public", table: "group_settings", filter: "key=eq.remote_cmd" },
    (p: any) => { try { (window as any).__onRemoteCmd?.(p.new?.value); } catch { /* ignore */ } });

  ch.subscribe(async (status: string) => {
    if (status === "SUBSCRIBED") {
      await ch.track({ online_at: Date.now() });
      dbTouchPresence(true);
    }
  });

  // typing broadcast helper
  let typingTimer: any = null;
  const sendTyping = () => {
    if (typingTimer) return;
    ch.send({ type: "broadcast", event: "typing", payload: { userId: getState().me } });
    typingTimer = setTimeout(() => { typingTimer = null; }, 3000);
  };

  window.addEventListener("beforeunload", () => dbTouchPresence(false));

  return { stop: () => { dbTouchPresence(false); sb().removeChannel(ch); }, sendTyping };
}

// ───────── moderation refresh (light — members only, no message reset) ─────────
export async function reloadMembers() {
  const s = getState();
  if (!s.me) return;
  try {
    const [{ data: profiles }, { data: roles }, { data: mutes }, { data: bans }, { data: warns }] = await Promise.all([
      sb().from("profiles").select("*"),
      sb().from("user_roles").select("*"),
      sb().from("mutes").select("*").eq("chat_id", MAIN_GROUP_ID),
      sb().from("bans").select("*").eq("chat_id", MAIN_GROUP_ID),
      sb().from("warns").select("*").eq("chat_id", MAIN_GROUP_ID),
    ]);
    const roleOf = (id: string): Role => {
      const r = (roles || []).find((x: any) => x.user_id === id)?.role;
      return r === "owner" || r === "admin" || r === "mod" ? r : "member";
    };
    const members: Member[] = (profiles || []).map((p: any) =>
      toMember(p, roleOf(p.id),
        (mutes || []).find((x: any) => x.user_id === p.id),
        (bans || []).find((x: any) => x.user_id === p.id),
        (warns || []).filter((x: any) => x.user_id === p.id))
    );
    update((st) => ({ members }));
  } catch { /* ignore */ }
}

// ───────── remote commands (cross-device via group_settings) ─────────
export interface RemoteCmd { type: "reload" | "push"; message: string; version?: string; at: number; by: string; target: "all" | string[] }
export async function dbPushRemoteCommand(cmd: RemoteCmd) {
  try {
    await sb().from("group_settings").upsert({ key: "remote_cmd", value: cmd });
  } catch { /* ignore */ }
}
export async function dbGetRemoteCommand(): Promise<RemoteCmd | null> {
  try {
    const { data } = await sb().from("group_settings").select("value").eq("key", "remote_cmd").single();
    return (data?.value as RemoteCmd) || null;
  } catch { return null; }
}

// re-export for api.ts patching
export { MAIN_GROUP_ID };
export function myId() { return getState().me; }
export function isBanned(id: string) { return !!getState().members.find((m) => m.id === id)?.banned; }
