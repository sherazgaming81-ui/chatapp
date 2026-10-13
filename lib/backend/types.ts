export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  photoURL: string;
  about: string;
  online: boolean;
  lastSeen: number; // epoch ms
  coverURL?: string;
  privacy?: PrivacySettings;
  disappearingAfter?: number; // seconds, 0 = off (per-user setting)
}

export type MessageType = 'text' | 'image' | 'audio' | 'poll' | 'file';

export type PrivacyLevel = 'everyone' | 'nobody';

export interface PrivacySettings {
  lastSeen: PrivacyLevel;
  photo: PrivacyLevel;
  online: PrivacyLevel;
}

export interface PollData {
  question: string;
  options: string[];
  votes: Record<string, string[]>; // optionIndex (as string) -> userIds
}

export interface ReaderInfo {
  userId: string;
  displayName: string;
  readAt: number;
}

export interface ScheduledMessage {
  id: string;
  chatId: string;
  input: SendInput;
  sendAt: number;
  createdAt: number;
}

export interface UploadResult {
  url: string;
  kind: 'image' | 'audio' | 'file';
  name: string;
  size: number;
}

export interface ChatNotificationSettings {
  muted: boolean;
  sound: string | null; // sound id, null = default
}

export interface ReplyRef {
  id: string;
  text: string;
  senderName: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  text: string;
  mediaURL?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number; // seconds, for audio
  replyTo?: ReplyRef | null;
  createdAt: number;
  readBy: string[];
  deletedFor?: string[];
  editedAt?: number;
  reactions?: Record<string, string[]>; // emoji -> userIds
  isPinned?: boolean;
  poll?: PollData | null;
  forwarded?: boolean;
}

export interface LastMessage {
  text: string;
  senderId: string;
  senderName: string;
  createdAt: number;
  type: MessageType;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  name: string;
  photoURL: string;
  participants: string[];
  participantProfiles: Record<string, { displayName: string; photoURL: string; online?: boolean; lastSeen?: number }>;
  lastMessage?: LastMessage | null;
  updatedAt: number;
  typing: Record<string, number>;
  adminIds?: string[];
  description?: string;
  slowModeSec?: number;
  isMainGroup?: boolean;
}

export interface SendInput {
  type: MessageType;
  text: string;
  mediaURL?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  replyTo?: ReplyRef | null;
}

export interface ChatBackend {
  readonly mode: 'firebase' | 'demo' | 'supabase';
  onAuth(cb: (user: UserProfile | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  updateProfile(patch: Partial<Pick<UserProfile, 'displayName' | 'about' | 'photoURL' | 'coverURL'>>): Promise<void>;
  onChats(cb: (chats: Chat[]) => void): () => void;
  onMessages(chatId: string, cb: (messages: ChatMessage[]) => void): () => void;
  sendMessage(chatId: string, input: SendInput): Promise<void>;
  markRead(chatId: string): Promise<void>;
  setTyping(chatId: string, isTyping: boolean): Promise<void>;
  searchUsers(query: string): Promise<UserProfile[]>;
  getOrCreateDirectChat(otherId: string): Promise<string>;
  createGroup(name: string, memberIds: string[]): Promise<string>;
  uploadMedia(chatId: string, file: File): Promise<{ url: string; kind: 'image' | 'audio' }>;
  uploadFile(chatId: string, file: File): Promise<UploadResult>;
  deleteMessage(chatId: string, messageId: string, forEveryone: boolean): Promise<void>;

  // ---- v1 additions (contract for all agents) ----
  /** Auto-join: har login user ko main group me add karo (banaya nahi to banao). Returns group id. */
  ensureMainGroup(): Promise<string>;
  /** Pinned messages */
  pinMessage(chatId: string, messageId: string): Promise<void>;
  unpinMessage(chatId: string, messageId: string): Promise<void>;
  getPinnedMessages(chatId: string): Promise<ChatMessage[]>;
  /** Starred (per-user) */
  starMessage(messageId: string, starred: boolean): Promise<void>;
  getStarredMessages(): Promise<ChatMessage[]>;
  /** Edit */
  editMessage(chatId: string, messageId: string, newText: string): Promise<void>;
  /** Forward */
  forwardMessage(messageId: string, targetChatId: string): Promise<void>;
  /** Polls */
  createPoll(chatId: string, question: string, options: string[]): Promise<string>;
  votePoll(chatId: string, messageId: string, optionIndex: number): Promise<void>;
  /** Reactions */
  toggleReaction(chatId: string, messageId: string, emoji: string): Promise<void>;
  /** Scheduled messages */
  scheduleMessage(chatId: string, input: SendInput, sendAt: number): Promise<string>;
  cancelScheduledMessage(id: string): Promise<void>;
  getScheduledMessages(): Promise<ScheduledMessage[]>;
  /** Admin */
  removeMember(chatId: string, userId: string): Promise<void>;
  makeAdmin(chatId: string, userId: string): Promise<void>;
  setGroupDescription(chatId: string, description: string): Promise<void>;
  setSlowMode(chatId: string, seconds: number): Promise<void>;
  /** Disappearing (per-user setting, seconds; 0 = off) */
  setDisappearingAfter(seconds: number): Promise<void>;
  /** Read receipts detail */
  getMessageReaders(chatId: string, messageId: string): Promise<ReaderInfo[]>;
  /** Privacy */
  updatePrivacy(patch: Partial<PrivacySettings>): Promise<void>;
  /** Pinned chats (per-user) */
  setChatPinned(chatId: string, pinned: boolean): Promise<void>;
  getPinnedChats?(): Promise<string[]>;
  /** Per-chat notification settings */
  setChatMuted(chatId: string, muted: boolean): Promise<void>;
  setChatSound(chatId: string, sound: string | null): Promise<void>;
  getChatNotificationSettings(chatId: string): Promise<ChatNotificationSettings>;
  /** Push */
  subscribePush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void>;
  unsubscribePush(): Promise<void>;
  /** Per-chat search */
  searchInChat(chatId: string, query: string): Promise<ChatMessage[]>;
  /** Optional background sweeps (supabase only) */
  sweepScheduledMessages?(): Promise<void>;
  sweepDisappearing?(): Promise<void>;
  /** Current auth JWT (push bhejne ke liye); null agar nahi hai */
  getAuthToken?(): Promise<string | null>;
}
