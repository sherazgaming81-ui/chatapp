// v2 Contract — ChatsApp. Backend + Frontend ke darmiyan shared types.
// v1 types (lib/backend/types.ts) ke UPAR — inhe extend karta hai, replace nahi.

export interface Draft {
  chatId: string;
  text: string;
  updatedAt: number;
}

export interface BlockedUser {
  userId: string;
  blockedAt: number;
}

export interface InviteLink {
  code: string;
  chatId: string;
  createdBy: string;
  createdAt: number;
  expiresAt: number | null;
  maxUses: number | null;
  uses: number;
}

export interface PollAnalytics {
  pollId: string;
  totalVotes: number;
  perOption: { option: string; votes: number; voterIds: string[] }[];
}

export interface JoinRequest {
  id: string;
  chatId: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface LockedChat {
  chatId: string;
  lockedAt: number;
}

export interface SelfDestructMessage {
  messageId: string;
  expiresAt: number;
}

export interface SharedContact {
  name: string;
  phone?: string;
  email?: string;
}

export interface LiveLocation {
  messageId: string;
  lat: number;
  lng: number;
  updatedAt: number;
  expiresAt: number;
}

// v2 Backend interface additions
export interface BackendV2 {
  // Drafts
  saveDraft(chatId: string, text: string): Promise<void>;
  getDraft(chatId: string): Promise<string | null>;
  clearDraft(chatId: string): Promise<void>;

  // Block
  blockUser(userId: string): Promise<void>;
  unblockUser(userId: string): Promise<void>;
  getBlockedUsers(): Promise<BlockedUser[]>;

  // Invite links
  createInviteLink(chatId: string, expiresAt?: number | null, maxUses?: number | null): Promise<InviteLink>;
  joinViaInvite(code: string): Promise<string>;
  revokeInviteLink(code: string): Promise<void>;

  // Poll analytics + deadline
  getPollAnalytics(messageId: string): Promise<PollAnalytics>;
  setPollDeadline(messageId: string, deadlineAt: number): Promise<void>;

  // Ownership
  transferOwnership(chatId: string, newAdminId: string): Promise<void>;

  // Backup
  exportChatBackup(): Promise<string>; // JSON string
  importChatBackup(json: string): Promise<void>;

  // Join requests
  requestToJoin(chatId: string): Promise<void>;
  getJoinRequests(chatId: string): Promise<JoinRequest[]>;
  approveJoinRequest(requestId: string): Promise<void>;
  rejectJoinRequest(requestId: string): Promise<void>;

  // Locked chats (local PIN — backend sirf flag rakhta hai)
  setChatLocked(chatId: string, locked: boolean): Promise<void>;
  isChatLocked(chatId: string): Promise<boolean>;

  // Per-chat tone
  setChatTone(chatId: string, tone: string): Promise<void>;
  getChatTone(chatId: string): Promise<string>;

  // Self-destruct
  sendSelfDestructMessage(chatId: string, text: string, seconds: number): Promise<void>;

  // Contact share
  sendContact(chatId: string, contact: SharedContact): Promise<void>;

  // Live location
  sendLiveLocation(chatId: string, lat: number, lng: number, durationMin: number): Promise<void>;
  updateLiveLocation(messageId: string, lat: number, lng: number): Promise<void>;
  stopLiveLocation(messageId: string): Promise<void>;
}

// v2 Frontend: device type
export type DeviceKind = 'mobile' | 'desktop';

export function getDeviceKind(): DeviceKind {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 768 ? 'mobile' : 'desktop';
}
