"use client";
// ChatsApp Supabase adapter — real backend, no mocks.
// Query patterns verified against the live project.
import { supabase, MAIN_GROUP_ID, setMainGroupId, OWNER_EMAIL } from "./supabase";
import { getState, update, patchUI, toast } from "./store";import type { ChatMeta, Member, Message, Role, StatusItem } from "./types";
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
  let style: Member["style"];
  try {
    const ps = (p as any).profile_style;
    if (ps && typeof ps === "object" && typeof ps.banner === "string") style = ps;
    else if (typeof ps === "string") { const q = JSON.parse(ps); if (q && typeof q.banner === "string") style = q; }
  } catch { /* ignore */ }
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
    style,
  };
}

function toMessage(r: any): Message {
  const msg: Message = {
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
  // file messages: metadata JSON in text field
  if (msg.type === "file" && msg.text.startsWith("{")) {
    try {
      const meta = JSON.parse(msg.text);
      msg.fileName = meta.name || "file";
      msg.fileSize = meta.size || 0;
      msg.mimeType = meta.mime || "";
      msg.text = "";
    } catch { /* ignore */ }
  }
  // payload messages (poll/location/contact/games): in ka JSON state text column me
  // store hota hai — DB me `caption` column hai hi nahi, wahan bhejne se insert 400
  // ho jata tha (poll waghera isi liye fail thay). Yahan text se caption wapas banao
  // aur display text alag rakho taake previews me raw JSON na dikhe.
  if (["poll", "location", "contact", "quiz", "tictactoe", "riddle", "spin", "truthdare", "gumnam", "super", "hisaab", "emojipaheli", "sachjhoot", "numguess", "kainchi", "pasa", "tourney", "brick"].includes(msg.type) && msg.text.startsWith("{")) {
    try {
      const d = JSON.parse(msg.text);
      msg.caption = msg.text;
      // gumnam: asal text body me hai (display ke liye wahi text hai)
      msg.text = msg.type === "gumnam" ? (d && d.body) || "" : (d && (d.t || d.q)) || "";
    } catch { /* ignore */ }
  }
  // Mega-2 (UI-11) — photo ke sath caption: caption `text` column me ata hai
  if (msg.type === "image" && msg.text) {
    msg.caption = msg.text;
    msg.text = "";
  }
  return msg;
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
  // apni profile style localStorage se hydrate karo (DB column na ho to bhi kaam kare)
  try {
    const myStyle = getProfileStyle();
    if (myStyle) {
      const mi = members.findIndex((x: Member) => x.id === userId);
      if (mi >= 0 && !members[mi].style) members[mi] = { ...members[mi], style: myStyle };
    }
  } catch { /* ignore */ }
  update({
    me: userId,
    session: true,
    members,
    messages,
    chats,
    pins,
    unread,
    groupRules,
    groupDescs,
    starred: getStarred(),
    hiddenForMe: getHiddenForMe(),
    ui: { ...prev.ui, activeChatId: prev.ui.activeChatId || MAIN_GROUP_ID || chats[0]?.id || null },
  });
  // Mega-2 — statuses alag query se (messages list me shamil nahi hote)
  loadStatuses().catch(() => {});
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
// ───────── Profile style (Nitro-style) — localStorage primary, Supabase best-effort ─────────
const STYLE_KEY = "chatsapp:profile-style";
export function getProfileStyle(): import("./types").ProfileStyle | null {
  try {
    const raw = localStorage.getItem(STYLE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.banner === "string") return p;
  } catch { /* ignore */ }
  return null;
}
export async function saveProfileStyle(userId: string, style: import("./types").ProfileStyle) {
  try { localStorage.setItem(STYLE_KEY, JSON.stringify(style)); } catch { /* ignore */ }
  try {
    await sb().from("profiles").update({ profile_style: style }).eq("id", userId);
  } catch { /* column may not exist — localStorage is source of truth */ }
  try {
    update({ members: getState().members.map((m) => (m.id === userId ? { ...m, style } : m)) });
  } catch { /* ignore */ }
}
/* ───────── 19 — lazy load purane messages (upar scroll par) ───────── */
export async function loadOlderMessages(chatId: string, before: number, limit = 60): Promise<boolean> {
  try {
    const { data } = await sb()
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      // FIX: created_at BIGINT hai (ms epoch) — ISO string se compare fail hota tha
      .lt("created_at", before)
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

// ───────── Optimistic send helper: rollback + retry ─────────
// Pehle UI me dikhao (optimistic), phir DB me insert karo.
// Agar insert fail ho (2 attempts ke baad bhi) to optimistic message HATAO
// taake user ko na lage ke message gaya jabke gaya nahi.
async function insertMessageRow(m: Message, row: Record<string, unknown>, failTitle: string): Promise<boolean> {
  const s = getState();
  update({ messages: [...s.messages, m] });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { error } = await sb().from("messages").insert(row);
      if (!error) return true;
      // error aya to retry se pehle halka wait
      if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
    } catch {
      if (attempt === 0) await new Promise((r) => setTimeout(r, 900));
    }
  }
  // dono attempts fail — rollback
  update({ messages: getState().messages.filter((x) => x.id !== m.id) });
  toast(failTitle, "Dobara try karo — message save nahi hua");
  return false;
}

export async function sendText(chatId: string, text: string, replyTo?: string): Promise<Message | null> {  const s = getState();
  if (!text.trim() || !chatId) return null;
  // Ban check — banned user message nahi bhej sakta
  const meMember = s.members.find((m) => m.id === s.me);
  if (meMember?.banned) { toast("🚫 Aap ban ho", "Owner ne ban kiya hai"); return null; }
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
            // chatId pass karo taake system message sahi group me jaye + audit log me entry ho
            addWarn(s.me, `Banned lafz: "${hit}"`, chatId).catch(() => {});
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
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "text",
    text: m.text, media_url: "", reply_to: replyTo || null,
    created_at: m.at, read_by: [],
  }, "Message nahi gaya");
  if (!ok) return null;
  checkMessageBadges();
  // Phase 7 — apna jawab bhi paheli se milao
  setTimeout(() => checkRiddleAnswer(chatId, m.text, m.from).catch(() => {}), 300);
  setTimeout(() => checkHisaabAnswer(chatId, m.text, m.from).catch(() => {}), 300);
  setTimeout(() => checkEmojiAnswer(chatId, m.text, m.from).catch(() => {}), 300);
  setTimeout(() => checkNumGuess(chatId, m.text, m.from).catch(() => {}), 300);
  return m;
}

export async function sendMedia(chatId: string, file: File, kind: "image" | "voice", dur?: number, cap?: string): Promise<Message | null> {
  const s = getState();
  if (!chatId) return null;
  // store as data URL (simple, works with media_url text column)
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  // Mega-2 (UI-11) — photo caption `text` column me jata hai (caption column nahi hai);
  // toMessage use wapas caption bana deta hai. Voice par caption nahi.
  const caption = kind === "image" ? (cap || "").trim() : "";
  const m: Message = { id: uid("m"), from: s.me, chatId, type: kind, text: "", at: Date.now(), reactions: {}, src: dataUrl, dur, caption: caption || undefined };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: kind,
    text: caption, media_url: dataUrl, reply_to: null, created_at: m.at, read_by: [],
  }, "Media nahi gaya");
  if (!ok) return null;
  checkMessageBadges();
  return m;
}

/* ───────── File upload: HAR file type (PDF, DOC, MP4, MP3, ZIP, APK...) ───────── */
const MAX_FILE_MB = 50;
export function fmtSize(bytes: number): string {
  if (!bytes) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}
export async function sendFile(chatId: string, file: File): Promise<Message | null> {
  const s = getState();
  if (!chatId || !file) return null;
  const mb = file.size / (1024 * 1024);
  if (mb > MAX_FILE_MB) { toast("File bohat bari", `${fmtSize(file.size)} — max ${MAX_FILE_MB}MB`); return null; }
  // Supabase Storage try karo, fail ho to data URL fallback.
  // NOTE: `chat-files` bucket abhi Supabase me bana hi nahi — is liye storage hamesha
  // fail hota hai aur asal files data-URL par atki rehti theen (bari file = insert fail).
  // Bucket ban jaye to yehi code khud storage use karne lage ga; tab tak chhoti files
  // (5MB tak) data-URL se jayengi, bari par saaf message milega (khamosh fail nahi).
  let url = "";
  try {
    const path = `${chatId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await sb().storage.from("chat-files").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = sb().storage.from("chat-files").getPublicUrl(path);
      url = data.publicUrl;
    }
  } catch { /* fallback below */ }
  if (!url) {
    if (file.size > 5 * 1024 * 1024) {
      toast("File nahi gayi", `${file.name} (${fmtSize(file.size)}) — abhi itni bari file nahi ja sakti`);
      return null;
    }
    try {
      url = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
    } catch {
      toast("File nahi gayi", file.name);
      return null;
    }
  }
  const meta = JSON.stringify({ name: file.name, size: file.size, mime: file.type });
  const m: Message = {
    id: uid("m"), from: s.me, chatId, type: "file", text: "",
    at: Date.now(), reactions: {}, src: url,
    fileName: file.name, fileSize: file.size, mimeType: file.type,
  };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "file",
    text: meta, media_url: url, reply_to: null, created_at: m.at, read_by: [],
  }, "File nahi gayi");
  if (!ok) return null;
  checkMessageBadges();
  return m;
}

export async function deleteMessage(id: string) {
  update({ messages: getState().messages.map((m) => (m.id === id ? { ...m, deleted: true, text: "", src: undefined } : m)) });
  try {
    await sb().from("messages").update({ is_deleted: true, text: "" }).eq("id", id);
  } catch { /* ignore */ }
}

// Placeholder ("Message delete kar diya gaya") ko poori tarah hatao — owner/staff ke liye
export async function hardDeleteMessage(id: string) {
  update({ messages: getState().messages.filter((m) => m.id !== id) });
  try {
    const { error } = await sb().from("messages").delete().eq("id", id);
    if (error) throw error;
  } catch { /* RLS block — local phir bhi saaf */ }
}

/* ───────── /safai: HARD DELETE (owner only, user-explicitly authorized) ─────────
   Sirf /safai ke liye — normal message delete abhi bhi soft delete hai. */
export async function clearChat(chatId: string, count?: number) {
  // SAARI messages — deleted placeholders bhi! (koi !m.deleted filter nahi)
  const all = getState().messages.filter((m) => m.chatId === chatId);
  const targets = count && count > 0 ? [...all].sort((a, b) => b.at - a.at).slice(0, count) : all;
  const ids = targets.map((m) => m.id);
  if (!ids.length) return 0;
  // Local: poori tarah hatao (koi placeholder nahi)
  update({ messages: getState().messages.filter((m) => !(m.chatId === chatId && ids.includes(m.id))) });
  try {
    const { error } = await sb().from("messages").delete().in("id", ids);
    if (error) throw error;
  } catch {
    // RLS ne roka to local phir bhi saaf hai; parent RLS policy add kar sakta hai
  }
  return ids.length;
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
  // FIX: `: x` hona chahiye tha — `: m` saare messages ko corrupt kar deta tha
  update({ messages: s.messages.map((x) => (x.id === msgId ? { ...x, reactions: next } : x)) });
  try {
    await sb().from("messages").update({ reactions: next }).eq("id", msgId);
  } catch { /* column may not exist — local still works */ }
}

// ───────── moderation (owner) ─────────
// chatId optional hai — default MAIN_GROUP_ID. RLS UPDATE block karta hai,
// is liye upsert NAHI — select-then-insert/delete pattern.
function modChatId(chatId?: string): string {
  return chatId || MAIN_GROUP_ID;
}
export async function setMute(userId: string, until: number | null | undefined, chatId?: string) {
  const cid = modChatId(chatId);
  if (!cid) { toast("Group nahi mila", "Dobara try karo"); return; }
  const targetName = getState().members.find((m) => m.id === userId)?.name || "Member";
  try {
    if (until === undefined) {
      // unmute — row delete karo
      const { error } = await sb().from("mutes").delete().eq("chat_id", cid).eq("user_id", userId);
      if (error) throw error;
    } else {
      // mute — pehle check karo, phir insert ya update-via-delete+insert
      const { data: ex } = await sb().from("mutes").select("user_id").eq("chat_id", cid).eq("user_id", userId).maybeSingle();
      const val = until === null ? 0 : until;
      if (ex) {
        await sb().from("mutes").delete().eq("chat_id", cid).eq("user_id", userId);
      }
      const { error } = await sb().from("mutes").insert({ chat_id: cid, user_id: userId, until: val });
      if (error) throw error;
    }
  } catch (e: any) {
    toast("Mute fail hua", e?.message || "Dobara try karo");
    return;
  }
  update({ members: getState().members.map((m) => (m.id === userId ? { ...m, mutedUntil: until } : m)) });
  try { const { logAudit } = await import("./owner"); await logAudit(until === undefined ? "unmute" : "mute", userId, until === null ? "hamesha" : until === undefined ? "unmute" : new Date(until).toLocaleString(), cid); } catch { /* ignore */ }
  // visibility: group me system message
  try { await postSystem(cid, until === undefined ? `🔊 ${targetName} unmute ho gaya` : `🔇 ${targetName} mute ho gaya (${until === null ? "hamesha" : "1 ghanta"})`); } catch { /* ignore */ }
}
export async function setBan(userId: string, banned: boolean, reason = "", chatId?: string) {
  const cid = modChatId(chatId);
  if (!cid) { toast("Group nahi mila", "Dobara try karo"); return; }
  const targetName = getState().members.find((m) => m.id === userId)?.name || "Member";
  try {
    if (banned) {
      const { data: ex } = await sb().from("bans").select("user_id").eq("chat_id", cid).eq("user_id", userId).maybeSingle();
      if (!ex) {
        const { error } = await sb().from("bans").insert({ chat_id: cid, user_id: userId, reason });
        if (error) throw error;
      }
    } else {
      const { error } = await sb().from("bans").delete().eq("chat_id", cid).eq("user_id", userId);
      if (error) throw error;
    }
  } catch (e: any) {
    toast("Ban fail hua", e?.message || "Dobara try karo");
    return;
  }
  update({ members: getState().members.map((m) => (m.id === userId ? { ...m, banned } : m)) });
  try { const { logAudit } = await import("./owner"); await logAudit(banned ? "ban" : "unban", userId, reason || (banned ? "ban" : "unban"), cid); } catch { /* ignore */ }
  try { await postSystem(cid, banned ? `🚫 ${targetName} ban ho gaya${reason ? `: ${reason}` : ""}` : `✅ ${targetName} unban ho gaya`); } catch { /* ignore */ }
}
export async function addWarn(userId: string, reason: string, chatId?: string, silent = false) {
  const cid = modChatId(chatId);
  if (!cid) { toast("Group nahi mila", "Dobara try karo"); return; }
  const targetName = getState().members.find((m) => m.id === userId)?.name || "Member";
  try {
    const { data } = await sb().from("warns").select("count").eq("chat_id", cid).eq("user_id", userId).maybeSingle();
    const c = (data?.count || 0) + 1;
    // upsert nahi — delete + insert (RLS UPDATE block)
    await sb().from("warns").delete().eq("chat_id", cid).eq("user_id", userId);
    const { error } = await sb().from("warns").insert({ chat_id: cid, user_id: userId, count: c, reason });
    if (error) throw error;
  } catch (e: any) {
    if (!silent) toast("Warning fail hui", e?.message || "Dobara try karo");
    return;
  }
  const ms = getState().members.map((m) => (m.id === userId ? { ...m, warns: [...m.warns, { reason, at: Date.now() }] } : m));
  update({ members: ms });
  try { const { logAudit } = await import("./owner"); await logAudit("warn", userId, reason, cid); } catch { /* ignore */ }
  // visibility: group me system message — kisne, kya word, warn mili
  if (!silent) {
    try { await postSystem(cid, `⚠️ ${targetName} ko warning mili: ${reason}`); } catch { /* ignore */ }
  }
  const target = ms.find((m) => m.id === userId);
  if (target && target.warns.length >= 3) {
    await setMute(userId, Date.now() + 3600e3, cid);
    try { await postSystem(cid, `🔇 ${targetName} auto-mute ho gaya (3 warnings)`); } catch { /* ignore */ }
  }
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
// Poll definition (question + options + endsAt) JSON message ke `text` column me store hota hai
// (DB me `caption` column nahi hai — wahan bhejne se insert 400 hota tha); toMessage use wapas caption me rakhta hai.
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
  const payload = JSON.stringify({ ...poll, t: poll.q });
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "poll", text: poll.q, at: Date.now(), reactions: {}, caption: payload };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "poll",
    text: payload, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Poll nahi gaya");
  if (!ok) return null;
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
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "location",
    text: m.caption, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Location nahi gayi");
  if (!ok) return null;
  return m;
}

// ───────── B7 contact share ─────────
export async function sendContact(chatId: string, name: string, phone: string): Promise<Message | null> {
  const s = getState();
  if (!chatId || !name.trim()) return null;
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "contact", text: "", at: Date.now(), reactions: {}, caption: JSON.stringify({ name: name.trim(), phone: phone.trim() }) };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "contact",
    text: m.caption, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Contact nahi gaya");
  if (!ok) return null;
  return m;
}

// ───────── B13 starred messages ─────────
// AUDIT FIX — delete-for-me: per-user hidden message ids (sirf local, server untouched)
function hiddenKey(): string {
  try { return `chatsapp:hidden:${getState().me || "anon"}`; } catch { return "chatsapp:hidden:anon"; }
}
export function getHiddenForMe(): string[] {
  try {
    const raw = localStorage.getItem(hiddenKey());
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch { return []; }
}
export function hideMessageForMe(msgId: string) {
  const cur = getState().hiddenForMe;
  if (cur.includes(msgId)) return;
  const next = [...cur, msgId];
  try { localStorage.setItem(hiddenKey(), JSON.stringify(next)); } catch { /* ignore */ }
  update({ hiddenForMe: next });
}
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
    // Mega-2 — status rows chat list/messages me nahi, alag slice me jati hain
    if (p.new.chat_id === STATUS_CHAT_ID) { upsertStatusFromRow(p.new); return; }
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
      // FIX: sirf activeChatId use karo — chats[0] fallback galat chat ko "khula" samajhta tha
      let unread = st.unread;
      const activeId = st.ui.activeChatId;
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
    // Mega-2 — status viewers (read_by) updates alag slice me
    if (p.new.chat_id === STATUS_CHAT_ID) { upsertStatusFromRow(p.new); return; }
    const m = toMessage(p.new);
    const st = getState();
    const prev = st.messages.find((x) => x.id === m.id);
    update((s) => ({ messages: s.messages.map((x) => (x.id === m.id ? { ...m } : x)) }));
    // 8 — koi MERE message par react kare to halki notification
    if (prev && m.from === st.me && prev.reactions && m.reactions) {
      outer: for (const [emoji, users] of Object.entries(m.reactions)) {
        if (emoji.startsWith("__poll_")) continue; // poll votes reactions nahi
        const before = new Set(((prev.reactions as any)[emoji] || []) as string[]);
        for (const u of users as string[]) {
          if (u !== st.me && !before.has(u)) {
            const nm = st.members.find((x) => x.id === u)?.name || "Kisi ne";
            toast(`${nm} ne ${emoji} react kiya`, "Tumhare message par");
            break outer;
          }
        }
      }
    }
  });
  // AUDIT FIX: hard delete (owner) ho to sab clients se hatao
  ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p: any) => {
    const id = p.old?.id;
    if (!id) return;
    update((st) => ({ messages: st.messages.filter((x) => x.id !== id), statuses: st.statuses.filter((x) => x.id !== id) }));
  });

  // ───────── AUDIT #3: groups & DMs realtime — naya group/DM foran sab par ─────────
  // chats INSERT: naya group ya DM bana — agar hum participant hain to list me add karo
  ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "chats" }, async (p: any) => {
    const s = getState();
    if (!p.new?.id || s.chats.some((c) => c.id === p.new.id)) return;
    try {
      // kya hum is chat ke participant hain?
      const { data: part } = await sb().from("chat_participants").select("chat_id").eq("chat_id", p.new.id).eq("user_id", s.me).maybeSingle();
      if (!part) return;
      const isGroup = p.new.is_main_group || p.new.type === "group";
      let meta: any;
      if (isGroup) {
        meta = { id: p.new.id, type: "group" as const, name: p.new.name || "Group", photo: p.new.photo_url || "", lastAt: Date.now() };
      } else {
        // DM: dusre participant ka naam/photo nikalo
        const { data: parts } = await sb().from("chat_participants").select("user_id").eq("chat_id", p.new.id);
        const otherId = (parts || []).map((x: any) => x.user_id).find((id: string) => id !== s.me);
        const other = s.members.find((m) => m.id === otherId);
        meta = { id: p.new.id, type: "dm" as const, name: other?.name || p.new.name || "Chat", photo: other?.avatar || p.new.photo_url || "", otherId, lastAt: Date.now() };
      }
      update((st) => st.chats.some((c) => c.id === meta.id) ? {} : { chats: [...st.chats, meta] });
      toast(isGroup ? "Naya group 📢" : "Nayi DM 💬", meta.name);
    } catch { /* ignore */ }
  });
  // chats DELETE: group delete hua — list se hatao
  ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "chats" }, (p: any) => {
    const id = p.old?.id;
    if (!id) return;
    const s = getState();
    if (!s.chats.some((c) => c.id === id)) return;
    const gone = s.chats.find((c) => c.id === id);
    update((st) => ({
      chats: st.chats.filter((c) => c.id !== id),
      messages: st.messages.filter((m) => m.chatId !== id),
    }));
    if (s.ui.activeChatId === id) patchUI({ activeChatId: s.chats.find((c) => c.id !== id)?.id || null, groupInfo: null });
    toast("Group delete ho gaya 🗑️", gone?.name || "");
  });
  // chat_participants INSERT: humein kisi chat me add kiya — chat details lao
  ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_participants" }, async (p: any) => {
    const s = getState();
    if (!p.new?.chat_id || p.new.user_id !== s.me) return;
    if (s.chats.some((c) => c.id === p.new.chat_id)) return;
    try {
      const { data: c } = await sb().from("chats").select("id,type,name,photo_url,is_main_group").eq("id", p.new.chat_id).single();
      if (!c) return;
      const isGroup = (c as any).is_main_group || (c as any).type === "group";
      let meta: any;
      if (isGroup) {
        meta = { id: (c as any).id, type: "group" as const, name: (c as any).name || "Group", photo: (c as any).photo_url || "", lastAt: Date.now() };
      } else {
        const { data: parts } = await sb().from("chat_participants").select("user_id").eq("chat_id", (c as any).id);
        const otherId = (parts || []).map((x: any) => x.user_id).find((id: string) => id !== s.me);
        const other = s.members.find((m) => m.id === otherId);
        meta = { id: (c as any).id, type: "dm" as const, name: other?.name || (c as any).name || "Chat", photo: other?.avatar || (c as any).photo_url || "", otherId, lastAt: Date.now() };
      }
      update((st) => st.chats.some((x) => x.id === meta.id) ? {} : { chats: [...st.chats, meta] });
    } catch { /* ignore */ }
  });
  // chat_participants DELETE: humein chat se nikala — list se hatao
  ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_participants" }, (p: any) => {
    const s = getState();
    if (!p.old?.chat_id || p.old.user_id !== s.me) return;
    if (!s.chats.some((c) => c.id === p.old.chat_id)) return;
    update((st) => ({
      chats: st.chats.filter((c) => c.id !== p.old.chat_id),
      messages: st.messages.filter((m) => m.chatId !== p.old.chat_id),
    }));
    if (s.ui.activeChatId === p.old.chat_id) patchUI({ activeChatId: s.chats.find((c) => c.id !== p.old.chat_id)?.id || null, groupInfo: null });
  });

  ch.on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, (p: any) => {
    update((st) => ({
      members: st.members.map((x) =>
        x.id === p.new.id
          ? { ...x, online: !!p.new.online, lastSeen: p.new.last_seen || x.lastSeen, name: p.new.display_name || x.name, avatar: p.new.photo_url || x.avatar, about: p.new.about ?? x.about, style: (p.new as any).profile_style || x.style }
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
  // NOTE: filter nahi lagaya — MAIN_GROUP_ID startRealtime() ke waqt empty ho sakta hai
  // (filter `chat_id=eq.` kabhi match nahi karta). refreshMod andar khud filter karta hai.
  ch.on("postgres_changes", { event: "*", schema: "public", table: "mutes" }, refreshMod);
  ch.on("postgres_changes", { event: "*", schema: "public", table: "bans" }, refreshMod);
  ch.on("postgres_changes", { event: "*", schema: "public", table: "warns" }, refreshMod);

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
    const cid = p.payload?.chatId;
    const s = getState();
    // AUDIT FIX: sirf is chat ki typing rakho — dusri chat ki typing yahan nahi dikhegi
    if (uidv && uidv !== s.me && cid && !s.ui.typing.some((t) => t.id === uidv && t.chatId === cid)) {
      patchUI({ typing: [...s.ui.typing, { id: uidv, chatId: cid }] });
      setTimeout(() => patchUI({ typing: getState().ui.typing.filter((t) => !(t.id === uidv && t.chatId === cid)) }), 3500);
    }
  });

  ch.subscribe(async (status: string) => {
    if (status === "SUBSCRIBED") {
      await ch.track({ online_at: Date.now() });
      touchPresence(true);
    }
  });

  let typingTimer: any = null;
  // AUDIT FIX: chatId bhejta hai taake typing sirf usi chat me dikhe
  const sendTyping = (chatId?: string) => {
    if (typingTimer) return;
    try { ch.send({ type: "broadcast", event: "typing", payload: { userId: getState().me, chatId: chatId || getState().ui.activeChatId } }); } catch { /* ignore */ }
    typingTimer = setTimeout(() => { typingTimer = null; }, 3000);
  };

  window.addEventListener("beforeunload", () => touchPresence(false));
  return { stop: () => { touchPresence(false); try { sb().removeChannel(ch); } catch { /* ignore */ } }, sendTyping };
}

export { uid };

// ───────── Phase 7 — Games & Fun ─────────
import { pickQuizQuestions, parseQuiz, quizAnswered, quizScores, parseTTT, tttWinner, dailyRiddle, parseRiddle, isRiddleAnswer, normAnswer, genHisaab, parseHisaab, EMOJI_BANK, isEmojiAnswer, SACH_BANK, sachCorrectUsers, parseSachJhoot, parsePasa, pasaCell, PASA_SAFE_CELLS, PASA_FINISH, kainchiResult, parsePasaV2, pasaBotName, pasaSixChainAfter, pasaLegalMoves, pasaPlayerDone, pasaIsOpponent, pasaPaused, PASA_PAUSE_MS, pasaChooseToken, parseTourney, type PasaSettings, type PasaStateV2, type TourneyState } from "./games";

/** I1 — Deen Quiz shuru karo (5 sawal, har sawal 15 sec) */
export async function sendQuiz(chatId: string): Promise<Message | null> {
  const s = getState();
  if (!chatId) return null;
  // ek waqt me ek hi active quiz
  const active = s.messages.find((m) => m.chatId === chatId && m.type === "quiz" && !m.deleted && !parseQuiz(m.caption)?.done);
  if (active) { toast("Quiz pehle se chal raha hai", "Khatam hone ka intezar karo"); return null; }
  const questions = pickQuizQuestions();
  const state = { questions, current: 0, qEndsAt: Date.now() + 15000, done: false };
  const payload = JSON.stringify({ ...state, t: "🧠 Deen Quiz!" });
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "quiz", text: "🧠 Deen Quiz!", at: Date.now(), reactions: {}, caption: payload };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "quiz",
    text: payload, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Quiz nahi gaya");
  if (!ok) return null;
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
  try { await sb().from("messages").update({ text: caption }).eq("id", msgId); } catch { /* ignore */ }
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
  const payload = JSON.stringify({ ...state, t: `⭕❌ TicTacToe challenge: ${oppName}` });
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "tictactoe", text: `⭕❌ TicTacToe challenge: ${oppName}`, at: Date.now(), reactions: {}, caption: payload };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "tictactoe",
    text: payload, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Challenge nahi gaya");
  if (!ok) return null;
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
  try { await sb().from("messages").update({ text: caption }).eq("id", msgId); } catch { /* ignore */ }
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
  try { await sb().from("messages").update({ text: caption }).eq("id", msgId); } catch { /* ignore */ }
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
  const payload = JSON.stringify({ ...state, t: "🧩 Aaj ki Paheli!" });
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "riddle", text: "🧩 Aaj ki Paheli!", at: Date.now(), reactions: {}, caption: payload };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "riddle",
    text: payload, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Paheli nahi gayi");
  if (!ok) return null;
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
    try { await sb().from("messages").update({ text: caption }).eq("id", r.id); } catch { /* ignore */ }
    const name = getState().members.find((x) => x.id === senderId)?.name || "Kisi ne";
    postSystem(chatId, `🧩 Paheli solve! ${name} ne sahi jawab diya: "${st.a}" 🎉`);
  }
}

/** B10 — Sticker bhejo */
export async function sendSticker(chatId: string, stickerId: string): Promise<Message | null> {
  const s = getState();
  if (!chatId || !stickerId) return null;
  // Ban check — banned user sticker nahi bhej sakta (sendText jaisa)
  if (s.members.find((m) => m.id === s.me)?.banned) { toast("🚫 Aap ban ho", "Owner ne ban kiya hai"); return null; }
  const isUrl = /^https?:\/\//i.test(stickerId);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "sticker", text: isUrl ? "" : stickerId, at: Date.now(), reactions: {} };
  if (isUrl) m.src = stickerId;
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "sticker",
    text: m.text, media_url: m.src || "", reply_to: null, created_at: m.at, read_by: [],
  }, "Sticker nahi gaya");
  if (!ok) return null;
  return m;
}

/** GIF bhejo — sticker jesa simple (caption nahi, 400 fix) */
export async function sendGif(chatId: string, gifUrl: string, gifTitle?: string, fullUrl?: string): Promise<Message | null> {
  const s = getState();
  if (!chatId || !gifUrl) return null;
  // Ban check — banned user GIF nahi bhej sakta (sendText jaisa)
  if (s.members.find((m) => m.id === s.me)?.banned) { toast("🚫 Aap ban ho", "Owner ne ban kiya hai"); return null; }
  // Full URL ko src me rakho (viewer ke liye), preview chat me dikhega
  // Caption use nahi karte (400 error fix) — fullUrl ko text me store karte hain agar alag hai
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "gif", text: "", src: gifUrl, at: Date.now(), reactions: {} };
  // Full URL alag hai to usko src me rakho taake viewer me full quality mile
  if (fullUrl && fullUrl !== gifUrl) (m as any).fullSrc = fullUrl;
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "gif",
    text: "", media_url: gifUrl, reply_to: null, created_at: m.at, read_by: [],
  }, "GIF nahi gaya");
  if (!ok) return null;
  return m;
}

/* ═══════════════ MEGA-2 — Status / Fun games / Super Reaction ═══════════════
   Saare naye payloads poll/games wale pattern par: JSON state `text` column me,
   toMessage use wapas `caption` me restore karta hai (caption column DB me nahi). */

// payload state update helper (quiz advance wala pattern)
async function updatePayloadMsg(msgId: string, payloadObj: any) {
  const caption = JSON.stringify(payloadObj);
  update({ messages: getState().messages.map((x) => (x.id === msgId ? { ...x, caption } : x)) });
  try { await sb().from("messages").update({ text: caption }).eq("id", msgId); } catch { /* ignore */ }
}
function parsePayload(m?: Message | null): any | null {
  if (!m?.caption) return null;
  try { return JSON.parse(m.caption); } catch { return null; }
}

/* ───────── A — Status/Stories (WhatsApp wala system) ─────────
   Storage: messages table me type="status" rows, chat_id = STATUS_CHAT_ID.
   Nayi table NAHI — is liye deploy bina SQL ke ho jata hai. 24h expiry client par
   check hoti hai; viewers `read_by` column me (messages wala hi pattern). */
export const STATUS_CHAT_ID = "__status__";
export const STATUS_TTL = 24 * 3600e3;

export function rowToStatus(r: any): StatusItem | null {
  try {
    const at = r?.created_at || 0;
    if (!at || Date.now() - at > STATUS_TTL) return null;
    let body = "", bg: string | undefined;
    try {
      const d = JSON.parse(r.text || "");
      body = d.body || "";
      bg = d.bg || undefined;
    } catch { body = r.text || ""; }
    return {
      id: r.id, from: r.sender_id, body, bg,
      src: r.media_url || undefined,
      at,
      readBy: Array.isArray(r.read_by) ? r.read_by.filter((x: any) => typeof x === "string") : [],
    };
  } catch { return null; }
}

export function upsertStatusFromRow(r: any) {
  if (!r?.id) return;
  const it = rowToStatus(r);
  update((st) => {
    const rest = st.statuses.filter((x) => x.id !== r.id);
    return { statuses: it ? [...rest, it].sort((a, b) => a.at - b.at) : rest };
  });
}

export async function loadStatuses() {
  try {
    const since = Date.now() - STATUS_TTL;
    const { data } = await sb().from("messages").select("*")
      .eq("chat_id", STATUS_CHAT_ID).eq("type", "status")
      .gt("created_at", since).order("created_at", { ascending: true }).limit(300);
    const items = (data || []).map(rowToStatus).filter(Boolean) as StatusItem[];
    update({ statuses: items });
  } catch { /* statuses best-effort hain */ }
}

/** Status lagao — photo (src = data URL) ya text (body + bg color) */
export async function postStatus(body: string, opts?: { bg?: string; src?: string }): Promise<boolean> {
  const s = getState();
  if (!s.me) return false;
  const item: StatusItem = {
    id: uid("st"), from: s.me, body: (body || "").trim(),
    bg: opts?.bg, src: opts?.src, at: Date.now(), readBy: [],
  };
  if (!item.body && !item.src) return false;
  update((st) => ({ statuses: [...st.statuses, item] }));
  try {
    const { error } = await sb().from("messages").insert({
      id: item.id, chat_id: STATUS_CHAT_ID, sender_id: s.me, type: "status",
      text: JSON.stringify({ body: item.body, bg: item.bg || "" }),
      media_url: item.src || "", reply_to: null, created_at: item.at, read_by: [],
    });
    if (error) throw error;
    return true;
  } catch {
    update((st) => ({ statuses: st.statuses.filter((x) => x.id !== item.id) }));
    toast("Status nahi gaya", "Dobara try karo");
    return false;
  }
}

/** Status dekha — viewers list (read_by) me apna naam joro */
export async function markStatusSeen(id: string) {
  const s = getState();
  const it = s.statuses.find((x) => x.id === id);
  if (!it || !s.me || it.from === s.me || it.readBy.includes(s.me)) return;
  const readBy = [...it.readBy, s.me];
  update((st) => ({ statuses: st.statuses.map((x) => (x.id === id ? { ...x, readBy } : x)) }));
  try { await sb().from("messages").update({ read_by: readBy }).eq("id", id); } catch { /* ignore */ }
}

/** Apna status delete karo (hard delete — sab ke liye) */
export async function deleteStatus(id: string) {
  update((st) => ({ statuses: st.statuses.filter((x) => x.id !== id) }));
  try { await sb().from("messages").delete().eq("id", id); } catch { /* ignore */ }
}

/* ───────── B2 — Spin Wheel ───────── */
export async function sendSpinWheel(chatId: string, options: string[]): Promise<Message | null> {
  const s = getState();
  const opts = options.map((o) => o.trim()).filter(Boolean).slice(0, 8);
  if (!chatId || opts.length < 2) return null;
  const payload = { options: opts, result: null as number | null, spunBy: null as string | null, t: "🎡 Spin Wheel" };
  const cap = JSON.stringify(payload);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "spin", text: payload.t, at: Date.now(), reactions: {}, caption: cap };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "spin",
    text: cap, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Wheel nahi gaya");
  if (!ok) return null;
  return m;
}
export async function spinWheelNow(msgId: string) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  const st = parsePayload(m);
  if (!m || !st || st.result !== null || !Array.isArray(st.options) || st.options.length < 2) return;
  const result = Math.floor(Math.random() * st.options.length);
  await updatePayloadMsg(msgId, { ...st, result, spunBy: s.me });
}

/* ───────── B4 — Truth or Dare ───────── */
export async function sendTruthDare(chatId: string, mode: "truth" | "dare", prompt: string): Promise<Message | null> {
  const s = getState();
  if (!chatId || !prompt.trim()) return null;
  const payload = { mode, q: prompt.trim(), t: "🎲 Truth or Dare" };
  const cap = JSON.stringify(payload);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "truthdare", text: payload.t, at: Date.now(), reactions: {}, caption: cap };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "truthdare",
    text: cap, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Truth/Dare nahi gaya");
  if (!ok) return null;
  return m;
}
export async function rerollTruthDare(msgId: string, mode: "truth" | "dare", prompt: string) {
  const m = getState().messages.find((x) => x.id === msgId);
  const st = parsePayload(m);
  if (!st || !prompt.trim()) return;
  await updatePayloadMsg(msgId, { ...st, mode, q: prompt.trim() });
}

/* ───────── B6 — Gumnam Paigham (sender chhupa, sirf owner ko asal pata) ───────── */
export async function sendGumnam(chatId: string, body: string): Promise<Message | null> {
  const s = getState();
  const b = body.trim();
  if (!chatId || !b) return null;
  const payload = { body: b, t: "🕵️ Gumnam Paigham" };
  const cap = JSON.stringify(payload);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "gumnam", text: b, at: Date.now(), reactions: {}, caption: cap };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "gumnam",
    text: cap, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Paigham nahi gaya");
  if (!ok) return null;
  return m;
}

/* ───────── B5 — Super Reaction (SIRF owner, full-screen effect) ───────── */
export type SuperFxKind = "hearts" | "confetti" | "stars";
export async function sendSuperReaction(chatId: string, emoji: string, kind: SuperFxKind, targetId?: string): Promise<Message | null> {
  const s = getState();
  const me = s.members.find((x) => x.id === s.me);
  if (!chatId) return null;
  if (me?.role !== "owner") { toast("Sirf owner ⭐", "Super Reaction sirf owner bhej sakta hai"); return null; }
  const payload = { emoji, kind, target: targetId || null, t: "⭐ Super Reaction" };
  const cap = JSON.stringify(payload);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "super", text: payload.t, at: Date.now(), reactions: {}, caption: cap };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "super",
    text: cap, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Super Reaction nahi gaya");
  if (!ok) return null;
  return m;
}

/* ═══════════════ GAMES UPDATE — 6 naye games ═══════════════
   Pattern hamesha wahi: JSON state `text` column me, local Message me
   caption = wahi JSON, display text payload ke `t` me. */

// scores map se sab se zyada score wala user
function topScoreUser(scores: Record<string, number>): string | null {
  const entries = Object.entries(scores || {}).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] || null;
}

/* ───────── G1 — Hisaab Race (🔢 tez maths, 5 rounds) ───────── */
export async function sendHisaab(chatId: string): Promise<Message | null> {
  const s = getState();
  if (!chatId) return null;
  const active = s.messages.find((m) => m.chatId === chatId && m.type === "hisaab" && !m.deleted && !(parseHisaab(m.caption) as any)?.done);
  if (active) { toast("Hisaab Race pehle se chal raha hai", "Khatam hone ka intezar karo"); return null; }
  const state: any = { ...genHisaab(), round: 1, total: 5, scores: {} as Record<string, number>, lastWin: null, done: false, winner: null, t: "🔢 Hisaab Race" };
  const cap = JSON.stringify(state);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "hisaab", text: state.t, at: Date.now(), reactions: {}, caption: cap };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "hisaab",
    text: cap, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Game nahi gaya");
  if (!ok) return null;
  return m;
}
/** text message ko active hisaab race ke jawab se milao — sirf poora number react karta hai */
export async function checkHisaabAnswer(chatId: string, text: string, senderId: string) {
  if (senderId === "system") return;
  const s = getState();
  const candidates = s.messages.filter((m) => m.chatId === chatId && m.type === "hisaab" && !m.deleted);
  const r = [...candidates].reverse().find((m) => !(parseHisaab(m.caption) as any)?.done);
  if (!r) return;
  const st: any = parseHisaab(r.caption);
  if (!st || st.done) return;
  const trimmed = (text || "").trim();
  if (!/^-?\d+$/.test(trimmed)) return;
  const n = Number(trimmed);
  if (n !== st.a) return;
  const scores: Record<string, number> = { ...((st.scores || {}) as Record<string, number>) };
  scores[senderId] = (scores[senderId] || 0) + 10;
  const total = typeof st.total === "number" ? st.total : 5;
  const round = typeof st.round === "number" ? st.round : 1;
  if (round >= total) {
    const winner = topScoreUser(scores) || senderId;
    await updatePayloadMsg(r.id, { ...st, scores, done: true, winner });
    const name = getState().members.find((x) => x.id === winner)?.name || "Koi";
    postSystem(chatId, `🏆 Hisaab Race khatam! Winner: ${name} (${scores[winner] || 0} points)`);
    return;
  }
  await updatePayloadMsg(r.id, { ...st, ...genHisaab(), round: round + 1, total, scores, lastWin: { by: senderId }, done: false, winner: null, t: st.t || "🔢 Hisaab Race" });
}

/* ───────── G2 — Emoji Paheli (🧩 emoji se Urdu lafz guess, 5 rounds) ───────── */
export async function sendEmojiPaheli(chatId: string): Promise<Message | null> {
  const s = getState();
  if (!chatId || !EMOJI_BANK || EMOJI_BANK.length === 0) return null;
  const active = s.messages.find((m) => {
    if (m.chatId !== chatId || m.type !== "emojipaheli" || m.deleted) return false;
    const p = parsePayload(m);
    return p && !p.done;
  });
  if (active) { toast("Emoji Paheli pehle se chal rahi hai", "Khatam hone ka intezar karo"); return null; }
  const idx = Math.floor(Math.random() * EMOJI_BANK.length);
  const state: any = { i: idx, used: [idx], scores: {} as Record<string, number>, last: null, done: false, winner: null, t: "🧩 Emoji Paheli" };
  const cap = JSON.stringify(state);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "emojipaheli", text: state.t, at: Date.now(), reactions: {}, caption: cap };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "emojipaheli",
    text: cap, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Game nahi gaya");
  if (!ok) return null;
  return m;
}
/** text message ko active emoji paheli ke jawab se milao */
export async function checkEmojiAnswer(chatId: string, text: string, senderId: string) {
  if (senderId === "system") return;
  const s = getState();
  const candidates = s.messages.filter((m) => m.chatId === chatId && m.type === "emojipaheli" && !m.deleted);
  const r = [...candidates].reverse().find((m) => { const p = parsePayload(m); return p && !p.done; });
  if (!r) return;
  const st: any = parsePayload(r);
  if (!st || st.done) return;
  const entry: any = (EMOJI_BANK as any[])[st.i];
  if (!entry) return;
  if (!isEmojiAnswer(text, entry)) return;
  const scores: Record<string, number> = { ...((st.scores || {}) as Record<string, number>) };
  scores[senderId] = (scores[senderId] || 0) + 10;
  const last = { by: senderId, a: entry.a };
  const used: number[] = Array.isArray(st.used) ? [...st.used] : [st.i];
  if (used.length >= 5) {
    const winner = topScoreUser(scores) || senderId;
    await updatePayloadMsg(r.id, { ...st, scores, last, done: true, winner });
    const name = getState().members.find((x) => x.id === winner)?.name || "Koi";
    postSystem(chatId, `🧩 Emoji Paheli khatam! Winner: ${name} (${scores[winner] || 0} points)`);
    return;
  }
  const unused: number[] = [];
  for (let i = 0; i < EMOJI_BANK.length; i++) if (!used.includes(i)) unused.push(i);
  if (unused.length === 0) {
    const winner = topScoreUser(scores) || senderId;
    await updatePayloadMsg(r.id, { ...st, scores, last, done: true, winner });
    const name = getState().members.find((x) => x.id === winner)?.name || "Koi";
    postSystem(chatId, `🧩 Emoji Paheli khatam! Winner: ${name} (${scores[winner] || 0} points)`);
    return;
  }
  const nextIdx = unused[Math.floor(Math.random() * unused.length)];
  await updatePayloadMsg(r.id, { ...st, scores, last, used: [...used, nextIdx], i: nextIdx });
}

/* ───────── G3 — Sach Ya Jhoot (✅❌ 5 statements, har ek 20 sec) ───────── */
export async function sendSachJhoot(chatId: string): Promise<Message | null> {
  const s = getState();
  if (!chatId || !SACH_BANK || SACH_BANK.length === 0) return null;
  const order = SACH_BANK.map((_: any, i: number) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const state: any = { order: order.slice(0, 5), round: 0, qEndsAt: Date.now() + 20000, scores: {} as Record<string, number>, lastResult: null, done: false, winner: null, t: "✅ Sach Ya Jhoot ❌" };
  const cap = JSON.stringify(state);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "sachjhoot", text: state.t, at: Date.now(), reactions: {}, caption: cap };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "sachjhoot",
    text: cap, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Game nahi gaya");
  if (!ok) return null;
  return m;
}
/** Sach/Jhoot ka jawab do — reactions pattern (answerQuiz jaisa), ek round me ek hi choice */
export async function answerSachJhoot(msgId: string, choice: 0 | 1) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st: any = parseSachJhoot(m.caption);
  if (!st || st.done || Date.now() > st.qEndsAt) return;
  const next = { ...m.reactions };
  for (let c = 0; c < 2; c++) {
    const k = `__sj_${st.round}_${c}`;
    const rest = ((next[k] as string[]) || []).filter((u) => u !== s.me);
    if (rest.length === 0) delete next[k]; else next[k] = rest;
  }
  const key = `__sj_${st.round}_${choice}`;
  next[key] = [...((next[key] as string[]) || []), s.me];
  update({ messages: s.messages.map((x) => (x.id === msgId ? { ...x, reactions: next } : x)) });
  try { await sb().from("messages").update({ reactions: next }).eq("id", msgId); } catch { /* ignore */ }
}
/** Agle statement par jao (timer khatam par chalega) — sahi jawab walon ko +5 */
export async function advanceSachJhoot(msgId: string) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st: any = parseSachJhoot(m.caption);
  if (!st || st.done) return;
  const entry: any = (SACH_BANK as any[])[st.order[st.round]];
  if (!entry) return;
  const correct: string[] = sachCorrectUsers(m.reactions, st.round, entry.truth) || [];
  const scores: Record<string, number> = { ...((st.scores || {}) as Record<string, number>) };
  correct.forEach((u) => { scores[u] = (scores[u] || 0) + 5; });
  const lastResult = { truth: entry.truth, correct: correct.length };
  if (st.round >= st.order.length - 1) {
    const winner = topScoreUser(scores);
    await updatePayloadMsg(msgId, { ...st, scores, lastResult, done: true, winner });
    if (winner) {
      const name = getState().members.find((x) => x.id === winner)?.name || "Koi";
      postSystem(m.chatId, `✅ Sach Ya Jhoot khatam! Winner: ${name} (${scores[winner] || 0} points)`);
    } else {
      postSystem(m.chatId, "✅ Sach Ya Jhoot khatam! Kisi ne sahi jawab nahi diya 😅");
    }
    return;
  }
  await updatePayloadMsg(msgId, { ...st, scores, lastResult, round: st.round + 1, qEndsAt: Date.now() + 20000 });
}

/* ───────── G4 — Number Guess (🎯 1–100 chhupa number) ───────── */
export async function sendNumGuess(chatId: string): Promise<Message | null> {
  const s = getState();
  if (!chatId) return null;
  const active = s.messages.find((m) => {
    if (m.chatId !== chatId || m.type !== "numguess" || m.deleted) return false;
    const p = parsePayload(m);
    return p && !p.done;
  });
  if (active) { toast("Number Guess pehle se chal raha hai", "Khatam hone ka intezar karo"); return null; }
  const state: any = { target: 1 + Math.floor(Math.random() * 100), list: [] as any[], done: false, winner: null, t: "🎯 Number Guess" };
  const cap = JSON.stringify(state);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "numguess", text: state.t, at: Date.now(), reactions: {}, caption: cap };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "numguess",
    text: cap, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Game nahi gaya");
  if (!ok) return null;
  return m;
}
/** text message ko active number guess se milao — sirf 1–100 ka poora number, repeat ignore */
/* ───────── G9 — Brick Breaker (🧱 single-player arcade, payload me best scores) ───────── */
export async function sendBrick(chatId: string): Promise<Message | null> {
  const s = getState();
  if (!chatId) return null;
  const state = { v: 1, scores: {} as Record<string, { name: string; best: number; plays: number }>, t: "🧱 Brick Breaker" };
  const cap = JSON.stringify(state);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "brick", text: state.t, at: Date.now(), reactions: {}, caption: cap };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "brick",
    text: cap, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Game nahi gaya");
  if (!ok) return null;
  return m;
}
/** Apni run ka score jama karo — best sirf barhe ga; plays sirf game-over par +1 */
export async function submitBrickScore(msgId: string, score: number, countPlay: boolean) {
  const s = getState();
  if (!s.me || typeof score !== "number" || !Number.isFinite(score) || score < 0) return;
  const msg = s.messages.find((x) => x.id === msgId && x.type === "brick");
  if (!msg) return;
  const st: any = parsePayload(msg);
  if (!st || st.v !== 1 || !st.scores || typeof st.scores !== "object" || Array.isArray(st.scores)) return;
  const me = s.members.find((x) => x.id === s.me);
  const prev = st.scores[s.me] && typeof st.scores[s.me] === "object" ? st.scores[s.me] : { name: "", best: 0, plays: 0 };
  const entry = {
    name: me?.name || prev.name || "Member",
    best: Math.max(typeof prev.best === "number" ? prev.best : 0, Math.floor(score)),
    plays: (typeof prev.plays === "number" ? prev.plays : 0) + (countPlay ? 1 : 0),
  };
  if (entry.best === prev.best && entry.plays === (prev.plays || 0) && entry.name === prev.name) return;
  await updatePayloadMsg(msgId, { ...st, scores: { ...st.scores, [s.me]: entry } });
}

export async function checkNumGuess(chatId: string, text: string, senderId: string) {
  if (senderId === "system") return;
  const s = getState();
  const candidates = s.messages.filter((m) => m.chatId === chatId && m.type === "numguess" && !m.deleted);
  const r = [...candidates].reverse().find((m) => { const p = parsePayload(m); return p && !p.done; });
  if (!r) return;
  const st: any = parsePayload(r);
  if (!st || st.done) return;
  const trimmed = (text || "").trim();
  if (!/^\d+$/.test(trimmed)) return;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1 || n > 100) return;
  const list: any[] = Array.isArray(st.list) ? [...st.list] : [];
  if (list.some((e: any) => e && e.n === n)) return;
  if (n === st.target) {
    list.push({ n, by: senderId, h: "hit" });
    await updatePayloadMsg(r.id, { ...st, list, done: true, winner: senderId });
    const name = getState().members.find((x) => x.id === senderId)?.name || "Kisi ne";
    postSystem(chatId, `🎯 ${name} ne sahi number ${st.target} guess kar liya — kul ${list.length} guesses me!`);
    return;
  }
  list.push({ n, by: senderId, h: n < st.target ? "up" : "down" });
  await updatePayloadMsg(r.id, { ...st, list });
}

/* ───────── G5 — Kainchi Pathar Kaghaz (✂️ best of 3, 1v1) ───────── */
export async function sendKainchi(chatId: string, opponentId: string): Promise<Message | null> {
  const s = getState();
  if (!chatId || !opponentId) return null;
  if (opponentId === s.me) { toast("Khud ko challenge nahi", "Kisi dost ko chuno"); return null; }
  const oppName = s.members.find((x) => x.id === opponentId)?.name || "member";
  const state: any = { challenger: s.me, opponent: opponentId, accepted: false, score: {} as Record<string, number>, picks: {} as Record<string, string>, last: null, round: 1, done: false, winner: null, t: `✂️ Kainchi Pathar Kaghaz: ${oppName}` };
  const cap = JSON.stringify(state);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "kainchi", text: state.t, at: Date.now(), reactions: {}, caption: cap };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "kainchi",
    text: cap, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Challenge nahi gaya");
  if (!ok) return null;
  return m;
}
export async function acceptKainchi(msgId: string) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st: any = parsePayload(m);
  if (!st || st.accepted || st.opponent !== s.me) return;
  await updatePayloadMsg(msgId, { ...st, accepted: true });
}
export async function kainchiPick(msgId: string, choice: string) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st: any = parsePayload(m);
  if (!st || !st.accepted || st.done) return;
  if (s.me !== st.challenger && s.me !== st.opponent) return;
  const prevPicks: Record<string, string> = { ...((st.picks || {}) as Record<string, string>) };
  if (prevPicks[s.me]) return;
  const picks: Record<string, string> = { ...prevPicks, [s.me]: choice };
  const challenger: string = st.challenger;
  const opponent: string = st.opponent;
  if (!picks[challenger] || !picks[opponent]) {
    await updatePayloadMsg(msgId, { ...st, picks });
    return;
  }
  const r = kainchiResult(picks[challenger], picks[opponent]);
  const last = { a: picks[challenger], b: picks[opponent], w: r === "draw" ? null : (r === "a" ? challenger : opponent) };
  if (r === "draw") {
    await updatePayloadMsg(msgId, { ...st, picks: {}, last });
    return;
  }
  const winId: string = r === "a" ? challenger : opponent;
  const score: Record<string, number> = { ...((st.score || {}) as Record<string, number>) };
  score[winId] = (score[winId] || 0) + 1;
  if (score[winId] >= 2) {
    await updatePayloadMsg(msgId, { ...st, picks, score, last, done: true, winner: winId });
    const name = getState().members.find((x) => x.id === winId)?.name || "Koi";
    postSystem(m.chatId, `✂️ ${name} Kainchi Pathar Kaghaz jeet gaya! 🎉`);
    return;
  }
  await updatePayloadMsg(msgId, { ...st, picks: {}, score, last, round: (typeof st.round === "number" ? st.round : 1) + 1 });
}

/* ───────── G6 — Pasa / Ludo v2 FULL engine (🎲 2–4 players, asal Ludo rules) ─────────
   Token progress: 0=base, 1..52=track, 53..57=home column, 58=finish.
   Rules: 6 par base se bahar + extra bari; teesra lagatar 6 zaya; opponent ki 2+ tokens
   wali cell = block (na guzar sakte ho na land); safe cells par capture nahi; capture /
   goti finish par extra bari (home column me ghusne par NAHI); exact roll par hi finish.
   Bots + 10s turn timer auto-play acting-lock ke sath (ek hi client chalata hai). */
function pasaNameOf(id: string): string {
  return getState().members.find((x) => x.id === id)?.name || pasaBotName(id) || "Koi";
}
function pasaLog(st: PasaStateV2, entries: string[]): string[] {
  return [...(Array.isArray(st.log) ? st.log : []), ...entries].slice(-8);
}
function pasaInitTokens(players: string[], settings: PasaSettings): Record<string, number[]> {
  const tokens: Record<string, number[]> = {};
  for (const p of players) tokens[p] = Array(settings.per).fill(0);
  return tokens;
}
/**
 * Settings normalize: per sirf 1/2/4; tor sirf tab on reh sakta hai jab capture on
 * ho aur per>=2 ho (warna "no home" rule game ko kabhi khatam hi nahi hone dega).
 */
function pasaNormSettings(s: PasaSettings): PasaSettings {
  const per: 1 | 2 | 4 = s && (s.per === 1 || s.per === 2 || s.per === 4) ? s.per : 4;
  const capture = !!(s && s.capture);
  const tor = !!(s && s.tor) && capture && per >= 2;
  return { per, timer: !!(s && s.timer), capture, teams: !!(s && s.teams), tor };
}
function pasaInitKills(players: string[]): Record<string, number> {
  const kills: Record<string, number> = {};
  for (const p of players) kills[p] = 0;
  return kills;
}
/** Bari agle active player ko: leftPlayers wala skip, pasaPlayerDone (saari 58) wala skip.
    Har bari mukammal hone par 4s ka waqfa (pauseUntil) — timer bhi waqfe ke baad
    se ginta hai (turnAt = pauseUntil), taake countdown waqfe me zaya na ho. */
function pasaAdvanceTurn(st: PasaStateV2): PasaStateV2 {
  const n = st.players.length;
  if (n === 0) return st;
  const pauseUntil = Date.now() + PASA_PAUSE_MS;
  const from = st.players.indexOf(st.turn);
  for (let k = 1; k <= n; k++) {
    const cand = st.players[(from + k) % n];
    if (!pasaPlayerDone(st, cand)) {
      return { ...st, turn: cand, phase: "roll", roll: null, sixChain: 0, turnAt: pauseUntil, pauseUntil };
    }
  }
  return { ...st, phase: "roll", roll: null, sixChain: 0, turnAt: pauseUntil, pauseUntil };
}
/** Tourney game khatam hone par tourney message ka slot update karo. */
async function pasaSyncTourneySlot(st: PasaStateV2) {
  if (!st.tourney || !st.done || !st.winner) return;
  const tm = getState().messages.find((x) => x.id === st.tourney!.msgId);
  if (!tm) return;
  const ts = parseTourney(tm.caption);
  if (!ts) return;
  const slot = st.tourney.slot;
  const winner = st.winner;
  const next: TourneyState = {
    ...ts,
    semis: ts.semis.map((sm) => ({ ...sm })),
    final: { ...ts.final },
  };
  if (slot === "semi1") next.semis[0] = { ...next.semis[0], winner };
  else if (slot === "semi2") next.semis[1] = { ...next.semis[1], winner };
  else if (slot === "final") { next.final = { ...next.final, winner }; next.champion = winner; }
  if (next.semis[0].winner && next.semis[1].winner) {
    next.final = { ...next.final, a: next.semis[0].winner, b: next.semis[1].winner };
  }
  await updatePayloadMsg(st.tourney.msgId, next);
}

export async function createPasa(chatId: string, settings: PasaSettings, opts?: { players?: string[]; bots?: Record<string, "easy" | "normal">; started?: boolean; tourney?: { msgId: string; slot: "semi1" | "semi2" | "final" } }): Promise<Message | null> {
  const s = getState();
  if (!chatId) return null;
  const players = opts?.players && opts.players.length > 0 ? [...opts.players] : [s.me];
  const started = !!opts?.started;
  settings = pasaNormSettings(settings);
  const state: PasaStateV2 = {
    v: 2,
    players,
    tokens: pasaInitTokens(players, settings),
    kills: pasaInitKills(players),
    turn: players[0],
    phase: "roll",
    roll: null,
    sixChain: 0,
    settings,
    bots: opts?.bots ? { ...opts.bots } : {},
    host: s.me,
    started,
    log: started ? ["🎲 Ludo shuru!"] : [],
    done: false,
    winner: null,
    leftPlayers: [],
    tourney: opts?.tourney,
    turnAt: Date.now(),
    lastRoll: null,
    t: "🎲 Ludo",
  };
  const cap = JSON.stringify(state);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "pasa", text: state.t, at: Date.now(), reactions: {}, caption: cap };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "pasa",
    text: cap, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Game nahi gaya");
  if (!ok) return null;
  return m;
}
/** Wrapper — purana entry point (Composer): default 4-goti, timer on, capture on, tor on, FFA. */
export async function sendPasa(chatId: string) {
  return createPasa(chatId, { per: 4, timer: true, capture: true, teams: false, tor: true });
}
export async function joinPasa(msgId: string) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st = parsePasaV2(m.caption);
  if (!st || st.started) return; // v1 message par kuch nahi
  if (st.players.includes(s.me) || st.players.length >= 4) return;
  const players = [...st.players, s.me];
  const tokens = { ...st.tokens, [s.me]: Array(st.settings.per).fill(0) };
  await updatePayloadMsg(msgId, { ...st, players, tokens });
}
export async function leavePasa(msgId: string) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st = parsePasaV2(m.caption);
  if (!st || !st.players.includes(s.me)) return;
  if (!st.started) {
    // lobby: bilkul hata do
    const players = st.players.filter((p) => p !== s.me);
    const tokens = { ...st.tokens };
    delete tokens[s.me];
    const bots = { ...st.bots };
    delete bots[s.me];
    await updatePayloadMsg(msgId, { ...st, players, tokens, bots });
    return;
  }
  if (st.done) return;
  // game chal raha hai: left mark karo, tokens hatao
  const tokens = { ...st.tokens };
  delete tokens[s.me];
  let next: PasaStateV2 = {
    ...st,
    tokens,
    leftPlayers: [...(st.leftPlayers || []), s.me],
    log: pasaLog(st, [`🚪 ${pasaNameOf(s.me)} game chor kar chala gaya`]),
  };
  // jeet check: FFA me 1 active bache to wahi winner; teams me ek hi team bache to usi ki jeet
  const active = next.players.filter((p) => !pasaPlayerDone(next, p));
  if (next.settings.teams) {
    if (active.length > 0) {
      const teamOf = (p: string) => next.players.indexOf(p) % 2;
      if (active.every((p) => teamOf(p) === teamOf(active[0]))) {
        next = { ...next, done: true, winner: active[0], log: pasaLog(next, [`🏆 ${pasaNameOf(active[0])} ki team jeet gayi — baaki sab chale gaye! 🎉`]) };
      }
    }
  } else if (active.length === 1) {
    next = { ...next, done: true, winner: active[0], log: pasaLog(next, [`🏆 ${pasaNameOf(active[0])} jeet gaya (baaki sab chale gaye)`]) };
  } else if (active.length === 0) {
    next = { ...next, done: true };
  }
  if (!next.done && next.turn === s.me) {
    next = pasaAdvanceTurn(next);
  }
  await updatePayloadMsg(msgId, next);
  if (next.done) await pasaSyncTourneySlot(next);
}
export async function addBotPasa(msgId: string, level: "easy" | "normal") {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st = parsePasaV2(m.caption);
  if (!st || st.started || st.host !== s.me) return;
  if (st.players.length >= 4) return;
  let n = 1;
  while (st.players.includes(`__bot_${n}`)) n++;
  const botId = `__bot_${n}`;
  const players = [...st.players, botId];
  const tokens = { ...st.tokens, [botId]: Array(st.settings.per).fill(0) };
  const bots = { ...st.bots, [botId]: level };
  await updatePayloadMsg(msgId, { ...st, players, tokens, bots, log: pasaLog(st, [`🤖 Bot ${n} (${level}) shamil ho gaya`]) });
}
export async function updatePasaSettings(msgId: string, patch: Partial<PasaSettings>) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st = parsePasaV2(m.caption);
  if (!st || st.started || st.host !== s.me) return;
  // normalize: capture off ya per=1 ho to tor auto off (warna home kabhi nahi milega)
  const settings: PasaSettings = pasaNormSettings({ ...st.settings, ...patch });
  // per badla to saari tokens naye count se re-init
  const tokens = settings.per !== st.settings.per ? pasaInitTokens(st.players, settings) : st.tokens;
  await updatePayloadMsg(msgId, { ...st, settings, tokens });
}
export async function startPasa(msgId: string) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st = parsePasaV2(m.caption);
  if (!st || st.started || st.host !== s.me) return;
  if (st.players.length < 2) return;
  if (st.settings.teams && st.players.length !== 4) return; // teams = exactly 4
  await updatePayloadMsg(msgId, {
    ...st, started: true, turn: st.players[0], phase: "roll", roll: null, sixChain: 0,
    turnAt: Date.now(), log: pasaLog(st, ["🎲 Ludo shuru ho gaya!"]),
  });
}

/** Internal: dice roll apply karo (phase "roll" par). Illegal ho to null. Turn advance andar hi hota hai jab move na ho / teesra 6 ho. */
function pasaApplyRoll(st: PasaStateV2, playerId: string): PasaStateV2 | null {
  if (!st.started || st.done || st.turn !== playerId || st.phase !== "roll") return null;
  if (pasaPaused(st)) return null; // pichli bari ka 4s waqfa abhi chal raha hai — roll band
  if (pasaPlayerDone(st, playerId)) return null;
  const v = 1 + Math.floor(Math.random() * 6);
  const sc = pasaSixChainAfter(st.sixChain, v);
  const name = pasaNameOf(playerId);
  let next: PasaStateV2 = { ...st, lastRoll: { by: playerId, v } };
  if (sc.forfeited) {
    next = { ...next, sixChain: 0, log: pasaLog(next, [`🎲 ${name} ka teesra 6 — zaya! Bari aage.`]) };
    return pasaAdvanceTurn(next);
  }
  const legal = pasaLegalMoves(next, playerId, v);
  if (legal.length === 0) {
    next = { ...next, sixChain: 0, log: pasaLog(next, [`😴 ${name} ko ${v} aaya — koi move nahi`]) };
    return pasaAdvanceTurn(next);
  }
  // move phase — turnAt NAHI badalte (timer poori bari ke liye hai)
  return { ...next, roll: v, phase: "move", sixChain: sc.chain };
}

/** Internal: token move apply karo (phase "move" par). Illegal ho to null. */
function pasaApplyMove(st: PasaStateV2, playerId: string, tokenIdx: number): PasaStateV2 | null {
  if (!st.started || st.done || st.turn !== playerId || st.phase !== "move" || st.roll === null) return null;
  const roll = st.roll;
  const legal = pasaLegalMoves(st, playerId, roll);
  if (!legal.includes(tokenIdx)) return null;
  const myIdx = st.players.indexOf(playerId);
  if (myIdx < 0) return null;
  const name = pasaNameOf(playerId);
  const toks = [...(st.tokens[playerId] || [])];
  const t = toks[tokenIdx];
  const nt = t === 0 ? 1 : t + roll;
  const entries: string[] = [];
  const tokens: Record<string, number[]> = {};
  for (const p of st.players) tokens[p] = [...(st.tokens[p] || [])];
  let captured = false;
  let killCount = 0;
  if (t === 0) entries.push(`🚪 ${name} ki goti bahar aa gayi`);
  // capture: track cell par, safe na ho, settings.capture on ho
  if (nt >= 1 && nt <= 52 && st.settings.capture) {
    const cell = pasaCell(myIdx, nt);
    if (cell !== null && !PASA_SAFE_CELLS.includes(cell)) {
      st.players.forEach((oppId, oppIdx) => {
        if (!pasaIsOpponent(st, playerId, oppId)) return;
        const oppToks = tokens[oppId];
        if (!oppToks) return;
        let hit = false;
        for (let i = 0; i < oppToks.length; i++) {
          const op = oppToks[i];
          if (op >= 1 && op <= 52 && pasaCell(oppIdx, op) === cell) { oppToks[i] = 0; hit = true; killCount++; }
        }
        if (hit) { captured = true; entries.push(`💥 ${name} ne ${pasaNameOf(oppId)} ki goti maar di!`); }
      });
    }
  }
  toks[tokenIdx] = nt;
  tokens[playerId] = toks;
  // tor ke liye kills record: har mari hui goti +1 (sirf mover ka count barhta hai)
  const kills: Record<string, number> = { ...(st.kills || {}) };
  if (killCount > 0) kills[playerId] = (typeof kills[playerId] === "number" ? kills[playerId] : 0) + killCount;
  const finishedToken = nt === 58;
  if (finishedToken) entries.push(`🏁 ${name} ki ek goti ghar pohch gayi!`);
  let next: PasaStateV2 = { ...st, tokens, kills, roll: null, phase: "roll" };
  // jeet check
  const allHome = toks.length > 0 && toks.every((x) => x === 58);
  if (allHome) {
    if (next.settings.teams) {
      const partner = next.players[(myIdx + 2) % 4];
      if (partner && pasaPlayerDone(next, partner)) {
        next = { ...next, done: true, winner: playerId, log: pasaLog(next, [...entries, `🏆 ${name} ki team Ludo jeet gayi! 🎉`]) };
        return next;
      }
      // apni gotiyan khatam, partner abhi khel raha hai — bari aage (ye player done skip hoga)
      return pasaAdvanceTurn({ ...next, log: pasaLog(next, entries) });
    }
    next = { ...next, done: true, winner: playerId, log: pasaLog(next, [...entries, `🏆 ${name} Ludo jeet gaya! 🎉`]) };
    return next;
  }
  const extra = roll === 6 || captured || finishedToken;
  if (extra) {
    const why = roll === 6 ? "6 aaya" : captured ? "goti maari" : "goti ghar pohchi";
    // extra bari = NAYI bari: pehle 4s waqfa (sab ko move/number dikhe), phir naya roll;
    // turnAt bhi waqfe ke baad se — sixChain sirf tab barqarar jab wajah 6 ho
    const pauseUntil = Date.now() + PASA_PAUSE_MS;
    next = {
      ...next, turnAt: pauseUntil, pauseUntil,
      sixChain: roll === 6 ? st.sixChain : 0,
      log: pasaLog(next, [...entries, `🔁 ${name} ko ek aur bari! (${why})`]),
    };
    return next;
  }
  return pasaAdvanceTurn({ ...next, log: pasaLog(next, entries) });
}

export async function rollPasaDice(msgId: string) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st = parsePasaV2(m.caption);
  if (!st || !st.started || st.done) return;
  if (pasaPaused(st)) return; // pichli bari ka waqfa chal raha hai — abhi roll nahi hoga
  if (st.turn !== s.me || st.phase !== "roll") return;
  if (st.bots[s.me]) return; // bot apni bari khud nahi (host autoPlay chalata hai)
  const next = pasaApplyRoll(st, s.me);
  if (!next) return;
  await updatePayloadMsg(msgId, next);
  if (next.done) await pasaSyncTourneySlot(next);
}
export async function movePasaToken(msgId: string, tokenIdx: number) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st = parsePasaV2(m.caption);
  if (!st || !st.started || st.done) return;
  if (st.turn !== s.me || st.phase !== "move") return;
  if (st.bots[s.me]) return;
  const next = pasaApplyMove(st, s.me, tokenIdx);
  if (!next) return;
  await updatePayloadMsg(msgId, next);
  if (next.done) await pasaSyncTourneySlot(next);
}

/**
 * Bot ki bari (sirf host chalata hai) ya timer-expired insaan ki bari auto chalao.
 * Insaan ki bari 10s (turnAt ke baad — turnAt waqfe ke baad se ginta hai) par har
 * haal me automatic hoti hai: khud player ya host foran chalata hai, un ke offline
 * hone par koi bhi online viewer ~2s grace ke baad lock lekar chala deta hai —
 * game kisi ek ke app par nahi rukta. acting lock: taaza lock (4s) kisi aur ke
 * paas ho to ruk jao (double execution nahi hota).
 */
export async function autoPlayPasa(msgId: string) {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return;
  const st = parsePasaV2(m.caption);
  if (!st || !st.started || st.done) return;
  let p = st.turn;
  if (pasaPlayerDone(st, p)) return;
  if (pasaPaused(st)) return; // waqfe ke doran koi auto-play nahi (turnAt waqfe ke baad set hota hai)
  if (st.acting && Date.now() - st.acting.at < 4000 && st.acting.by !== s.me) return;
  const isBotTurn = !!st.bots[p];
  let timerAuto = false;
  if (isBotTurn) {
    if (s.me !== st.host) return; // bots sirf host chalata hai
  } else {
    // insaan ki bari: timer on + 10s guzar jaye to bari automatic — khud player ya
    // host foran; koi bhi aur online viewer ~2s grace ke baad (lock double rokta hai)
    if (!st.settings.timer || !st.turnAt) return;
    const expiry = st.turnAt + 10000;
    if (Date.now() <= expiry) return;
    if (s.me !== p && s.me !== st.host && Date.now() <= expiry + 2000) return;
    timerAuto = true;
  }
  const lock = { by: s.me, at: Date.now() };
  let last: PasaStateV2 = { ...st, acting: lock };
  await updatePayloadMsg(msgId, last);
  let finished: PasaStateV2 | null = null;
  let acted = false;
  for (let step = 0; step < 12; step++) {
    const fm = getState().messages.find((x) => x.id === msgId);
    const fst = fm ? parsePasaV2(fm.caption) : null;
    if (!fst) break;
    if (fst.done) { last = fst; finished = fst; break; }
    if (fst.turn !== p) {
      if (isBotTurn && fst.bots[fst.turn]) { p = fst.turn; /* agla bot bhi chalao */ }
      else break; // bari khatam / insaan ki bari aa gayi
    }
    if (pasaPlayerDone(fst, fst.turn)) break;
    let ns: PasaStateV2 | null = null;
    let wasMove = false;
    if (fst.phase === "roll") {
      ns = pasaApplyRoll(fst, fst.turn);
    } else if (fst.phase === "move") {
      const level = fst.bots[fst.turn] || "normal";
      const ti = pasaChooseToken(fst, fst.turn, level);
      if (ti < 0) break;
      ns = pasaApplyMove(fst, fst.turn, ti);
      wasMove = true;
    }
    if (!ns) break;
    acted = true;
    last = ns;
    await updatePayloadMsg(msgId, { ...ns, acting: lock });
    if (ns.done) { finished = ns; break; }
    if (!isBotTurn) {
      // insaan-timer: sirf EK poori bari — move ho jaye ya bari aage chali jaye to ruk jao
      // (extra bari mile to wahan bhi rukna hai — waqfe ke baad player khud khelega)
      if (wasMove) break;
      if (ns.turn !== p) break;
      // roll ho gaya, move baqi hai: chhota waqfa taake sab dekh saken kya number aaya,
      // phir SMART move (pasaChooseToken "normal": marna > finish > bahar > aage wali)
      if (ns.phase === "move") await new Promise((r) => setTimeout(r, 900));
    } else {
      await new Promise((r) => setTimeout(r, 1000)); // log dekhne ke liye bot steps me waqfa
    }
  }
  if (timerAuto && acted) {
    last = { ...last, log: pasaLog(last, [`⏰ ${pasaNameOf(p)} ki bari time par automatic ho gayi`]) };
  }
  await updatePayloadMsg(msgId, { ...last, acting: undefined });
  if (finished) await pasaSyncTourneySlot(finished);
}

export async function rematchPasa(msgId: string): Promise<Message | null> {
  const s = getState();
  const m = s.messages.find((x) => x.id === msgId);
  if (!m) return null;
  const st = parsePasaV2(m.caption);
  if (!st || !st.done || !st.players.includes(s.me)) return null;
  const nm = await createPasa(m.chatId, st.settings, { players: st.players, bots: st.bots, started: true });
  if (!nm) return null;
  const nst = parsePasaV2(nm.caption);
  if (nst) await updatePayloadMsg(nm.id, { ...nst, log: ["🔁 Rematch — naya match shuru!"] });
  return nm;
}

/* ───────── G7 — Ludo Tournament (🏆 4 players, 2 semi + final) ───────── */
export async function createTournament(chatId: string, playerIds: string[]): Promise<Message | null> {
  const s = getState();
  if (!chatId || !Array.isArray(playerIds) || playerIds.length !== 4) return null;
  const state: TourneyState = {
    players: [...playerIds],
    semis: [
      { a: playerIds[0], b: playerIds[1], gameId: null, winner: null },
      { a: playerIds[2], b: playerIds[3], gameId: null, winner: null },
    ],
    final: { a: null, b: null, gameId: null, winner: null },
    champion: null,
    host: s.me,
    t: "🏆 Ludo Tournament",
  };
  const cap = JSON.stringify(state);
  const m: Message = { id: uid("m"), from: s.me, chatId, type: "tourney" as any, text: state.t, at: Date.now(), reactions: {}, caption: cap };
  const ok = await insertMessageRow(m, {
    id: m.id, chat_id: chatId, sender_id: m.from, type: "tourney",
    text: cap, media_url: "", reply_to: null, created_at: m.at, read_by: [],
  }, "Tournament nahi bana");
  if (!ok) return null;
  return m;
}
export async function startTourneyGame(tourneyMsgId: string, slot: "semi1" | "semi2" | "final") {
  const s = getState();
  const tm = s.messages.find((x) => x.id === tourneyMsgId);
  if (!tm) return;
  const ts = parseTourney(tm.caption);
  if (!ts || ts.host !== s.me) return;
  let a: string | null = null;
  let b: string | null = null;
  let existingGameId: string | null = null;
  if (slot === "semi1") { a = ts.semis[0].a; b = ts.semis[0].b; existingGameId = ts.semis[0].gameId; }
  else if (slot === "semi2") { a = ts.semis[1].a; b = ts.semis[1].b; existingGameId = ts.semis[1].gameId; }
  else { a = ts.final.a; b = ts.final.b; existingGameId = ts.final.gameId; }
  if (!a || !b || existingGameId) return;
  const game = await createPasa(tm.chatId, { per: 2, timer: false, capture: true, teams: false, tor: false }, { players: [a, b], started: true, tourney: { msgId: tourneyMsgId, slot } });
  if (!game) return;
  const next: TourneyState = { ...ts, semis: ts.semis.map((sm) => ({ ...sm })), final: { ...ts.final } };
  if (slot === "semi1") next.semis[0] = { ...next.semis[0], gameId: game.id };
  else if (slot === "semi2") next.semis[1] = { ...next.semis[1], gameId: game.id };
  else next.final = { ...next.final, gameId: game.id };
  await updatePayloadMsg(tourneyMsgId, next);
}
export async function syncTournament(tourneyMsgId: string) {
  const tm = getState().messages.find((x) => x.id === tourneyMsgId);
  if (!tm) return;
  const ts = parseTourney(tm.caption);
  if (!ts) return;
  const pullWinner = (gameId: string | null): string | null => {
    if (!gameId) return null;
    const gm = getState().messages.find((x) => x.id === gameId);
    if (!gm) return null;
    const gs = parsePasaV2(gm.caption);
    return gs && gs.done && gs.winner ? gs.winner : null;
  };
  let changed = false;
  const next: TourneyState = { ...ts, semis: ts.semis.map((sm) => ({ ...sm })), final: { ...ts.final } };
  next.semis = next.semis.map((sm) => {
    if (sm.winner) return sm;
    const w = pullWinner(sm.gameId);
    if (w) { changed = true; return { ...sm, winner: w }; }
    return sm;
  });
  if (next.semis[0].winner && next.semis[1].winner && (next.final.a !== next.semis[0].winner || next.final.b !== next.semis[1].winner)) {
    next.final = { ...next.final, a: next.semis[0].winner, b: next.semis[1].winner };
    changed = true;
  }
  if (!next.final.winner) {
    const w = pullWinner(next.final.gameId);
    if (w) { next.final = { ...next.final, winner: w }; changed = true; }
  }
  if (next.final.winner && next.champion !== next.final.winner) {
    next.champion = next.final.winner;
    changed = true;
  }
  if (changed) await updatePayloadMsg(tourneyMsgId, next);
}
