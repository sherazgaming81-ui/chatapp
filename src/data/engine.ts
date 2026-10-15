"use client";
// ───────── ChatsApp engine — REAL backend edition ─────────
// Local schedulers (ticks UI, expiry, scheduled msgs, polls, azaan) stay local.
// Presence / typing / incoming messages come from Supabase Realtime
// via src/data/supabase.ts startRealtime().
import { getState, update } from "./store";
import { startRealtime, dbTouchPresence, reloadMembers } from "./supabase";
import { addAlert, detectUpdate, flushQueue, getLocation, isStaff, me, receiveMessage, remoteChannel, sendMessage, toast, triggerAzaan, burstConfetti, patchSettings, dndActive } from "./api";
import { PRAYER_NAMES, isEidDay, prayerTimes, type PrayerKey } from "./deen";
import { uid, inWindow } from "@/lib/util";
import type { Message } from "./types";

let started = false;
let rt: { stop: () => void; sendTyping: () => void } | null = null;

export function startEngine() {
  if (started) return () => {};
  started = true;
  remoteChannel();
  const ivs: ReturnType<typeof setInterval>[] = [];
  const tos: ReturnType<typeof setTimeout>[] = [];
  const shownAzaan = new Set<string>(), shownDhikr = new Set<string>();

  // ── Supabase Realtime: messages, presence, typing, moderation ──
  rt = startRealtime({
    onMessage: (m: Message) => {
      // insert into store (skip if already present — optimistic echo)
      const s = getState();
      if (s.messages.some((x) => x.id === m.id)) return;
      const sender = s.members.find((x) => x.id === m.from);
      if (sender?.banned || s.blocked.includes(m.from)) return;
      update((st) => ({ messages: [...st.messages, m] }));
      const st2 = getState();
      const inChat = st2.nav.tab === "chat" && st2.nav.stack.length === 0 && typeof document !== "undefined" && document.visibilityState === "visible";
      if (!inChat && !st2.settings.groupMute && !dndActive()) {
        const body = m.type === "text" ? m.text ?? "" : m.type === "image" ? "📷 Photo" : m.type === "voice" ? "🎙️ Voice note" : "Naya message";
        const nm = st2.members.find((x) => x.id === m.from)?.name || "Koi";
        toast(nm, body, "msg");
      }
    },
    onMessageUpdate: (m: Message) => {
      update((st) => ({ messages: st.messages.map((x) => (x.id === m.id ? { ...x, ...m } : x)) }));
    },
    onPresence: (ids: string[]) => {
      update((st) => ({ members: st.members.map((m) => ({ ...m, online: ids.includes(m.id) })) }));
    },
    onTyping: (userId: string) => {
      update((st) => ({ ui: { ...st.ui, typing: [userId] } }));
      setTimeout(() => update((s2) => ({ ui: { ...s2.ui, typing: s2.ui.typing.filter((t) => t !== userId) } })), 3500);
    },
    onModeration: async () => {
      // someone was muted/banned/warned → refresh member list (light)
      await reloadMembers();
    },
  });

  // expose typing sender for Composer
  (window as any).__sendTyping = () => rt?.sendTyping();

  // 1s tick: local tick progression, expiry, scheduled, polls, queue
  ivs.push(setInterval(() => {
    const s = getState(), now = Date.now();
    let changed = false;
    const msgs = s.messages.map((m) => {
      if (m.from !== s.me || m.status === "queued" || m.status === "read") return m;
      const age = now - m.at;
      if (m.status === "sent" && age > 1400 && !s.ui.offline) { changed = true; return { ...m, status: "delivered" as const }; }
      return m;
    });
    const alive = msgs.filter((m) => !m.expiresAt || m.expiresAt > now);
    if (changed || alive.length !== msgs.length) update(() => ({ messages: alive }));
    const due = s.scheduled.filter((x) => x.at <= now);
    if (due.length) {
      update((st) => ({ scheduled: st.scheduled.filter((x) => x.at > now) }));
      due.forEach((d) => sendMessage(d.kind === "announcement" ? { type: "announcement", title: "Elaan", text: d.text } : { type: "text", text: d.text }, { skipChecks: true }));
      toast("Schedule message gaya", due[0].text.slice(0, 50), "info");
    }
    s.messages.forEach((m) => {
      if (m.poll && m.poll.closesAt && !m.poll.closed && m.poll.closesAt <= now) {
        update((st) => ({ messages: st.messages.map((x) => (x.id === m.id && x.poll ? { ...x, poll: { ...x.poll, closed: true } } : x)) }));
      }
    });
    if (s.members.some((m) => typeof m.mutedUntil === "number" && m.mutedUntil <= now)) update((st) => ({ members: st.members.map((m) => (typeof m.mutedUntil === "number" && m.mutedUntil <= now ? { ...m, mutedUntil: undefined } : m)) }));
    if (!s.ui.offline && s.messages.some((m) => m.status === "queued")) flushQueue();
    const day = new Date().toDateString();
    if (s.stats.lastDay !== day) update((st) => ({ stats: { streak: st.stats.streak + 1, lastDay: day } }));
  }, 1000));

  // update detector (owner)
  tos.push(setTimeout(() => { try { if (me().role === "owner") detectUpdate(); } catch { /* ignore */ } }, 50000));
  ivs.push(setInterval(() => { try { if (me().role === "owner") detectUpdate(); } catch { /* ignore */ } }, 120000));

  // prayers, dhikr, night schedule, eid
  const minute = () => {
    const s = getState(), now = new Date();
    const l = getLocation(), t = prayerTimes(now, l.lat, l.lng);
    (["fajr", "dhuhr", "asr", "maghrib", "isha"] as PrayerKey[]).forEach((k) => {
      const key = now.toDateString() + k, diff = now.getTime() - t[k].getTime();
      if (diff >= 0 && diff < 90e3 && !shownAzaan.has(key) && !dndActive()) { shownAzaan.add(key); triggerAzaan(PRAYER_NAMES[k]); }
    });
    s.settings.dhikr.forEach((d) => {
      const [h, m] = d.time.split(":").map(Number);
      const key = now.toDateString() + d.id;
      if (d.on && now.getHours() === h && now.getMinutes() === m && !shownDhikr.has(key) && !dndActive()) { shownDhikr.add(key); toast("Dhikr ka waqt", d.label, "info", 7000); }
    });
    const ns = s.settings.nightSchedule;
    if (ns.on) {
      const night = inWindow(ns.from, ns.to, now);
      const want = night ? "dark" : "light";
      if (s.settings.theme !== want && s.settings.theme !== "amoled") patchSettings({ theme: want });
    }
  };
  ivs.push(setInterval(minute, 20000));
  tos.push(setTimeout(minute, 3000));
  if (isEidDay() || getState().settings.eid) tos.push(setTimeout(() => burstConfetti(), 4500));
  void addAlert; void isStaff; void uid;

  return () => { ivs.forEach(clearInterval); tos.forEach(clearTimeout); rt?.stop(); rt = null; started = false; };
}

// re-export for components that need it
export function notifyTyping() { try { (window as any).__sendTyping?.(); } catch { /* ignore */ } }
export { dbTouchPresence };
