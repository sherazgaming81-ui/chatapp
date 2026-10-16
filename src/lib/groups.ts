"use client";
// Group management: create/delete groups + direct DMs.
// Apni file me hai taake parallel kaam me conflict na ho.
import { supabase, MAIN_GROUP_ID } from "./supabase";
import { getState, update, patchUI, toast } from "./store";
import type { ChatMeta } from "./types";

const sb = () => supabase();
const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;

/* ───────── CREATE GROUP ───────── */
export async function createGroup(name: string, desc: string, memberIds: string[]): Promise<string | null> {
  const s = getState();
  const meId = s.me;
  const clean = name.trim();
  if (!clean || !meId) return null;
  try {
    // 1. chats me naya group
    const { data: chat, error: cErr } = await sb()
      .from("chats")
      .insert({ id: rid(), type: "group", name: clean, photo_url: "", is_main_group: false })
      .select("id")
      .single();
    if (cErr || !chat) throw cErr || new Error("no chat");
    const chatId = chat.id as string;

    // 2. description group_settings me (existing D1 pattern)
    if (desc.trim()) {
      try { await sb().from("group_settings").upsert({ key: `desc_${chatId}`, value: desc.trim() }); } catch { /* ignore */ }
    }

    // 3. participants: owner + selected members
    const ids = [...new Set([meId, ...memberIds])];
    try {
      await sb().from("chat_participants").insert(ids.map((uid) => ({ chat_id: chatId, user_id: uid })));
    } catch { /* kuch pehle se hon to ignore */ }

    // 4. store me add + navigate
    const meta: ChatMeta = { id: chatId, type: "group", name: clean, photo: "", lastAt: Date.now() };
    const cur = getState();
    update({
      chats: [...cur.chats, meta],
      groupDescs: desc.trim() ? { ...cur.groupDescs, [chatId]: desc.trim() } : cur.groupDescs,
    });
    patchUI({ tab: "chat", activeChatId: chatId, replyTo: null, mobileDrawer: "none", createGroupOpen: false, groupInfo: { chatId, view: "info" } });
    toast("Group ban gaya 🎉", clean);
    return chatId;
  } catch (e) {
    toast("Group nahi bana", "Internet check karke dobara koshish karo");
    return null;
  }
}

/* ───────── DELETE GROUP (owner only, main group kabhi nahi) ───────── */
export async function deleteGroup(chatId: string): Promise<boolean> {
  const s = getState();
  if (!chatId || chatId === MAIN_GROUP_ID) return false;
  const me = s.members.find((m) => m.id === s.me);
  if (me?.role !== "owner") { toast("Sirf owner delete kar sakta hai"); return false; }
  try {
    // order: participants → messages → settings → chats
    try { await sb().from("chat_participants").delete().eq("chat_id", chatId); } catch { /* ignore */ }
    try { await sb().from("messages").delete().eq("chat_id", chatId); } catch { /* ignore */ }
    try {
      await sb().from("group_settings").delete().like("key", `%_${chatId}`);
    } catch { /* ignore */ }
    const { error } = await sb().from("chats").delete().eq("id", chatId);
    if (error) throw error;

    // store cleanup
    const cur = getState();
    const pins = { ...cur.pins }; delete pins[chatId];
    const groupRules = { ...cur.groupRules }; delete groupRules[chatId];
    const groupDescs = { ...cur.groupDescs }; delete groupDescs[chatId];
    update({
      chats: cur.chats.filter((c) => c.id !== chatId),
      messages: cur.messages.filter((m) => m.chatId !== chatId),
      pins, groupRules, groupDescs,
    });
    patchUI({ groupInfo: null, tab: "chat", activeChatId: MAIN_GROUP_ID || cur.chats.find((c) => c.id !== chatId)?.id || null });
    toast("Group delete ho gaya 🗑️");
    return true;
  } catch {
    toast("Delete nahi hua", "Dobara koshish karo");
    return false;
  }
}

/* ───────── DIRECT DM ───────── */
export async function openDM(otherId: string): Promise<void> {
  const s = getState();
  const meId = s.me;
  if (!otherId || otherId === meId) return;
  const other = s.members.find((m) => m.id === otherId);

  // 1. store me existing DM?
  const existing = s.chats.find((c) => c.type === "dm" && c.otherId === otherId);
  if (existing) {
    patchUI({ tab: "chat", activeChatId: existing.id, replyTo: null, mobileDrawer: "none", profileId: null, groupInfo: null });
    return;
  }

  // 2. Supabase me shared DM dhoondo
  try {
    const { data: myParts } = await sb().from("chat_participants").select("chat_id").eq("user_id", meId);
    const myIds = (myParts || []).map((p: any) => p.chat_id);
    if (myIds.length > 0) {
      const { data: shared } = await sb().from("chat_participants").select("chat_id").eq("user_id", otherId).in("chat_id", myIds);
      const sharedIds = (shared || []).map((p: any) => p.chat_id);
      if (sharedIds.length > 0) {
        const { data: dmChats } = await sb().from("chats").select("id,name,photo_url").eq("type", "dm").in("id", sharedIds).limit(1);
        if (dmChats && dmChats.length > 0) {
          const dc = dmChats[0] as any;
          const meta: ChatMeta = { id: dc.id, type: "dm", name: other?.name || dc.name || "Chat", photo: other?.avatar || dc.photo_url || "", otherId, lastAt: Date.now() };
          const cur = getState();
          if (!cur.chats.some((c) => c.id === dc.id)) update({ chats: [...cur.chats, meta] });
          patchUI({ tab: "chat", activeChatId: dc.id, replyTo: null, mobileDrawer: "none", profileId: null, groupInfo: null });
          return;
        }
      }
    }
  } catch { /* neeche create karo */ }

  // 3. nayi DM banao
  try {
    const { data: chat, error } = await sb()
      .from("chats")
      .insert({ id: rid(), type: "dm", name: other?.name || "Chat", photo_url: other?.avatar || "", is_main_group: false })
      .select("id")
      .single();
    if (error || !chat) throw error || new Error("no chat");
    const chatId = chat.id as string;
    try {
      await sb().from("chat_participants").insert([
        { chat_id: chatId, user_id: meId },
        { chat_id: chatId, user_id: otherId },
      ]);
    } catch { /* ignore */ }
    const meta: ChatMeta = { id: chatId, type: "dm", name: other?.name || "Chat", photo: other?.avatar || "", otherId, lastAt: Date.now() };
    const cur = getState();
    update({ chats: [...cur.chats, meta] });
    patchUI({ tab: "chat", activeChatId: chatId, replyTo: null, mobileDrawer: "none", profileId: null, groupInfo: null });
    toast("DM khul gayi 💬", other?.name || "");
  } catch {
    toast("DM nahi khuli", "Internet check karke dobara koshish karo");
  }
}
