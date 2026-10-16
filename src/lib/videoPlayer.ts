"use client";
// ─────────────────────────────────────────────────────────────
// Asma-ul-Husna video — APP-LEVEL singleton player.
// Ek hi <video> element poori app me. Kabhi unmount nahi hota,
// isliye tab switch ya AsmaPlayer close par video NA rukti hai
// NA restart hoti hai. Position localStorage me save → hamesha resume.
// ─────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react";
import confetti from "canvas-confetti";
import { toast } from "@/lib/store";

export const VIDEO_SRC = "/video/asma-ul-husna.mp4"; // offline bundled
export const VIDEO_POSTER = "/video/asma-poster.jpg";
const POS_KEY = "chatsapp:asma:vpos";
const SAVE_EVERY_MS = 3000;

export interface VideoSnapshot {
  started: boolean; // user ne kabhi play dabaya
  playing: boolean;
  pos: number;      // seconds
  dur: number;      // seconds
  muted: boolean;
  err: boolean;
  ended: boolean;
}

let videoEl: HTMLVideoElement | null = null;
let snap: VideoSnapshot = { started: false, playing: false, pos: 0, dur: 0, muted: false, err: false, ended: false };
const listeners = new Set<() => void>();
const wired = new WeakSet<HTMLVideoElement>();

/* portal target — AsmaPlayer ka video frame jab video tab open ho */
let slot: HTMLElement | null = null;
const slotListeners = new Set<() => void>();

function emit() { listeners.forEach((l) => { try { l(); } catch { /* ignore */ } }); }
function emitSlot() { slotListeners.forEach((l) => { try { l(); } catch { /* ignore */ } }); }

/* ───────── React bindings ───────── */
export function subscribeVideo(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function getVideoSnapshot(): VideoSnapshot { return snap; }
export function useVideo(): VideoSnapshot { return useSyncExternalStore(subscribeVideo, getVideoSnapshot); }

export function subscribeVideoSlot(l: () => void) { slotListeners.add(l); return () => { slotListeners.delete(l); }; }
export function getVideoSlot(): HTMLElement | null { return slot; }
export function useVideoSlot(): HTMLElement | null { return useSyncExternalStore(subscribeVideoSlot, getVideoSlot); }
export function setVideoSlot(el: HTMLElement | null) { if (slot !== el) { slot = el; emitSlot(); } }

/* video khatam hone par — AsmaPlayer achievement popup ke liye */
const endedCbs = new Set<() => void>();
export function onVideoEnded(cb: () => void) { endedCbs.add(cb); return () => { endedCbs.delete(cb); }; }

/* ───────── position persistence ───────── */
function readSaved(): { pos: number; dur: number } | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as { pos: number; dur: number };
    if (typeof d.pos !== "number" || typeof d.dur !== "number") return null;
    if (d.pos < 10 || d.dur <= 0 || d.pos >= d.dur * 0.95) return null;
    return d;
  } catch { return null; }
}
/** Continue-watching card ke liye */
export function getSavedProgress(): { pos: number; dur: number } | null { return readSaved(); }

let lastSave = 0;
function savePos(force = false) {
  const el = videoEl;
  if (!el) return;
  const now = Date.now();
  if (!force && now - lastSave < SAVE_EVERY_MS) return;
  lastSave = now;
  try {
    const pos = el.currentTime, dur = el.duration || 0;
    if (dur > 0 && pos > 5 && pos < dur - 5) {
      localStorage.setItem(POS_KEY, JSON.stringify({ pos, dur }));
    }
  } catch { /* ignore */ }
}
function clearPos() { try { localStorage.removeItem(POS_KEY); } catch { /* ignore */ } lastSave = 0; }
function restorePos() {
  const el = videoEl;
  if (!el || el.readyState < 1) return;
  const s = readSaved();
  if (s && Math.abs(el.currentTime - s.pos) > 2) {
    try { el.currentTime = Math.min(s.pos, (el.duration || s.dur) - 2); } catch { /* ignore */ }
    snap = { ...snap, pos: el.currentTime };
  }
}

/* ───────── attach (VideoStage se ek dafa) ───────── */
export function attachVideo(el: HTMLVideoElement) {
  videoEl = el;
  if (wired.has(el)) return;
  wired.add(el);

  el.addEventListener("loadedmetadata", () => {
    snap = { ...snap, dur: el.duration || 0 };
    restorePos(); // ★ hamesha resume — kabhi shuru se nahi
    emit();
  });
  el.addEventListener("timeupdate", () => {
    snap = { ...snap, pos: el.currentTime };
    savePos();
    emit();
  });
  el.addEventListener("play", () => { snap = { ...snap, playing: true, ended: false }; emit(); });
  el.addEventListener("pause", () => {
    // ended par pause bhi fire hota hai — wahan alag handle hota hai
    if (!el.ended) { snap = { ...snap, playing: false }; savePos(true); emit(); }
  });
  el.addEventListener("ended", () => {
    clearPos();
    snap = { ...snap, playing: false, pos: 0, ended: true };
    emit();
    // 🎉 celebration — canvas-confetti (poori screen par, AsmaPlayer closed ho tab bhi)
    try {
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.55 }, colors: ["#d4af37", "#0e6b4a", "#ffffff", "#ffd76a"] });
      window.setTimeout(() => {
        try { confetti({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: ["#d4af37", "#0e6b4a"] }); } catch { /* ignore */ }
        try { confetti({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: ["#d4af37", "#0e6b4a"] }); } catch { /* ignore */ }
      }, 350);
    } catch { /* ignore */ }
    toast("🎉 MashaAllah! Mukammal!", "99 naam poori video me sun liye ✨");
    try {
      const raw = localStorage.getItem("chatsapp:asma:achv");
      const cur = raw ? (JSON.parse(raw) as string[]) : [];
      if (!cur.includes("mukammal")) localStorage.setItem("chatsapp:asma:achv", JSON.stringify([...cur, "mukammal"]));
    } catch { /* ignore */ }
    endedCbs.forEach((cb) => { try { cb(); } catch { /* ignore */ } });
  });
  el.addEventListener("error", () => { snap = { ...snap, err: true }; emit(); });
}

/* ───────── controls ───────── */
export function videoPlay() {
  const el = videoEl;
  if (!el) return;
  if (!snap.started || snap.ended) snap = { ...snap, started: true, ended: false, err: false };
  if (el.readyState >= 1) restorePos();
  el.play().catch(() => { snap = { ...snap, err: true }; emit(); });
  emit();
}
export function videoPause() { try { videoEl?.pause(); } catch { /* ignore */ } }
export function videoToggle() {
  const el = videoEl;
  if (!el) return;
  if (!snap.started || snap.ended) { videoPlay(); return; }
  if (el.paused) videoPlay(); else videoPause();
}
export function videoStop() {
  const el = videoEl;
  if (el) { try { el.pause(); el.currentTime = 0; } catch { /* ignore */ } }
  clearPos();
  snap = { ...snap, playing: false, pos: 0, started: false, ended: false };
  emit();
}
export function videoSeekFrac(frac: number) {
  const el = videoEl;
  if (!el || !snap.dur) return;
  try { el.currentTime = Math.min(0.999, Math.max(0, frac)) * snap.dur; } catch { /* ignore */ }
  snap = { ...snap, pos: el.currentTime };
  savePos(true);
  emit();
}
export function videoSkip(sec: number) {
  const el = videoEl;
  if (!el || !snap.dur) return;
  try { el.currentTime = Math.min(Math.max(0, el.currentTime + sec), Math.max(0, snap.dur - 0.5)); } catch { /* ignore */ }
  snap = { ...snap, pos: el.currentTime };
  savePos(true);
  emit();
}
export function videoToggleMute() {
  const el = videoEl;
  if (!el) return;
  el.muted = !el.muted;
  snap = { ...snap, muted: el.muted };
  emit();
}

export function fmtVideoTime(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
