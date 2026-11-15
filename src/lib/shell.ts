"use client";
// Global shell preferences — desktop sidebar collapse state (localStorage).
// Mobile par is ka koi asar nahi (bottom nav + drawers alag hain).
import { useSyncExternalStore } from "react";

const KEY = "chatsapp:sidebar:collapsed";

let collapsed = false;
let inited = false;
const listeners = new Set<() => void>();

function read() {
  if (inited) return;
  inited = true;
  try {
    collapsed = localStorage.getItem(KEY) === "1";
  } catch { /* ignore */ }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot() {
  read();
  return collapsed;
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function setSidebarCollapsed(v: boolean) {
  collapsed = v;
  inited = true;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
