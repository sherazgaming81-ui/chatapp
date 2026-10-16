// ChatsApp Discord frontend — core types (fresh, minimal)

export type Role = "owner" | "admin" | "mod" | "member";

// E1 — privacy audiences
export type PrivacyAudience = "everyone" | "contacts" | "nobody";
export interface PrivacySettings {
  lastSeen: PrivacyAudience;
  photo: PrivacyAudience;
  about: PrivacyAudience;
  online: PrivacyAudience;
}
export const DEFAULT_PRIVACY: PrivacySettings = {
  lastSeen: "everyone",
  photo: "everyone",
  about: "everyone",
  online: "everyone",
};

/** Discord-Nitro-style profile customization (sab free) */
export interface ProfileStyle {
  banner: string; // banner id
  effect: string; // effect id (none/sparkle/petals/fireflies/rain/crescent)
  frame: string; // avatar frame id
  nameStyle: string; // name style id
  accent: string; // accent color hex
  badges: string[]; // badge ids (max 4)
}

export const DEFAULT_PROFILE_STYLE: ProfileStyle = {
  banner: "blurple",
  effect: "none",
  frame: "none",
  nameStyle: "plain",
  accent: "#5865f2",
  badges: [],
};

export interface Member {
  id: string;
  name: string;
  about: string;
  role: Role;
  online: boolean;
  lastSeen: number;
  avatar?: string;
  banned: boolean;
  mutedUntil: number | null | undefined; // null => forever
  warns: { reason: string; at: number }[];
  privacy?: PrivacySettings; // E1 — audience settings (default: everyone)
  style?: ProfileStyle; // Nitro-style profile customization
}

export type MsgType = "text" | "image" | "voice" | "announcement" | "system" | "poll" | "location" | "contact" | "quiz" | "tictactoe" | "sticker" | "riddle" | "file";

export interface Message {
  id: string;
  from: string;
  chatId: string; // ALWAYS present — every message carries its chat
  type: MsgType;
  text: string;
  at: number; // ms epoch
  replyTo?: string;
  edited?: boolean;
  deleted?: boolean;
  reactions: Record<string, string[]>; // emoji -> userIds
  src?: string; // media_url (image / voice / file)
  dur?: number; // voice seconds
  caption?: string;
  fileName?: string; // file messages: original filename
  fileSize?: number; // file messages: bytes
  mimeType?: string; // file messages: MIME type
  readBy?: string[]; // user ids that read it (from messages.read_by)
  status?: "sent" | "delivered" | "read"; // optional explicit tick state
}

export interface ChatMeta {
  id: string;
  type: "group" | "dm";
  name: string;
  photo?: string;
  otherId?: string; // dm: the other person's member id
  lastAt: number;
}

export interface UIState {
  tab: "chat" | "owner" | "deen";
  activeChatId: string | null;
  toasts: { id: string; title: string; body: string }[];
  typing: { id: string; chatId: string }[]; // AUDIT FIX: per-chat typing (pehle kisi bhi chat ki typing sab jagah dikhti thi)
  replyTo: Message | null;
  profileId: string | null; // member popup
  showMembers: boolean; // right sidebar (desktop)
  mobileDrawer: "none" | "channels" | "members";
  confirmBan: string | null;
  editingMsg: Message | null; // B16 edit mode
  infoMsg: string | null; // A17 seen-by modal (message id)
  viewer: { msgId: string } | null; // A7 full-screen media viewer
  starredOpen: boolean; // B13 starred messages page
  asmaOpen: boolean; // Asma-ul-Husna player overlay (Deen)
  groupInfo: null | { chatId: string; view: "info" | "media" | "files" }; // D1/D5/I13 group info panel
  globalSearchOpen: boolean; // I15 global search overlay
  jumpToMsg: string | null; // I15 — message id to scroll to after search jump
  settingsOpen: boolean; // ProfileSettings modal (Phase 6 — checklist se bhi khulta hai)
  createGroupOpen: boolean; // CreateGroup modal
  studioOpen: boolean; // ProfileStudio modal (Nitro-style customization)
  selectedMsgs: string[]; // multi-select mode (WhatsApp jaisa)
}

export interface State {
  me: string;
  session: boolean; // authed
  loading: boolean; // initial data load
  members: Member[];
  messages: Message[];
  chats: ChatMeta[];
  pins: Record<string, string[]>; // chatId -> pinned message ids (from group_settings)
  unread: Record<string, number>; // chatId -> unread count (WhatsApp-style badges)
  starred: string[]; // B13 — starred message ids (localStorage-backed)
  hiddenForMe: string[]; // AUDIT FIX — delete-for-me: sirf is user se chhupe hue message ids (localStorage-backed, per-user)
  groupRules: Record<string, { text: string; updatedAt: number; updatedBy: string }>; // D12 — chatId -> rules
  groupDescs: Record<string, string>; // D1 — chatId -> group description
  ui: UIState;
}

export const OWNER_EMAIL = "sherazgaming81@gmail.com";

export function isStaff(m: Member | undefined): boolean {
  return !!m && (m.role === "owner" || m.role === "admin" || m.role === "mod");
}
