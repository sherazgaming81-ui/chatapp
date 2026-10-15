"use client";
// Tiny external store (like zustand). UI reads with useStore(selector); only api.ts writes via update().
import { useRef, useSyncExternalStore } from "react";
import type { State } from "./types";
import { createSeed } from "./seed";

const KEY = "chatsapp:v1";
let state: State = createSeed();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

export const getState = () => state;

export function update(fn: (s: State) => Partial<State> | void) {
  const patch = fn(state);
  if (patch) state = { ...state, ...patch };
  subs.forEach((f) => f());
  schedulePersist();
}

/** Bulk-replace state (real backend load). Notifies all subscribers. */
export function replaceState(patch: Partial<State>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
  schedulePersist();
}

function shallowEq(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };

/** Selector hook. Selectors may return fresh arrays/objects (filter/map) — results are shallow-cached. */
export function useStore<T>(sel: (s: State) => T): T {
  const ref = useRef<{ v: T } | null>(null);
  const get = () => {
    const v = sel(state);
    if (ref.current && shallowEq(ref.current.v, v)) return ref.current.v;
    ref.current = { v };
    return v;
  };
  return useSyncExternalStore(subscribe, get, get);
}

function strip(s: State, heavy = false) {
  const ui = { ...s.ui, toasts: [], typing: [], azaan: null, achievement: null, remoteOverlay: null, changelog: false, syncing: false };
  const messages = heavy ? s.messages.map((m) => (m.src && m.src.length > 150000 ? { ...m, src: "" } : m)) : s.messages;
  return { ...s, ui, messages, nav: { tab: s.nav.tab, stack: [] }, quranCache: heavy ? {} : s.quranCache };
}

function schedulePersist() {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(strip(state))); }
    catch { try { localStorage.setItem(KEY, JSON.stringify(strip(state, true))); } catch { /* quota */ } }
  }, 350);
}

export function hydrate() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as State;
      const seed = createSeed();
      state = { ...seed, ...saved, settings: { ...seed.settings, ...saved.settings }, onboarding: { ...seed.onboarding, ...saved.onboarding }, owner: { ...seed.owner, ...saved.owner }, ui: { ...seed.ui, offline: false }, nav: { tab: saved.nav?.tab ?? "chat", stack: [] } };
    }
  } catch { /* ignore corrupt */ }
  subs.forEach((f) => f());
}

export const storageKey = KEY;
