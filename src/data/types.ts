// ───────── ChatsApp data contracts ─────────
// Backend developer: these map 1:1 to tables / rows in Supabase.

export type Role = "owner" | "admin" | "mod" | "member";
export type Aud = "everyone" | "members" | "nobody";
export type ThemeMode = "dark" | "light" | "amoled";

export interface ProfileStyle {
  banner: string; // banner id
  effect: string; // effect id
  frame: string; // avatar frame id
  nameStyle: string; // name style id
  accent: string; // hex
  badges: string[];
}

export interface Warn { id: string; reason: string; at: number }

export interface Member {
  id: string;
  name: string;
  nickname?: string;
  about: string;
  role: Role;
  online: boolean;
  lastSeen: number;
  joined: number;
  color: string;
  avatar?: string; // data url / http url
  mutedUntil: number | null | undefined; // null => forever
  banned: boolean;
  warns: Warn[];
  phone: string;
  tone: string;
  version: string;
  style: ProfileStyle;
}

export type MsgType =
  | "text" | "voice" | "image" | "video" | "doc" | "location" | "contact"
  | "poll" | "sticker" | "gif" | "videonote" | "announcement" | "system" | "cmd";

export interface PollOption { id: string; text: string; img?: string }
export interface Poll {
  q: string;
  options: PollOption[];
  votes: Record<string, string[]>; // userId -> optionIds
  multi: boolean;
  anonymous: boolean;
  closesAt?: number;
  closed?: boolean;
}

export interface Message {
  id: string;
  from: string;
  chatId: string;
  type: MsgType;
  text?: string;
  at: number;
  status: "queued" | "sent" | "delivered" | "read";
  replyTo?: string;
  edited?: boolean;
  forwarded?: boolean;
  starred?: boolean;
  pinned?: boolean;
  deleted?: boolean;
  reactions: Record<string, string[]>; // emoji -> userIds
  expiresAt?: number;
  readBy?: { id: string; at: number }[];
  src?: string; // media / sticker / gif / voice / videonote source
  caption?: string;
  dur?: number; // voice / video seconds
  peaks?: number[];
  size?: number; // bytes
  fileName?: string;
  loc?: { lat: number; lng: number; label: string };
  contact?: { name: string; phone: string };
  poll?: Poll;
  downloaded?: boolean;
  cmd?: string;
  title?: string;
}

export interface Scheduled { id: string; text: string; at: number; kind: "msg" | "announcement" }
export interface CustomCommand { id: string; name: string; desc: string; reply: string; uses: number }
export interface Invite { id: string; code: string; createdAt: number; expiresAt: number | null; uses: number; max: number | null; revoked: boolean }
export interface AuditEntry { id: string; at: number; by: string; action: string; target?: string; kind: string }
export interface AdminAlert { id: string; at: number; text: string; kind: string; seen: boolean }
export interface CmdLog { id: string; at: number; by: string; cmd: string }
export interface StickerPack { id: string; name: string; icon: string; stickers: string[]; custom?: boolean; builtin?: boolean }

export interface ReloadEntry { userId: string; status: "pending" | "done" | "failed"; at: number }
export interface ReloadJob { id: string; at: number; by: string; scope: "all" | "user"; message: string; entries: ReloadEntry[]; kind: "reload" | "push"; version?: string }
export interface HistoryEntry { id: string; at: number; by: string; kind: "reload" | "push"; version: string; scope: string; note?: string }
export interface Rollout { version: string; stage: 0 | 10 | 50 | 100; updated: string[]; message: string }

export interface Room {
  id: string; title: string; host: string; live: boolean; startsAt?: number; remind?: boolean;
  speakers: string[]; listeners: string[]; hands: string[]; mutedSp: string[];
}

export interface Settings {
  theme: ThemeMode;
  compact: boolean;
  wallpaper: string;
  customWallpaper?: string;
  wallDim: number;
  chatTheme: string;
  nightSchedule: { on: boolean; from: string; to: string };
  disappearing: number; // ms, 0 = off
  mute: { on: boolean; until: number | null };
  privacy: { lastSeen: Aud; photo: Aud; about: Aud; online: Aud };
  appLock: { on: boolean; pin: string };
  dnd: { on: boolean; from: string; to: string };
  quality: "auto" | "best" | "saver";
  autoDl: Record<"photos" | "videos" | "docs", { wifi: boolean; mobile: boolean }>;
  haptics: boolean;
  dhikr: { id: string; time: string; label: string; on: boolean }[];
  ramadan: { mode: "auto" | "on" | "off"; start: string };
  eid: boolean;
  nickname: string;
  notif: boolean;
  tones: Record<string, string>;
  groupMute: boolean;
}

export interface Onboarding {
  done: boolean;
  tourSeen: boolean;
  videoSeen: boolean;
  gestureDone: boolean;
  voiceTutorialDone: boolean;
  darkPrompted: boolean;
  checklist: { name: boolean; photo: boolean; notif: boolean; theme: boolean; about: boolean };
  hints: Record<string, boolean>;
  markers: Record<string, boolean>;
  confettiDone: boolean;
  welcomed: boolean;
}

export interface OwnerState {
  slow: { on: boolean; sec: number };
  autoMod: { on: boolean; words: string[] };
  commands: CustomCommand[];
  cmdLog: CmdLog[];
  invites: Invite[];
  audit: AuditEntry[];
  alerts: AdminAlert[];
  rules: string;
  branding: { name: string; desc: string; accent: string; logo?: string; banner?: string };
  perms: Record<Role, Record<string, boolean>>;
  jobs: ReloadJob[];
  history: HistoryEntry[];
  currentVersion: string;
  available: { version: string; notes: string[] } | null;
  rollout: Rollout | null;
  lastChangelogSeen: string;
  announceDraft: string;
}

export interface ChatMeta {
  id: string;
  type: "group" | "dm";
  name: string;
  photo?: string;
  otherId?: string; // for dm: the other person's member id
  lastAt: number;
}

export interface Ui {
  toasts: { id: string; title: string; body: string; at: number; kind?: "msg" | "info" | "ach" }[];
  typing: string[];
  azaan: { name: string; at: number } | null;
  achievement: { id: string; title: string; desc: string; icon: string } | null;
  offline: boolean;
  confetti: number;
  remoteOverlay: { message: string; kind: "reload" | "push" } | null;
  changelog: boolean;
  syncing: boolean;
  slowUntil: number;
  sttNonce: number;
  activeChatId: string | null;
}

export interface Nav { tab: "chat" | "deen" | "khel" | "owner" | "me"; stack: { page: string; props?: any }[] }

export interface State {
  v: number;
  me: string;
  members: Member[];
  messages: Message[];
  chats: ChatMeta[];
  settings: Settings;
  drafts: Record<string, string>;
  scheduled: Scheduled[];
  lastRead: string; // id of last message read
  blocked: string[];
  archived: boolean;
  stickerPacks: StickerPack[];
  recentEmoji: string[];
  recentStickers: string[];
  onboarding: Onboarding;
  achievements: Record<string, number>;
  owner: OwnerState;
  rooms: Room[];
  tasbeeh: { total: number; today: number; day: string };
  bookmarks: string[]; // "surah:ayah"
  quranCache: Record<string, { ar: string[]; ur: string[] }>;
  storage: { media: number; docs: number; voice: number; cache: number };
  backup: { last: number | null; size: number };
  devices: { id: string; name: string; kind: "phone" | "pc"; last: number; current?: boolean; city: string }[];
  data: { wifi: number[]; mobile: number[] };
  stats: { streak: number; lastDay: string };
  scores: { quiz: number; ttt: number; paheli: number };
  ui: Ui;
  nav: Nav;
}
