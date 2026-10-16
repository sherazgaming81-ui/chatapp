"use client";
// Minimal reactive store — no dependencies.
import { useSyncExternalStore } from "react";
import type { State, UIState } from "./types";

const initialUI: UIState = {
  tab: "chat",
  activeChatId: null,
  toasts: [],
  typing: [],
  replyTo: null,
  profileId: null,
  showMembers: true,
  mobileDrawer: "none",
  confirmBan: null,
  editingMsg: null,
  infoMsg: null,
  viewer: null,
  starredOpen: false,
  asmaOpen: false,
  groupInfo: null,
  globalSearchOpen: false,
  jumpToMsg: null,
};

let state: State = {
  me: "",
  session: false,
  loading: true,
  members: [],
  messages: [],
  chats: [],
  pins: {},
  starred: [],
  groupRules: {},
  groupDescs: {},
  ui: { ...initialUI },
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function getState(): State {
  return state;
}

export function update(patch: Partial<State> | ((s: State) => Partial<State>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  emit();
}

export function patchUI(patch: Partial<UIState>) {
  state = { ...state, ui: { ...state.ui, ...patch } };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state), () => sel(state));
}

let toastSeq = 0;
export function toast(title: string, body = "") {
  const id = `t${++toastSeq}`;
  patchUI({ toasts: [...state.ui.toasts, { id, title, body }] });
  setTimeout(() => patchUI({ toasts: state.ui.toasts.filter((t) => t.id !== id) }), 3200);
}
