import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type {
  BackendV2,
  BackendV3,
  BlockedUser,
  InviteLink,
  JoinRequest,
  PollAnalytics,
  SharedContact,
} from '@/lib/v2/types';
import type {
  Chat,
  ChatAnalytics,
  ChatBackend,
  ChatMessage,
  ChatNotificationSettings,
  DeviceInfo,
  LastMessage,
  MessageInfo,
  PollData,
  PrivacySettings,
  ReaderInfo,
  ScheduledMessage,
  SendInput,
  UploadResult,
  UserProfile,
} from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const isSupabaseConfigured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

// ==================== v5: single-group pivot ====================
// Sirf ek group: "Madrasa Group". Owner ki pehchan uske email se hoti hai.
export const OWNER_EMAIL = 'sherazgaming81@gmail.com';
export const OWNER_DISPLAY_NAME = 'sheraz';
export const MAIN_GROUP_ID = 'main-group';

/** /command ka parse hua natija (UI send se pehle check karegi). */
export interface ParsedCommand {
  command: string; // '/'' ke baghair, lowercase — misal 'mute'
  args: string[]; // whitespace par tute hue arguments
  rawArgs: string; // '/command ' ke baad ka poora text
}

/** /stats command ka natija. */
export interface CommandStats {
  totalMessages: number;
  activeMembers: number;
  messagesToday: number;
  topSenders: { userId: string; displayName: string; count: number }[];
}

/** executeCommand ka natija — UI `text` dikhaye, `stats` ho to card banaye. */
export interface CommandResult {
  ok: boolean;
  text: string; // Hinglish confirmation
  stats?: CommandStats;
}

/** Supabase Presence se aane wali online state (userId -> state). */
export interface PresenceState {
  online: boolean;
  lastSeen: number;
}

type DbProfile = {
  id: string;
  display_name: string;
  email: string;
  photo_url: string;
  about: string;
  online: boolean;
  last_seen: number | string;
  cover_url?: string;
  privacy?: PrivacySettings;
  pinned_chats?: string[];
  disappearing_after?: number;
  hide_forward_tag?: boolean;
};

type DbChat = {
  id: string;
  type: string;
  name: string;
  photo_url: string;
  admin_ids: string[];
  last_message: LastMessage | null;
  updated_at: number | string;
  typing: Record<string, number>;
  description?: string;
  slow_mode_sec?: number;
  is_main_group?: boolean;
};

type DbMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_name: string;
  type: string;
  text: string;
  media_url: string | null;
  file_name: string | null;
  file_size: number | null;
  duration: number | null;
  reply_to: ChatMessage['replyTo'];
  created_at: number | string;
  read_by: string[];
  deleted_for: string[];
  edited_at: number | string | null;
  reactions: Record<string, string[]>;
  is_pinned: boolean;
  poll: PollData | null;
  forwarded: boolean;
  read_at: Record<string, number>;
  // ---- v2 columns ----
  poll_deadline?: number | string | null;
  self_destruct_at?: number | string | null;
  contact_data?: { name: string; phone?: string; email?: string } | null;
  lat?: number | null;
  lng?: number | null;
  location_expires_at?: number | string | null;
  // ---- v3 columns ----
  deleted_everyone?: boolean;
  forward_count?: number | null;
  delivered_at?: number | string | null;
  // ---- v5 columns ----
  is_announcement?: boolean;
};

const num = (v: number | string | null | undefined): number => Number(v || 0);

/**
 * v5: milliseconds ko insani muddat me badlo (mute errors/confirmations ke liye).
 * Misal: 90000 -> "2 minute", 3600000 -> "1 ghanta".
 */
function formatMs(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000));
  if (s < 60) return `${s} second`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ghanta`;
  return `${Math.floor(h / 24)} din`;
}

/**
 * Presence fix (v3): sirf `online` flag par bharosa mat karo — tab close /
 * crash par flag true reh jata hai. last_seen 2 min se purana ho to offline samjho.
 */
const ONLINE_TIMEOUT_MS = 2 * 60 * 1000;
function isOnlineRecent(lastSeen: number, onlineFlag: boolean): boolean {
  if (!onlineFlag) return false;
  if (!lastSeen) return false;
  return Date.now() - lastSeen < ONLINE_TIMEOUT_MS;
}

function toUserProfile(p: DbProfile): UserProfile {
  return {
    id: p.id,
    displayName: p.display_name || 'User',
    email: p.email || '',
    photoURL: p.photo_url || '',
    about: p.about || 'Hey there! I am using Chat.',
    online: isOnlineRecent(num(p.last_seen), !!p.online),
    lastSeen: num(p.last_seen),
    coverURL: p.cover_url || '',
    privacy: (p.privacy as PrivacySettings) || { lastSeen: 'everyone', photo: 'everyone', online: 'everyone' },
    disappearingAfter: Number(p.disappearing_after || 0),
    hideForwardTag: !!p.hide_forward_tag,
  };
}

function toChatMessage(m: DbMessage): ChatMessage {
  return {
    id: m.id,
    chatId: m.chat_id,
    senderId: m.sender_id,
    senderName: m.sender_name || 'User',
    type: (m.type as ChatMessage['type']) || 'text',
    text: m.text || '',
    mediaURL: m.media_url || undefined,
    fileName: m.file_name || undefined,
    fileSize: m.file_size ?? undefined,
    duration: m.duration ?? undefined,
    replyTo: m.reply_to || null,
    createdAt: num(m.created_at),
    readBy: m.read_by || [],
    deletedFor: m.deleted_for || [],
    editedAt: m.edited_at ? num(m.edited_at) : undefined,
    reactions: (m.reactions as Record<string, string[]>) || {},
    isPinned: !!m.is_pinned,
    poll: (m.poll as PollData) || null,
    forwarded: !!m.forwarded,
    // ---- v2 ----
    pollDeadline: m.poll_deadline ? num(m.poll_deadline) : undefined,
    selfDestructAt: m.self_destruct_at ? num(m.self_destruct_at) : undefined,
    contact: (m.contact_data as ChatMessage['contact']) || undefined,
    lat: m.lat ?? undefined,
    lng: m.lng ?? undefined,
    locationExpiresAt: m.location_expires_at ? num(m.location_expires_at) : undefined,
    // ---- v3 ----
    deletedEveryone: !!m.deleted_everyone,
    forwardCount: Number(m.forward_count || 0),
    deliveredAt: m.delivered_at ? num(m.delivered_at) : undefined,
    // ---- v5 ----
    isAnnouncement: !!m.is_announcement,
  };
}

// ==================== v3: E2E encryption (AES-GCM, per-chat key) ====================
// Simple design: har chat ki ek AES-GCM-256 key `chat_keys` table me.
// Sirf type='text' wale messages ka `text` encrypt hota hai (prefix "enc1.").
// Purane plaintext messages me prefix nahi hota — wo waise hi parhe jate hain.

const ENC_PREFIX = 'enc1.';
const chatKeyCache = new Map<string, CryptoKey>();

function b64ToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array<ArrayBufferLike>): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

async function importChatKey(keyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', b64ToBytes(keyB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptChatText(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  return ENC_PREFIX + bytesToB64(iv) + '.' + bytesToB64(new Uint8Array(ct));
}

async function decryptChatText(key: CryptoKey, stored: string): Promise<string> {
  const rest = stored.slice(ENC_PREFIX.length);
  const dot = rest.indexOf('.');
  if (dot < 0) throw new Error('bad enc format');
  const iv = b64ToBytes(rest.slice(0, dot));
  const ct = b64ToBytes(rest.slice(dot + 1));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

export class SupabaseBackend implements ChatBackend, BackendV2, BackendV3 {
  readonly mode = 'supabase' as const;
  private sb: SupabaseClient;
  private meId: string | null = null;
  private meEmail: string | null = null; // v5: owner check ke liye
  private channels: RealtimeChannel[] = [];
  private presenceTimer: ReturnType<typeof setInterval> | null = null;
  private typingCache = new Map<string, Record<string, number>>();
  private chanSeq = 0;
  private profileChan: RealtimeChannel | null = null;
  private myDeviceId: string | null = null;
  // ---- v5: owner/presence state ----
  private ownerIdCache: string | null = null;
  private ownerIdPromise: Promise<string | null> | null = null;
  private presenceCh: RealtimeChannel | null = null;
  private presenceStarted = false;
  private presenceCbs = new Set<(state: Record<string, PresenceState>) => void>();
  private presenceStateMap = new Map<string, PresenceState>();

  constructor() {
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // ---- v3: E2E chat key (get-or-create, cached) ----
  private async getChatKey(chatId: string): Promise<CryptoKey | null> {
    try {
      const cached = chatKeyCache.get(chatId);
      if (cached) return cached;
      const { data } = await this.sb.from('chat_keys').select('key_b64').eq('chat_id', chatId).maybeSingle();
      let keyB64 = (data as { key_b64?: string } | null)?.key_b64;
      if (!keyB64) {
        // Pehla sender key banata hai
        const raw = crypto.getRandomValues(new Uint8Array(32));
        keyB64 = bytesToB64(raw);
        const { error } = await this.sb.from('chat_keys').insert({ chat_id: chatId, key_b64: keyB64, created_at: Date.now() });
        if (error) {
          // Race: kisi aur ne bana di — dobara parho
          const { data: retry } = await this.sb.from('chat_keys').select('key_b64').eq('chat_id', chatId).maybeSingle();
          keyB64 = (retry as { key_b64?: string } | null)?.key_b64;
          if (!keyB64) return null;
        }
      }
      const key = await importChatKey(keyB64);
      chatKeyCache.set(chatId, key);
      return key;
    } catch (e) {
      console.error('getChatKey failed:', e);
      return null;
    }
  }

  /** v4: E2E encryption HATA DIYA — plaintext hi store hota hai. */
  private async encryptForChat(chatId: string, text: string): Promise<string> {
    return text;
  }

  /** v4: E2E encryption HATA DIYA — rows wese hi wapas. */
  private async decryptRows(chatId: string, rows: DbMessage[]): Promise<DbMessage[]> {
    return rows;
  }

  async isE2EEnabled(chatId: string): Promise<boolean> {
    return (await this.getChatKey(chatId)) !== null;
  }

  // ---- v3: mention detection ----
  /**
   * Text me @username mentions dhoondo aur participants se match karke userIds do.
   * "@Ahmed" ya "@Ahmed Khan" dono chalte hain (case-insensitive).
   */
  parseMentions(text: string, participants: { userId: string; displayName: string }[]): string[] {
    const lower = ` ${text.toLowerCase()} `;
    const found = new Set<string>();
    for (const p of participants) {
      if (!p.userId || p.userId === this.meId) continue;
      const name = (p.displayName || '').trim().toLowerCase();
      if (!name) continue;
      const first = name.split(/\s+/)[0];
      if (lower.includes(`@${name}`) || lower.includes(`@${first}`)) found.add(p.userId);
    }
    return [...found];
  }

  private async getChatParticipantsForMentions(chatId: string): Promise<{ userId: string; displayName: string }[]> {
    const { data: parts } = await this.sb.from('chat_participants').select('user_id').eq('chat_id', chatId);
    const ids = ((parts || []) as Array<{ user_id: string }>).map((p) => p.user_id);
    if (ids.length === 0) return [];
    const { data: profs } = await this.sb.from('profiles').select('id,display_name').in('id', ids);
    return ((profs || []) as Array<{ id: string; display_name: string }>).map((p) => ({
      userId: p.id,
      displayName: p.display_name || 'User',
    }));
  }

  // ---- v3: push trigger (backend se — har naye message par ek hi jagah se) ----
  private async firePush(chatId: string, title: string, body: string, mentions?: string[]): Promise<void> {
    try {
      if (typeof window === 'undefined') return;
      const token = await this.getAuthToken();
      if (!token) return;
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatId, title, body, mentions: mentions || [] }),
      }).catch(() => {});
    } catch {
      // push optional — fail ho to khamoshi se ignore
    }
  }

  private track(ch: RealtimeChannel): RealtimeChannel {
    this.channels.push(ch);
    return ch;
  }

  onAuth(cb: (user: UserProfile | null) => void): () => void {
    let alive = true;
    const emit = async () => {
      if (!alive) return;
      const { data } = await this.sb.auth.getSession();
      const sessionUser = data.session?.user || null;
      if (!sessionUser) {
        this.meId = null;
        this.meEmail = null; // v5
        cb(null);
        return;
      }
      this.meId = sessionUser.id;
      this.meEmail = sessionUser.email || null; // v5: owner check ke liye
      const meta = sessionUser.user_metadata || {};
      // Sirf pehli dafa profile banao; baad me Google data se OVERWRITE mat karo
      // (warna user ka custom naam/photo reset ho jayega)
      const { data: existing } = await this.sb.from('profiles').select('id').eq('id', sessionUser.id).maybeSingle();
      if (!existing) {
        const row: Partial<DbProfile> = {
          id: sessionUser.id,
          display_name: meta.full_name || meta.name || 'User',
          email: sessionUser.email || '',
          photo_url: meta.avatar_url || meta.picture || '',
          online: true,
          last_seen: Date.now(),
        };
        await this.sb.from('profiles').insert(row);
      } else {
        await this.sb.from('profiles').update({ online: true, last_seen: Date.now() }).eq('id', sessionUser.id);
      }
      // v5: owner ka display name hamesha 'sheraz' (pehli login par pakka karo)
      if (this.isOwner()) {
        await this.sb.from('profiles').update({ display_name: OWNER_DISPLAY_NAME }).eq('id', sessionUser.id);
      }
      // v5: har login par Madrasa Group me auto-join (ban user ko chhor kar)
      try {
        await this.ensureMemberAutoJoin(sessionUser.id);
      } catch (e) {
        console.error('ensureMemberAutoJoin failed:', e);
      }
      // v5: FRESH START — owner ke login par ek dafa purana data saaf
      // (flag group_settings me; fire-and-forget taake login na ruke)
      if (this.isOwner()) {
        this.runV5ResetIfNeeded().catch((e) => console.error('runV5ResetIfNeeded failed:', e));
      }
      const { data: prof } = await this.sb.from('profiles').select('*').eq('id', sessionUser.id).single();
      this.startPresence();
      this.registerDevice();
      this.startDeviceHeartbeat();
      // Profile realtime: naam/photo/setting change ho to foran UI update (bina reload)
      if (!this.profileChan) {
        this.profileChan = this.track(
          this.sb
            .channel(`profile-${sessionUser.id}-${++this.chanSeq}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${sessionUser.id}` }, () => emit())
            .subscribe()
        );
      }
      if (alive) cb(prof ? toUserProfile(prof as DbProfile) : null);
    };
    emit();
    const { data: listener } = this.sb.auth.onAuthStateChange(() => emit());
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
      if (this.profileChan) {
        this.sb.removeChannel(this.profileChan);
        this.channels = this.channels.filter((x) => x !== this.profileChan);
        this.profileChan = null;
      }
    };
  }

  /**
   * v5: 60-second heartbeat HATA DIYA — ab Supabase Presence istemal hota hai.
   * Tab close/crash par server khud seconds me entry hata deta hai, is liye
   * "online" atka nahi rehta. profiles.online/last_seen sirf login/logout par
   * ek dafa likhe jate hain (purane UI ke liye fallback).
   */
  private startPresence() {
    if (this.presenceStarted || !this.meId) return;
    this.presenceStarted = true;
    this.trackPresence(this.meId || undefined);
    // Login par ek dafa online flag lagao (purana fallback)
    this.sb.from('profiles').update({ online: true, last_seen: Date.now() }).eq('id', this.meId).then(
      () => {},
      () => {}
    );
    const goOffline = () => {
      if (!this.meId) return;
      this.sb.from('profiles').update({ online: false, last_seen: Date.now() }).eq('id', this.meId);
    };
    window.addEventListener('beforeunload', goOffline);
  }

  /** v3: 2-min timeout wala online check — tab close ke baad "online" nahi dikhega. */
  isUserOnline(lastSeen: number, onlineFlag: boolean): boolean {
    return isOnlineRecent(lastSeen, onlineFlag);
  }

  // ---- v3: device manager ----
  private deviceName(): string {
    if (typeof navigator === 'undefined') return 'Unknown device';
    const ua = navigator.userAgent || '';
    let os = 'Unknown OS';
    if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/windows/i.test(ua)) os = 'Windows';
    else if (/mac os/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    let browser = 'Browser';
    if (/edg/i.test(ua)) browser = 'Edge';
    else if (/chrome/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    return `${browser} • ${os}`;
  }

  private getMyDeviceId(): string {
    if (this.myDeviceId) return this.myDeviceId;
    try {
      let id = localStorage.getItem('chatsapp_device_id');
      if (!id) {
        id = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem('chatsapp_device_id', id);
      }
      this.myDeviceId = id;
      return id;
    } catch {
      this.myDeviceId = `dev_${Date.now().toString(36)}`;
      return this.myDeviceId;
    }
  }

  /** Login par device register/update karo (fire-and-forget). */
  private registerDevice(): void {
    const me = this.meId;
    if (!me || typeof window === 'undefined') return;
    const id = this.getMyDeviceId();
    const now = Date.now();
    this.sb
      .from('devices')
      .upsert(
        { id, user_id: me, name: this.deviceName(), last_active: now, created_at: now },
        { onConflict: 'id', ignoreDuplicates: false }
      )
      .then(
        () => {},
        (e) => console.error('registerDevice failed:', e)
      );
  }

  /** Har 5 min par device ka last_active refresh karo. */
  private startDeviceHeartbeat(): void {
    const me = this.meId;
    if (!me || typeof window === 'undefined') return;
    const id = this.getMyDeviceId();
    setInterval(() => {
      if (!this.meId) return;
      this.sb.from('devices').update({ last_active: Date.now() }).eq('id', id).then(
        () => {},
        () => {}
      );
    }, 5 * 60 * 1000);
  }

  async getDevices(): Promise<DeviceInfo[]> {
    const me = this.meId;
    if (!me) return [];
    let current = '';
    try {
      current = this.getMyDeviceId();
    } catch {
      /* ignore */
    }
    const { data } = await this.sb.from('devices').select('*').eq('user_id', me).order('last_active', { ascending: false });
    return ((data || []) as Array<{ id: string; name: string; last_active: number | string; created_at: number | string }>).map((d) => ({
      id: d.id,
      name: d.name || 'Unknown device',
      lastActive: num(d.last_active),
      createdAt: num(d.created_at),
      isCurrent: d.id === current,
    }));
  }

  async revokeDevice(deviceId: string): Promise<void> {
    const me = this.meId;
    if (!me || !deviceId) return;
    await this.sb.from('devices').delete().eq('id', deviceId).eq('user_id', me);
    // Apna current device revoke kiya to local id bhool jao (agli dafa naya banega)
    try {
      if (localStorage.getItem('chatsapp_device_id') === deviceId) {
        localStorage.removeItem('chatsapp_device_id');
        this.myDeviceId = null;
      }
    } catch {
      /* ignore */
    }
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    if (this.meId) {
      await this.sb.from('profiles').update({ online: false, last_seen: Date.now() }).eq('id', this.meId);
    }
    if (this.presenceTimer) clearInterval(this.presenceTimer);
    this.presenceTimer = null;
    this.presenceStarted = false; // v5
    this.presenceCh = null; // v5 (channel neeche removeChannel se hata diya jata hai)
    this.presenceStateMap.clear(); // v5
    this.ownerIdCache = null; // v5
    this.ownerIdPromise = null; // v5
    this.meEmail = null; // v5
    this.channels.forEach((c) => this.sb.removeChannel(c));
    this.channels = [];
    await this.sb.auth.signOut();
  }

  async updateProfile(patch: Partial<Pick<UserProfile, 'displayName' | 'about' | 'photoURL' | 'coverURL'>>): Promise<void> {
    if (!this.meId) return;
    const row: Partial<DbProfile> = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.about !== undefined) row.about = patch.about;
    if (patch.photoURL !== undefined) row.photo_url = patch.photoURL;
    if (patch.coverURL !== undefined) row.cover_url = patch.coverURL;
    await this.sb.from('profiles').update(row).eq('id', this.meId);
  }

  private async fetchChats(): Promise<Chat[]> {
    const me = this.meId;
    if (!me) return [];
    const { data: parts } = await this.sb.from('chat_participants').select('chat_id').eq('user_id', me);
    const chatIds = (parts || []).map((p) => p.chat_id);
    if (chatIds.length === 0) return [];

    const [{ data: chatRows }, { data: allParts }] = await Promise.all([
      this.sb.from('chats').select('*').in('id', chatIds).order('updated_at', { ascending: false }).limit(50),
      this.sb.from('chat_participants').select('chat_id,user_id').in('chat_id', chatIds),
    ]);

    const userIds = [...new Set((allParts || []).map((p) => p.user_id))];
    const { data: profRows } = await this.sb.from('profiles').select('*').in('id', userIds);
    const profMap = new Map((profRows || []).map((p) => [p.id, toUserProfile(p as DbProfile)]));

    const chats: Chat[] = [];
    for (const c of (chatRows || []) as DbChat[]) {
      const pids = (allParts || []).filter((p) => p.chat_id === c.id).map((p) => p.user_id);
      const profiles: Chat['participantProfiles'] = {};
      for (const pid of pids) {
        const pr = profMap.get(pid);
        if (pr) profiles[pid] = { displayName: pr.displayName, photoURL: pr.photoURL, online: isOnlineRecent(pr.lastSeen, pr.online), lastSeen: pr.lastSeen, about: pr.about };
      }
      let name = c.name || '';
      let photoURL = c.photo_url || '';
      if (c.type === 'direct') {
        const other = pids.find((p) => p !== me);
        const op = other ? profMap.get(other) : undefined;
        if (op) { name = op.displayName; photoURL = op.photoURL; }
      }
      const typing = (c.typing as Record<string, number>) || {};
      this.typingCache.set(c.id, typing);
      chats.push({
        id: c.id,
        type: c.type === 'group' ? 'group' : 'direct',
        name,
        photoURL,
        participants: pids,
        participantProfiles: profiles,
        lastMessage: (c.last_message as LastMessage) || null,
        updatedAt: num(c.updated_at),
        typing,
        adminIds: c.admin_ids || [],
        description: c.description || '',
        slowModeSec: Number(c.slow_mode_sec || 0),
        isMainGroup: !!c.is_main_group,
      });
    }
    // v5: single-group pivot — DM chats kabhi mat dikhao (purani DM rows DB me
    // maujood ho sakti hain, lekin UI me sirf group nazar aana chahiye)
    return chats.filter((c) => c.type !== 'direct');
  }

  onChats(cb: (chats: Chat[]) => void): () => void {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = async () => {
      if (!alive) return;
      cb(await this.fetchChats());
    };
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 400);
    };
    refresh();
    const ch = this.track(
      this.sb
        .channel(`chats-list-${++this.chanSeq}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, debounced)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_participants' }, debounced)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, debounced)
        .subscribe()
    );
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      this.sb.removeChannel(ch);
      this.channels = this.channels.filter((x) => x !== ch);
    };
  }

  /** Meri block-list (user ids ka Set). Cache nahi — chhota table hai. */
  private async fetchBlockedIds(): Promise<Set<string>> {
    const me = this.meId;
    if (!me) return new Set();
    const { data } = await this.sb.from('blocked_users').select('blocked_id').eq('user_id', me);
    return new Set((data || []).map((r) => (r as { blocked_id: string }).blocked_id));
  }

  onMessages(chatId: string, cb: (messages: ChatMessage[]) => void): () => void {
    let alive = true;
    const refresh = async () => {
      if (!alive) return;
      const [msgRes, blocked] = await Promise.all([
        this.sb
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true })
          .limit(200),
        this.fetchBlockedIds(),
      ]);
      let rows = (msgRes.data || []) as DbMessage[];
      // v3: E2E encrypted text decrypt karo (frontend ko hamesha plaintext)
      rows = await this.decryptRows(chatId, rows);
      let msgs = rows.map(toChatMessage);
      // v3: "Delete for me" wale messages mujhe mat dikhao
      const me = this.meId;
      if (me) msgs = msgs.filter((m) => !(m.deletedFor || []).includes(me));
      // Block kiye users ke messages chhupao
      if (blocked.size > 0) msgs = msgs.filter((m) => !blocked.has(m.senderId));
      // v3: delivery tracking — dusron ke messages pehli dafa dekhne par delivered_at lagao
      if (me) {
        const undelivered = rows.filter((r) => r.sender_id !== me && !r.delivered_at);
        if (undelivered.length > 0) {
          const nowD = Date.now();
          this.sb
            .from('messages')
            .update({ delivered_at: nowD })
            .in('id', undelivered.map((r) => r.id))
            .then(
              () => {},
              () => {}
            );
        }
      }
      // Self-destruct: expire ho gaye to UI se hatao + DB se safai (fire-and-forget)
      const now = Date.now();
      const expired = msgs.filter((m) => m.selfDestructAt && m.selfDestructAt <= now);
      if (expired.length > 0) {
        const ids = expired.map((m) => m.id);
        msgs = msgs.filter((m) => !m.selfDestructAt || m.selfDestructAt > now);
        this.sb.from('messages').delete().in('id', ids).then(
          () => {},
          (e) => console.error('self-destruct cleanup failed:', e)
        );
      }
      if (alive) cb(msgs);
    };
    refresh();
    const chName = `msgs-${chatId}-${++this.chanSeq}`;
    const ch = this.track(
      this.sb
        .channel(chName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
          () => refresh()
        )
        .subscribe()
    );
    return () => {
      alive = false;
      this.sb.removeChannel(ch);
      this.channels = this.channels.filter((x) => x !== ch);
    };
  }

  async sendMessage(chatId: string, input: SendInput): Promise<void> {
    const me = this.meId;
    if (!me) return;
    // v5: mute / group-lock / ban check (Hinglish error ke sath throw hota hai)
    await this.assertCanSend(chatId);
    // Block kiye user ko message nahi bhej sakte
    const { data: parts } = await this.sb.from('chat_participants').select('user_id').eq('chat_id', chatId);
    const others = ((parts || []) as Array<{ user_id: string }>).map((p) => p.user_id).filter((u) => u !== me);
    if (others.length > 0) {
      const blocked = await this.fetchBlockedIds();
      if (others.some((u) => blocked.has(u))) throw new Error('Aap ne is user ko block kiya hua hai');
    }
    const now = Date.now();
    // v5: per-member slow mode — aakhri message ke `slow_seconds` guzarna zaroori
    // (owner is se mustasna hai taake announcements kabhi na rukein)
    if (!this.isOwner()) {
      const slowSec = await this.getMemberSlow(chatId, me);
      if (slowSec > 0) {
        const { data: lastMsg } = await this.sb
          .from('messages')
          .select('created_at')
          .eq('chat_id', chatId)
          .eq('sender_id', me)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const lastTs = num((lastMsg as { created_at?: number | string } | null)?.created_at);
        if (lastTs > 0) {
          const waitMs = slowSec * 1000 - (now - lastTs);
          if (waitMs > 0) {
            throw new Error(`Thoda sabar — ${Math.ceil(waitMs / 1000)} second baad dobara message bhejein`);
          }
        }
      }
    }
    const { data: prof } = await this.sb.from('profiles').select('display_name').eq('id', me).single();
    const senderName = (prof as { display_name?: string } | null)?.display_name || 'User';
    // v3: E2E — text messages encrypt karke store karo
    const storedText = input.type === 'text' ? await this.encryptForChat(chatId, input.text) : input.text;
    const preview = input.type === 'text'
      ? (storedText.startsWith(ENC_PREFIX) ? '🔒 Encrypted message' : input.text)
      : input.type === 'image' ? '📷 Photo' : '🎤 Voice message';
    await this.sb.from('messages').insert({
      chat_id: chatId,
      sender_id: me,
      sender_name: senderName,
      type: input.type,
      text: storedText,
      media_url: input.mediaURL || null,
      file_name: input.fileName || null,
      file_size: input.fileSize ?? null,
      duration: input.duration ?? null,
      reply_to: input.replyTo || null,
      created_at: now,
      read_by: [me],
    });
    await this.sb.from('chats').update({
      last_message: { text: preview, senderId: me, senderName, createdAt: now, type: input.type } as LastMessage,
      updated_at: now,
    }).eq('id', chatId);
    // v3: push — mention wale users ko special alert
    const mentionIds = input.type === 'text' && input.text.includes('@')
      ? this.parseMentions(input.text, await this.getChatParticipantsForMentions(chatId))
      : [];
    const pushBody = input.type === 'text' ? input.text.slice(0, 80)
      : input.type === 'image' ? '📷 Photo'
      : input.type === 'audio' ? '🎤 Voice message'
      : `📎 ${input.fileName || 'File'}`;
    this.firePush(chatId, senderName, pushBody, mentionIds);
  }

  /**
   * v3: Optimistic update helper — send turant UI me dikhane ke liye local message banao.
   * Frontend: isay foran list me daalo; realtime echo aane par temp id hata do.
   */
  buildLocalMessage(
    chatId: string,
    input: SendInput,
    sender: { id: string; displayName: string }
  ): ChatMessage {
    const now = Date.now();
    return {
      id: `tmp_${now}_${Math.random().toString(36).slice(2, 8)}`,
      chatId,
      senderId: sender.id,
      senderName: sender.displayName,
      type: input.type,
      text: input.text,
      mediaURL: input.mediaURL,
      fileName: input.fileName,
      fileSize: input.fileSize,
      duration: input.duration,
      replyTo: input.replyTo || null,
      createdAt: now,
      readBy: [sender.id],
      deletedFor: [],
      reactions: {},
      isPinned: false,
      poll: null,
      forwarded: false,
      forwardCount: 0,
    };
  }

  async markRead(chatId: string): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const now = Date.now();
    const { data } = await this.sb
      .from('messages')
      .select('id,read_by,sender_id,read_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(30);
    const unread = (data || []).filter((m) => m.sender_id !== me && !(m.read_by || []).includes(me));
    await Promise.all(
      unread.map((m) => {
        const readAt = { ...((m as { read_at?: Record<string, number> }).read_at || {}) };
        readAt[me] = now;
        return this.sb.from('messages').update({ read_by: [...(m.read_by || []), me], read_at: readAt }).eq('id', m.id);
      })
    );
  }

  async setTyping(chatId: string, isTyping: boolean): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const current = { ...(this.typingCache.get(chatId) || {}) };
    if (isTyping) current[me] = Date.now();
    else delete current[me];
    this.typingCache.set(chatId, current);
    await this.sb.from('chats').update({ typing: current }).eq('id', chatId);
  }

  async searchUsers(query: string): Promise<UserProfile[]> {
    const me = this.meId;
    const term = query.trim();
    if (!term) {
      const { data } = await this.sb.from('profiles').select('*').neq('id', me || '').limit(20);
      return ((data || []) as DbProfile[]).map(toUserProfile);
    }
    const { data } = await this.sb
      .from('profiles')
      .select('*')
      .ilike('display_name', `%${term}%`)
      .neq('id', me || '')
      .limit(10);
    return ((data || []) as DbProfile[]).map(toUserProfile);
  }

  /**
   * v5: DMs HATA DIYE — ye method ab seedha Madrasa Group ka id deti hai taake
   * purani UI (jo ab bhi isay call karti hai) na toote. Nayi UI isay call na kare.
   */
  async getOrCreateDirectChat(_otherId: string): Promise<string> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    return this.ensureMainGroup();
  }

  /**
   * v5: naya group banana BAND — sirf ek hi group hai (Madrasa Group).
   * Signature wahi rakha taake purani UI compile hoti rahe; call par Error.
   */
  async createGroup(_name: string, _memberIds: string[]): Promise<string> {
    throw new Error('Naya group nahi ban sakta — sirf Madrasa Group hai');
  }

  async uploadMedia(chatId: string, file: File): Promise<{ url: string; kind: 'image' | 'audio' }> {
    const kind = file.type.startsWith('audio') ? 'audio' : 'image';
    const path = `${chatId}/${Date.now()}_${file.name}`;
    const { error } = await this.sb.storage.from('chat-media').upload(path, file);
    if (error) throw error;
    const { data } = this.sb.storage.from('chat-media').getPublicUrl(path);
    return { url: data.publicUrl, kind };
  }

  /**
   * v5: delete rules (purana 2-din wala WhatsApp rule HATA DIYA).
   * - forEveryone=false ("for me"): koi bhi user, kisi ka bhi message — sirf
   *   apne liye chhupta hai (deleted_for me apni id add hoti hai).
   * - forEveryone=true ("for everyone"): SIRF owner — row HARD DELETE hoti hai
   *   (koi placeholder nahi). Member chalaye to Error throw hota hai.
   * Signature wahi hai taake purani UI na toote.
   */
  async deleteMessage(chatId: string, messageId: string, forEveryone: boolean): Promise<void> {
    const me = this.meId;
    if (!me) return;
    if (forEveryone) {
      if (!this.isOwner()) {
        throw new Error('Sirf owner sab ke liye message delete kar sakta hai');
      }
      await this.sb.from('messages').delete().eq('id', messageId);
      // Chat list ka last message dobara nikalo (deleted wala gaya to)
      const { data: latest } = await this.sb
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) {
        const lm = latest as DbMessage;
        const text = (lm.text || '').slice(0, 120);
        await this.sb.from('chats').update({
          last_message: {
            text,
            senderId: lm.sender_id,
            senderName: lm.sender_name || 'User',
            createdAt: num(lm.created_at),
            type: lm.type,
          } as LastMessage,
          updated_at: Date.now(),
        }).eq('id', chatId);
      } else {
        await this.sb.from('chats').update({ last_message: null, updated_at: Date.now() }).eq('id', chatId);
      }
    } else {
      const { data } = await this.sb.from('messages').select('deleted_for').eq('id', messageId).maybeSingle();
      const cur = ((data as { deleted_for?: string[] } | null)?.deleted_for || []) as string[];
      if (!cur.includes(me)) {
        await this.sb.from('messages').update({ deleted_for: [...cur, me] }).eq('id', messageId);
      }
    }
  }

  // ==================== v1 additions ====================

  async ensureMainGroup(): Promise<string> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    const MAIN_ID = 'main-group';
    try {
      const { data: existing } = await this.sb.from('chats').select('id').eq('id', MAIN_ID).maybeSingle();
      if (!existing) {
        const { data: prof } = await this.sb.from('profiles').select('display_name').eq('id', me).maybeSingle();
        const creator = (prof as { display_name?: string } | null)?.display_name || 'Admin';
        await this.sb.from('chats').insert({
          id: MAIN_ID,
          type: 'group',
          name: 'Madrasa Group',
          admin_ids: [me],
          is_main_group: true,
          description: `${creator} ka group — sab dost yahin baat karein`,
          updated_at: Date.now(),
        });
        await this.sb.from('chat_participants').insert({ chat_id: MAIN_ID, user_id: me });
      } else {
        await this.sb.from('chat_participants').upsert(
          { chat_id: MAIN_ID, user_id: me },
          { onConflict: 'chat_id,user_id', ignoreDuplicates: true }
        );
      }
      return MAIN_ID;
    } catch (e) {
      console.error('ensureMainGroup failed:', e);
      throw new Error('Main group join nahi ho saka');
    }
  }

  async pinMessage(chatId: string, messageId: string): Promise<void> {
    await this.sb.from('messages').update({ is_pinned: true }).eq('id', messageId);
    await this.sb.from('chats').update({ updated_at: Date.now() }).eq('id', chatId);
  }

  async unpinMessage(chatId: string, messageId: string): Promise<void> {
    await this.sb.from('messages').update({ is_pinned: false }).eq('id', messageId);
  }

  async getPinnedMessages(chatId: string): Promise<ChatMessage[]> {
    const { data } = await this.sb
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .eq('is_pinned', true)
      .order('created_at', { ascending: false })
      .limit(20);
    const rows = await this.decryptRows(chatId, (data || []) as DbMessage[]);
    return rows.map(toChatMessage);
  }

  async starMessage(messageId: string, starred: boolean): Promise<void> {
    const me = this.meId;
    if (!me) return;
    if (starred) {
      await this.sb.from('user_stars').upsert(
        { user_id: me, message_id: messageId, created_at: Date.now() },
        { onConflict: 'user_id,message_id', ignoreDuplicates: true }
      );
    } else {
      await this.sb.from('user_stars').delete().eq('user_id', me).eq('message_id', messageId);
    }
  }

  async getStarredMessages(): Promise<ChatMessage[]> {
    const me = this.meId;
    if (!me) return [];
    const { data: stars } = await this.sb.from('user_stars').select('message_id').eq('user_id', me).order('created_at', { ascending: false }).limit(100);
    const ids = (stars || []).map((s) => s.message_id);
    if (ids.length === 0) return [];
    const { data } = await this.sb.from('messages').select('*').in('id', ids);
    const rows = (data || []) as DbMessage[];
    // v3: decrypt (starred alag-alag chats ke ho sakte hain — har chat ki key se)
    const byChat = new Map<string, DbMessage[]>();
    for (const r of rows) {
      const arr = byChat.get(r.chat_id) || [];
      arr.push(r);
      byChat.set(r.chat_id, arr);
    }
    const decrypted: DbMessage[] = [];
    for (const [cid, arr] of byChat) decrypted.push(...(await this.decryptRows(cid, arr)));
    const map = new Map(decrypted.map((m) => [m.id, toChatMessage(m)]));
    return ids.map((id) => map.get(id)).filter((m): m is ChatMessage => !!m);
  }

  async editMessage(chatId: string, messageId: string, newText: string): Promise<void> {
    const t = newText.trim();
    if (!t) return;
    // v3: E2E — text message ka naya text bhi encrypt karo
    const { data: orig } = await this.sb.from('messages').select('type').eq('id', messageId).maybeSingle();
    const isText = (orig as { type?: string } | null)?.type === 'text';
    const stored = isText ? await this.encryptForChat(chatId, t) : t;
    await this.sb.from('messages').update({ text: stored, edited_at: Date.now() }).eq('id', messageId);
    await this.sb.from('chats').update({ updated_at: Date.now() }).eq('id', chatId);
  }

  async forwardMessage(messageId: string, targetChatId: string): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const { data } = await this.sb.from('messages').select('*').eq('id', messageId).maybeSingle();
    if (!data) return;
    const src = data as DbMessage;
    const now = Date.now();
    const { data: prof } = await this.sb.from('profiles').select('display_name').eq('id', me).maybeSingle();
    const senderName = (prof as { display_name?: string } | null)?.display_name || 'User';
    // v3: forward count barhao (5+ par "Forwarded many times")
    const newCount = Number(src.forward_count || 0) + 1;
    this.sb.from('messages').update({ forward_count: newCount }).eq('id', messageId).then(
      () => {},
      () => {}
    );
    // v3: E2E — source chat ki key se decrypt karke target chat ki key se encrypt karo
    let plainText = src.text || '';
    if (plainText.startsWith(ENC_PREFIX)) {
      const srcKey = await this.getChatKey(src.chat_id);
      if (srcKey) {
        try {
          plainText = await decryptChatText(srcKey, plainText);
        } catch {
          /* raw rehne do */
        }
      }
    }
    const storedText = src.type === 'text' ? await this.encryptForChat(targetChatId, plainText) : src.text;
    await this.sb.from('messages').insert({
      chat_id: targetChatId,
      sender_id: me,
      sender_name: senderName,
      type: src.type,
      text: storedText,
      media_url: src.media_url,
      file_name: src.file_name,
      file_size: src.file_size,
      duration: src.duration,
      poll: src.poll,
      forwarded: true,
      forward_count: newCount,
      created_at: now,
      read_by: [me],
    });
    const preview = src.type === 'text' ? (storedText.startsWith(ENC_PREFIX) ? '🔒 Encrypted message' : plainText) : src.type === 'image' ? '📷 Photo' : src.type === 'poll' ? '📊 Poll' : '📎 File';
    await this.sb.from('chats').update({
      last_message: { text: preview, senderId: me, senderName, createdAt: now, type: src.type } as LastMessage,
      updated_at: now,
    }).eq('id', targetChatId);
    // v3: push
    const mentionIds = src.type === 'text' && plainText.includes('@')
      ? this.parseMentions(plainText, await this.getChatParticipantsForMentions(targetChatId))
      : [];
    this.firePush(targetChatId, senderName, preview.slice(0, 80), mentionIds);
  }

  async createPoll(chatId: string, question: string, options: string[]): Promise<string> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean).slice(0, 10);
    if (!q || opts.length < 2) throw new Error('Sawal aur kam-az-kam 2 options likhein');
    const now = Date.now();
    const { data: prof } = await this.sb.from('profiles').select('display_name').eq('id', me).maybeSingle();
    const senderName = (prof as { display_name?: string } | null)?.display_name || 'User';
    const poll: PollData = { question: q, options: opts, votes: {} };
    const { data, error } = await this.sb.from('messages').insert({
      chat_id: chatId,
      sender_id: me,
      sender_name: senderName,
      type: 'poll',
      text: q,
      poll,
      created_at: now,
      read_by: [me],
    }).select('id').single();
    if (error || !data) throw new Error('Poll nahi ban saka');
    await this.sb.from('chats').update({
      last_message: { text: `📊 ${q}`, senderId: me, senderName, createdAt: now, type: 'poll' } as LastMessage,
      updated_at: now,
    }).eq('id', chatId);
    // v3: push
    this.firePush(chatId, senderName, `📊 ${q}`.slice(0, 80));
    return (data as { id: string }).id;
  }

  async votePoll(chatId: string, messageId: string, optionIndex: number): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const { data } = await this.sb.from('messages').select('poll,poll_deadline').eq('id', messageId).maybeSingle();
    const row = data as { poll?: PollData; poll_deadline?: number | string | null } | null;
    const poll = row?.poll;
    if (!poll) return;
    const deadline = row?.poll_deadline ? num(row.poll_deadline) : 0;
    if (deadline > 0 && Date.now() > deadline) throw new Error('Poll band ho chuki hai');
    const votes: Record<string, string[]> = { ...(poll.votes || {}) };
    for (const k of Object.keys(votes)) votes[k] = (votes[k] || []).filter((u) => u !== me);
    const key = String(optionIndex);
    votes[key] = [...(votes[key] || []), me];
    await this.sb.from('messages').update({ poll: { ...poll, votes } }).eq('id', messageId);
  }

  async toggleReaction(chatId: string, messageId: string, emoji: string): Promise<void> {
    const me = this.meId;
    if (!me) return;
    // v3: custom reactions — koi bhi emoji allowed hai (bas khali nahi)
    const e = emoji.trim();
    if (!e) return;
    const { data } = await this.sb.from('messages').select('reactions').eq('id', messageId).maybeSingle();
    const reactions: Record<string, string[]> = { ...(((data as { reactions?: Record<string, string[]> } | null)?.reactions) || {}) };
    const users = reactions[e] || [];
    reactions[e] = users.includes(me) ? users.filter((u) => u !== me) : [...users, me];
    if (reactions[e].length === 0) delete reactions[e];
    await this.sb.from('messages').update({ reactions }).eq('id', messageId);
  }

  async uploadFile(chatId: string, file: File): Promise<UploadResult> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    const kind: UploadResult['kind'] = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${chatId}/${Date.now()}_${safeName}`;
    const { error } = await this.sb.storage.from('chat-media').upload(path, file);
    if (error) throw error;
    const { data } = this.sb.storage.from('chat-media').getPublicUrl(path);
    return { url: data.publicUrl, kind, name: file.name, size: file.size };
  }

  async scheduleMessage(chatId: string, input: SendInput, sendAt: number): Promise<string> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    if (sendAt <= Date.now()) throw new Error('Waqt mustaqbil me ho');
    const { data, error } = await this.sb.from('scheduled_messages').insert({
      chat_id: chatId,
      sender_id: me,
      input: input as unknown as Record<string, unknown>,
      send_at: sendAt,
      created_at: Date.now(),
    }).select('id').single();
    if (error || !data) throw new Error('Schedule nahi ho saka');
    return (data as { id: string }).id;
  }

  async cancelScheduledMessage(id: string): Promise<void> {
    const me = this.meId;
    if (!me) return;
    await this.sb.from('scheduled_messages').delete().eq('id', id).eq('sender_id', me);
  }

  async getScheduledMessages(): Promise<ScheduledMessage[]> {
    const me = this.meId;
    if (!me) return [];
    const { data } = await this.sb.from('scheduled_messages').select('*').eq('sender_id', me).order('send_at', { ascending: true });
    return ((data || []) as Array<{ id: string; chat_id: string; input: SendInput; send_at: number | string; created_at: number | string }>).map((r) => ({
      id: r.id,
      chatId: r.chat_id,
      input: r.input as SendInput,
      sendAt: num(r.send_at),
      createdAt: num(r.created_at),
    }));
  }

  /** Best-effort sweep: jinki send_at aa gayi ho, bhej do. */
  async sweepScheduledMessages(): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const now = Date.now();
    const { data } = await this.sb.from('scheduled_messages').select('*').lte('send_at', now).limit(20);
    for (const r of (data || []) as Array<{ id: string; chat_id: string; sender_id: string; input: SendInput }>) {
      try {
        const prevMe = this.meId;
        this.meId = r.sender_id;
        await this.sendMessage(r.chat_id, r.input as SendInput);
        this.meId = prevMe;
        await this.sb.from('scheduled_messages').delete().eq('id', r.id);
      } catch (e) {
        console.error('scheduled send failed:', e);
      }
    }
  }

  /** v5: sirf owner member remove kar sakta hai (ban/mute commands ke liye). */
  async removeMember(chatId: string, userId: string): Promise<void> {
    const me = this.meId;
    if (!me || userId === me) return;
    if (!this.isOwner()) throw new Error('Sirf owner member remove kar sakta hai');
    await this.sb.from('chat_participants').delete().eq('chat_id', chatId).eq('user_id', userId);
  }

  async makeAdmin(chatId: string, userId: string): Promise<void> {
    const { data } = await this.sb.from('chats').select('admin_ids').eq('id', chatId).maybeSingle();
    const admins = ((data as { admin_ids?: string[] } | null)?.admin_ids || []) as string[];
    if (!admins.includes(userId)) {
      await this.sb.from('chats').update({ admin_ids: [...admins, userId] }).eq('id', chatId);
    }
  }

  async setGroupDescription(chatId: string, description: string): Promise<void> {
    await this.sb.from('chats').update({ description: description.slice(0, 500) }).eq('id', chatId);
  }

  async setSlowMode(chatId: string, seconds: number): Promise<void> {
    await this.sb.from('chats').update({ slow_mode_sec: Math.max(0, Math.min(3600, seconds)) }).eq('id', chatId);
  }

  async setDisappearingAfter(seconds: number): Promise<void> {
    const me = this.meId;
    if (!me) return;
    await this.sb.from('profiles').update({ disappearing_after: Math.max(0, seconds) }).eq('id', me);
  }

  /** Apne disappearing timer ke mutabiq purane messages delete karo. */
  async sweepDisappearing(): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const { data: prof } = await this.sb.from('profiles').select('disappearing_after').eq('id', me).maybeSingle();
    const after = Number((prof as { disappearing_after?: number } | null)?.disappearing_after || 0);
    if (after <= 0) return;
    const cutoff = Date.now() - after * 1000;
    await this.sb.from('messages').delete().eq('sender_id', me).lt('created_at', cutoff);
  }

  async getMessageReaders(chatId: string, messageId: string): Promise<ReaderInfo[]> {
    const { data: msg } = await this.sb.from('messages').select('read_by,read_at').eq('id', messageId).maybeSingle();
    const m = msg as { read_by?: string[]; read_at?: Record<string, number> } | null;
    if (!m) return [];
    const ids = m.read_by || [];
    if (ids.length === 0) return [];
    const { data: profs } = await this.sb.from('profiles').select('id,display_name').in('id', ids);
    const nameMap = new Map(((profs || []) as Array<{ id: string; display_name: string }>).map((p) => [p.id, p.display_name]));
    const readAt = m.read_at || {};
    return ids
      .map((uid) => ({ userId: uid, displayName: nameMap.get(uid) || 'User', readAt: readAt[uid] || 0 }))
      .sort((a, b) => b.readAt - a.readAt);
  }

  async updatePrivacy(patch: Partial<PrivacySettings>): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const { data: prof } = await this.sb.from('profiles').select('privacy').eq('id', me).maybeSingle();
    const cur = ((prof as { privacy?: PrivacySettings } | null)?.privacy || { lastSeen: 'everyone', photo: 'everyone', online: 'everyone' }) as PrivacySettings;
    await this.sb.from('profiles').update({ privacy: { ...cur, ...patch } }).eq('id', me);
  }

  async setChatPinned(chatId: string, pinned: boolean): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const { data: prof } = await this.sb.from('profiles').select('pinned_chats').eq('id', me).maybeSingle();
    const cur = ((prof as { pinned_chats?: string[] } | null)?.pinned_chats || []) as string[];
    const next = pinned ? [...new Set([...cur, chatId])] : cur.filter((c) => c !== chatId);
    await this.sb.from('profiles').update({ pinned_chats: next }).eq('id', me);
  }

  async getPinnedChats(): Promise<string[]> {
    const me = this.meId;
    if (!me) return [];
    const { data: prof } = await this.sb.from('profiles').select('pinned_chats').eq('id', me).maybeSingle();
    return ((prof as { pinned_chats?: string[] } | null)?.pinned_chats || []) as string[];
  }

  async setChatMuted(chatId: string, muted: boolean): Promise<void> {
    const me = this.meId;
    if (!me) return;
    await this.sb.from('user_chat_settings').upsert(
      { chat_id: chatId, user_id: me, muted },
      { onConflict: 'chat_id,user_id' }
    );
  }

  async setChatSound(chatId: string, sound: string | null): Promise<void> {
    const me = this.meId;
    if (!me) return;
    await this.sb.from('user_chat_settings').upsert(
      { chat_id: chatId, user_id: me, sound },
      { onConflict: 'chat_id,user_id' }
    );
  }

  async getChatNotificationSettings(chatId: string): Promise<ChatNotificationSettings> {
    const me = this.meId;
    if (!me) return { muted: false, sound: null };
    const { data } = await this.sb.from('user_chat_settings').select('muted,sound').eq('chat_id', chatId).eq('user_id', me).maybeSingle();
    const r = data as { muted?: boolean; sound?: string | null } | null;
    return { muted: !!r?.muted, sound: r?.sound ?? null };
  }

  async subscribePush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void> {
    const me = this.meId;
    if (!me) return;
    await this.sb.from('push_subscriptions').upsert(
      { user_id: me, endpoint: sub.endpoint, keys: sub.keys, created_at: Date.now() },
      { onConflict: 'user_id,endpoint' }
    );
  }

  async unsubscribePush(): Promise<void> {
    const me = this.meId;
    if (!me) return;
    await this.sb.from('push_subscriptions').delete().eq('user_id', me);
  }

  async searchInChat(chatId: string, query: string): Promise<ChatMessage[]> {
    const term = query.trim();
    if (!term) return [];
    const { data } = await this.sb
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .ilike('text', `%${term}%`)
      .order('created_at', { ascending: false })
      .limit(30);
    // Note: E2E encrypted text DB me match nahi hoga — sirf purane/plaintext results
    const rows = await this.decryptRows(chatId, (data || []) as DbMessage[]);
    return rows.map(toChatMessage);
  }

  async getAuthToken(): Promise<string | null> {
    const { data } = await this.sb.auth.getSession();
    return data.session?.access_token || null;
  }

  // ==================== v2 additions ====================

  // ---- Drafts ----
  async saveDraft(chatId: string, text: string): Promise<void> {
    const me = this.meId;
    if (!me) return;
    if (!text.trim()) {
      await this.clearDraft(chatId);
      return;
    }
    await this.sb.from('message_drafts').upsert(
      { user_id: me, chat_id: chatId, text, updated_at: Date.now() },
      { onConflict: 'user_id,chat_id' }
    );
  }

  async getDraft(chatId: string): Promise<string | null> {
    const me = this.meId;
    if (!me) return null;
    const { data } = await this.sb.from('message_drafts').select('text').eq('user_id', me).eq('chat_id', chatId).maybeSingle();
    return (data as { text?: string } | null)?.text ?? null;
  }

  async clearDraft(chatId: string): Promise<void> {
    const me = this.meId;
    if (!me) return;
    await this.sb.from('message_drafts').delete().eq('user_id', me).eq('chat_id', chatId);
  }

  // ---- Block ----
  async blockUser(userId: string): Promise<void> {
    const me = this.meId;
    if (!me || !userId || userId === me) return;
    await this.sb.from('blocked_users').upsert(
      { user_id: me, blocked_id: userId, blocked_at: Date.now() },
      { onConflict: 'user_id,blocked_id', ignoreDuplicates: true }
    );
  }

  async unblockUser(userId: string): Promise<void> {
    const me = this.meId;
    if (!me) return;
    await this.sb.from('blocked_users').delete().eq('user_id', me).eq('blocked_id', userId);
  }

  async getBlockedUsers(): Promise<BlockedUser[]> {
    const me = this.meId;
    if (!me) return [];
    const { data } = await this.sb.from('blocked_users').select('blocked_id,blocked_at').eq('user_id', me).order('blocked_at', { ascending: false });
    return ((data || []) as Array<{ blocked_id: string; blocked_at: number | string }>).map((r) => ({
      userId: r.blocked_id,
      blockedAt: num(r.blocked_at),
    }));
  }

  // ---- Invite links ----
  async createInviteLink(chatId: string, expiresAt?: number | null, maxUses?: number | null): Promise<InviteLink> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const now = Date.now();
    const { error } = await this.sb.from('invite_links').insert({
      code,
      chat_id: chatId,
      created_by: me,
      created_at: now,
      expires_at: expiresAt ?? null,
      max_uses: maxUses ?? null,
      uses: 0,
    });
    if (error) throw new Error('Invite link nahi ban saka');
    return { code, chatId, createdBy: me, createdAt: now, expiresAt: expiresAt ?? null, maxUses: maxUses ?? null, uses: 0 };
  }

  async joinViaInvite(code: string): Promise<string> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    const { data } = await this.sb.from('invite_links').select('*').eq('code', code.trim()).maybeSingle();
    const link = data as { code: string; chat_id: string; expires_at: number | string | null; max_uses: number | null; uses: number } | null;
    if (!link) throw new Error('Invite link ghalat ya khatam ho gaya');
    if (link.expires_at && Date.now() > num(link.expires_at)) throw new Error('Invite link ki muddat khatam ho gayi');
    if (link.max_uses != null && link.uses >= link.max_uses) throw new Error('Invite link ka istemal poora ho gaya');
    await this.sb.from('chat_participants').upsert(
      { chat_id: link.chat_id, user_id: me },
      { onConflict: 'chat_id,user_id', ignoreDuplicates: true }
    );
    await this.sb.from('invite_links').update({ uses: link.uses + 1 }).eq('code', link.code);
    return link.chat_id;
  }

  async revokeInviteLink(code: string): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const { data } = await this.sb.from('invite_links').select('created_by,chat_id').eq('code', code).maybeSingle();
    const link = data as { created_by: string; chat_id: string } | null;
    if (!link) return;
    // Link banane wala ya chat admin hi revoke kar sakta hai
    const { data: chat } = await this.sb.from('chats').select('admin_ids').eq('id', link.chat_id).maybeSingle();
    const admins = ((chat as { admin_ids?: string[] } | null)?.admin_ids || []) as string[];
    if (link.created_by !== me && !admins.includes(me)) throw new Error('Aap ke paas ijazat nahi');
    await this.sb.from('invite_links').delete().eq('code', code);
  }

  // ---- Poll analytics + deadline ----
  async getPollAnalytics(messageId: string): Promise<PollAnalytics> {
    const { data } = await this.sb.from('messages').select('poll').eq('id', messageId).maybeSingle();
    const poll = (data as { poll?: PollData } | null)?.poll;
    if (!poll) throw new Error('Poll nahi mila');
    const votes = poll.votes || {};
    // Note: PollAnalytics contract me voter display names ka field nahi hai,
    // is liye sirf voterIds return karte hain — frontend profiles se naam nikal le.
    const perOption = poll.options.map((option, i) => ({
      option,
      votes: (votes[String(i)] || []).length,
      voterIds: votes[String(i)] || [],
    }));
    return {
      pollId: messageId,
      totalVotes: perOption.reduce((s, o) => s + o.votes, 0),
      perOption,
    };
  }

  async setPollDeadline(messageId: string, deadlineAt: number): Promise<void> {
    const me = this.meId;
    if (!me) return;
    await this.sb.from('messages').update({ poll_deadline: deadlineAt }).eq('id', messageId);
  }

  // ---- Ownership ----
  async transferOwnership(chatId: string, newAdminId: string): Promise<void> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    if (newAdminId === me) return;
    const { data } = await this.sb.from('chats').select('admin_ids').eq('id', chatId).maybeSingle();
    const admins = ((data as { admin_ids?: string[] } | null)?.admin_ids || []) as string[];
    if (!admins.includes(me)) throw new Error('Sirf admin ownership de sakta hai');
    const next = admins.filter((a) => a !== me);
    if (!next.includes(newAdminId)) next.push(newAdminId);
    await this.sb.from('chats').update({ admin_ids: next }).eq('id', chatId);
    // Naya owner chat ka member bhi hona chahiye
    await this.sb.from('chat_participants').upsert(
      { chat_id: chatId, user_id: newAdminId },
      { onConflict: 'chat_id,user_id', ignoreDuplicates: true }
    );
  }

  // ---- Backup ----
  async exportChatBackup(): Promise<string> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    const { data: parts } = await this.sb.from('chat_participants').select('chat_id').eq('user_id', me);
    const chatIds = ((parts || []) as Array<{ chat_id: string }>).map((p) => p.chat_id);
    let chats: unknown[] = [];
    let messages: unknown[] = [];
    let profiles: unknown[] = [];
    if (chatIds.length > 0) {
      const [chatRes, msgRes, partRes] = await Promise.all([
        this.sb.from('chats').select('*').in('id', chatIds),
        this.sb.from('messages').select('*').in('chat_id', chatIds).order('created_at', { ascending: true }).limit(5000),
        this.sb.from('chat_participants').select('user_id').in('chat_id', chatIds),
      ]);
      chats = chatRes.data || [];
      messages = msgRes.data || [];
      const userIds = [...new Set(((partRes.data || []) as Array<{ user_id: string }>).map((p) => p.user_id))];
      if (userIds.length > 0) {
        const { data: profRows } = await this.sb.from('profiles').select('id,display_name,email,photo_url,about').in('id', userIds);
        profiles = profRows || [];
      }
    }
    const { data: myProf } = await this.sb.from('profiles').select('*').eq('id', me).maybeSingle();
    return JSON.stringify({
      version: 2,
      app: 'ChatsApp',
      exportedAt: Date.now(),
      userId: me,
      me: myProf || null,
      chats,
      messages,
      profiles,
      messageCount: (messages as unknown[]).length,
    });
  }

  async importChatBackup(json: string): Promise<void> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    let parsed: { chats?: unknown[]; messages?: unknown[]; profiles?: unknown[] };
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('Backup file sahi nahi hai');
    }
    const chats = Array.isArray(parsed.chats) ? parsed.chats : [];
    const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
    const profiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
    if (chats.length === 0 && messages.length === 0) throw new Error('Backup khaali hai');
    try {
      // Chats jisme user hissa tha — upsert se conflicts sambhalo
      for (const c of chats) {
        const row = c as Record<string, unknown>;
        if (!row || typeof row.id !== 'string') continue;
        const { error } = await this.sb.from('chats').upsert(row as never, { onConflict: 'id', ignoreDuplicates: false });
        if (error) console.error('backup chat upsert failed:', error.message);
        // Apni membership pakki karo taake chat nazar aaye
        await this.sb.from('chat_participants').upsert(
          { chat_id: row.id as string, user_id: me },
          { onConflict: 'chat_id,user_id', ignoreDuplicates: true }
        );
      }
      // Messages — upsert
      const msgRows = (messages as Array<Record<string, unknown>>).filter((m) => m && typeof m.id === 'string');
      for (let i = 0; i < msgRows.length; i += 200) {
        const chunk = msgRows.slice(i, i + 200);
        const { error } = await this.sb.from('messages').upsert(chunk as never[], { onConflict: 'id', ignoreDuplicates: false });
        if (error) console.error('backup messages upsert failed:', error.message);
      }
      // Profiles subset — best effort (RLS doosron ki profile rok sakti hai)
      const profRows = (profiles as Array<Record<string, unknown>>).filter((p) => p && typeof p.id === 'string');
      for (const p of profRows) {
        const { error } = await this.sb.from('profiles').upsert(p as never, { onConflict: 'id', ignoreDuplicates: false });
        if (error) break; // RLS rok de to aage mat barho
      }
      // Metadata entry
      await this.sb.from('chat_backups').insert({
        id: `backup_${Date.now()}`,
        user_id: me,
        created_at: Date.now(),
        message_count: msgRows.length,
      });
    } catch (e) {
      console.error('importChatBackup failed:', e);
      throw new Error('Backup restore nahi ho saka');
    }
  }

  // ---- Join requests ----
  async requestToJoin(chatId: string): Promise<void> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    const { data: already } = await this.sb.from('chat_participants').select('chat_id').eq('chat_id', chatId).eq('user_id', me).maybeSingle();
    if (already) throw new Error('Aap pehle se member hain');
    await this.sb.from('join_requests').upsert(
      { id: `jr_${chatId}_${me}`, chat_id: chatId, user_id: me, status: 'pending', created_at: Date.now() },
      { onConflict: 'id', ignoreDuplicates: false }
    );
  }

  async getJoinRequests(chatId: string): Promise<JoinRequest[]> {
    const { data } = await this.sb.from('join_requests').select('*').eq('chat_id', chatId).eq('status', 'pending').order('created_at', { ascending: false });
    return ((data || []) as Array<{ id: string; chat_id: string; user_id: string; status: string; created_at: number | string }>).map((r) => ({
      id: r.id,
      chatId: r.chat_id,
      userId: r.user_id,
      status: r.status as JoinRequest['status'],
      createdAt: num(r.created_at),
    }));
  }

  async approveJoinRequest(requestId: string): Promise<void> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    const { data } = await this.sb.from('join_requests').select('*').eq('id', requestId).maybeSingle();
    const req = data as { id: string; chat_id: string; user_id: string; status: string } | null;
    if (!req || req.status !== 'pending') throw new Error('Request nahi mili');
    const { data: chat } = await this.sb.from('chats').select('admin_ids').eq('id', req.chat_id).maybeSingle();
    const admins = ((chat as { admin_ids?: string[] } | null)?.admin_ids || []) as string[];
    if (!admins.includes(me)) throw new Error('Sirf admin approve kar sakta hai');
    await this.sb.from('chat_participants').upsert(
      { chat_id: req.chat_id, user_id: req.user_id },
      { onConflict: 'chat_id,user_id', ignoreDuplicates: true }
    );
    await this.sb.from('join_requests').update({ status: 'approved' }).eq('id', requestId);
  }

  async rejectJoinRequest(requestId: string): Promise<void> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    const { data } = await this.sb.from('join_requests').select('chat_id,status').eq('id', requestId).maybeSingle();
    const req = data as { chat_id: string; status: string } | null;
    if (!req || req.status !== 'pending') throw new Error('Request nahi mili');
    const { data: chat } = await this.sb.from('chats').select('admin_ids').eq('id', req.chat_id).maybeSingle();
    const admins = ((chat as { admin_ids?: string[] } | null)?.admin_ids || []) as string[];
    if (!admins.includes(me)) throw new Error('Sirf admin reject kar sakta hai');
    await this.sb.from('join_requests').update({ status: 'rejected' }).eq('id', requestId);
  }

  // ---- Locked chats (per-user flag; PIN UI frontend ka kaam) ----
  async setChatLocked(chatId: string, locked: boolean): Promise<void> {
    const me = this.meId;
    if (!me) return;
    if (locked) {
      await this.sb.from('locked_chats').upsert(
        { user_id: me, chat_id: chatId, locked_at: Date.now() },
        { onConflict: 'user_id,chat_id', ignoreDuplicates: true }
      );
    } else {
      await this.sb.from('locked_chats').delete().eq('user_id', me).eq('chat_id', chatId);
    }
  }

  async isChatLocked(chatId: string): Promise<boolean> {
    const me = this.meId;
    if (!me) return false;
    const { data } = await this.sb.from('locked_chats').select('chat_id').eq('user_id', me).eq('chat_id', chatId).maybeSingle();
    return !!data;
  }

  // ---- Per-chat tone ----
  async setChatTone(chatId: string, tone: string): Promise<void> {
    const me = this.meId;
    if (!me) return;
    await this.sb.from('user_chat_settings').upsert(
      { chat_id: chatId, user_id: me, tone },
      { onConflict: 'chat_id,user_id' }
    );
  }

  async getChatTone(chatId: string): Promise<string> {
    const me = this.meId;
    if (!me) return 'default';
    const { data } = await this.sb.from('user_chat_settings').select('tone').eq('chat_id', chatId).eq('user_id', me).maybeSingle();
    return (data as { tone?: string } | null)?.tone || 'default';
  }

  // ---- Self-destruct ----
  private async insertSpecialMessage(
    chatId: string,
    row: Record<string, unknown>
  ): Promise<void> {
    const me = this.meId;
    if (!me) return;
    // v5: mute / group-lock / ban check (special messages par bhi)
    await this.assertCanSend(chatId);
    // Block check (self-destruct/contact/location ke liye bhi)
    const { data: parts } = await this.sb.from('chat_participants').select('user_id').eq('chat_id', chatId);
    const others = ((parts || []) as Array<{ user_id: string }>).map((p) => p.user_id).filter((u) => u !== me);
    if (others.length > 0) {
      const blocked = await this.fetchBlockedIds();
      if (others.some((u) => blocked.has(u))) throw new Error('Aap ne is user ko block kiya hua hai');
    }
    const now = Date.now();
    const { data: prof } = await this.sb.from('profiles').select('display_name').eq('id', me).maybeSingle();
    const senderName = (prof as { display_name?: string } | null)?.display_name || 'User';
    await this.sb.from('messages').insert({
      chat_id: chatId,
      sender_id: me,
      sender_name: senderName,
      created_at: now,
      read_by: [me],
      ...row,
    });
    const preview =
      row.type === 'contact' ? '👤 Contact' : row.type === 'location' ? '📍 Live location' : '⏳ ' + String(row.text || '').slice(0, 40);
    await this.sb.from('chats').update({
      last_message: { text: preview, senderId: me, senderName, createdAt: now, type: row.type } as LastMessage,
      updated_at: now,
    }).eq('id', chatId);
    // v3: push (self-destruct/contact/location)
    const spText = String(row.text || '');
    const mentionIds = spText.includes('@')
      ? this.parseMentions(spText, await this.getChatParticipantsForMentions(chatId))
      : [];
    this.firePush(chatId, senderName, preview.slice(0, 80), mentionIds);
  }

  async sendSelfDestructMessage(chatId: string, text: string, seconds: number): Promise<void> {
    const t = text.trim();
    if (!t) return;
    const secs = Math.max(1, Math.min(86400, seconds));
    await this.insertSpecialMessage(chatId, {
      type: 'text',
      text: t,
      self_destruct_at: Date.now() + secs * 1000,
    });
  }

  // ---- Contact share ----
  async sendContact(chatId: string, contact: SharedContact): Promise<void> {
    const name = contact.name.trim();
    if (!name) throw new Error('Contact ka naam likhein');
    await this.insertSpecialMessage(chatId, {
      type: 'contact',
      text: name,
      contact_data: { name, phone: contact.phone || undefined, email: contact.email || undefined },
    });
  }

  // ---- Live location ----
  async sendLiveLocation(chatId: string, lat: number, lng: number, durationMin: number): Promise<void> {
    const mins = Math.max(1, Math.min(480, durationMin));
    await this.insertSpecialMessage(chatId, {
      type: 'location',
      text: '📍 Live location',
      lat,
      lng,
      location_expires_at: Date.now() + mins * 60000,
    });
  }

  async updateLiveLocation(messageId: string, lat: number, lng: number): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const { data } = await this.sb.from('messages').select('sender_id,location_expires_at').eq('id', messageId).maybeSingle();
    const row = data as { sender_id: string; location_expires_at: number | string | null } | null;
    if (!row || row.sender_id !== me) return;
    if (row.location_expires_at && Date.now() > num(row.location_expires_at)) throw new Error('Location share khatam ho gaya');
    await this.sb.from('messages').update({ lat, lng }).eq('id', messageId);
  }

  async stopLiveLocation(messageId: string): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const { data } = await this.sb.from('messages').select('sender_id').eq('id', messageId).maybeSingle();
    if ((data as { sender_id?: string } | null)?.sender_id !== me) return;
    await this.sb.from('messages').update({ location_expires_at: Date.now() }).eq('id', messageId);
  }

  // ==================== v3 additions ====================

  /** Chat analytics: total, per-user counts, sab se active hour, pehla/aakhri message. */
  async getChatAnalytics(chatId: string): Promise<ChatAnalytics> {
    const { data } = await this.sb
      .from('messages')
      .select('sender_id,sender_name,created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(5000);
    const rows = (data || []) as Array<{ sender_id: string; sender_name: string; created_at: number | string }>;
    const perUserMap = new Map<string, { userId: string; displayName: string; count: number }>();
    const hourCounts = new Array<number>(24).fill(0);
    let first = 0;
    let last = 0;
    for (const r of rows) {
      const at = num(r.created_at);
      if (!first || at < first) first = at;
      if (at > last) last = at;
      const e = perUserMap.get(r.sender_id) || { userId: r.sender_id, displayName: r.sender_name || 'User', count: 0 };
      e.count++;
      perUserMap.set(r.sender_id, e);
      hourCounts[new Date(at).getHours()]++;
    }
    let mostActiveHour = -1;
    let best = 0;
    hourCounts.forEach((c, h) => {
      if (c > best) {
        best = c;
        mostActiveHour = h;
      }
    });
    return {
      chatId,
      totalMessages: rows.length,
      perUser: [...perUserMap.values()].sort((a, b) => b.count - a.count),
      mostActiveHour,
      firstMessageAt: first,
      lastMessageAt: last,
    };
  }

  /** WA-style group read list — sirf messageId se, kisne kab parha. */
  async getMessageReadList(messageId: string): Promise<ReaderInfo[]> {
    const { data: msg } = await this.sb.from('messages').select('chat_id,read_by,read_at').eq('id', messageId).maybeSingle();
    const m = msg as { chat_id?: string; read_by?: string[]; read_at?: Record<string, number> } | null;
    if (!m) return [];
    return this.getMessageReaders(m.chat_id || '', messageId);
  }

  /** Forwarded tag chhupane ki per-user setting. */
  async setHideForwardTag(hidden: boolean): Promise<void> {
    const me = this.meId;
    if (!me) return;
    await this.sb.from('profiles').update({ hide_forward_tag: hidden }).eq('id', me);
  }

  async getHideForwardTag(): Promise<boolean> {
    const me = this.meId;
    if (!me) return false;
    const { data } = await this.sb.from('profiles').select('hide_forward_tag').eq('id', me).maybeSingle();
    return !!((data as { hide_forward_tag?: boolean } | null)?.hide_forward_tag);
  }

  /** 1 ghante ke andar expire hone wale (self-destruct) messages — warning ke liye. */
  async getExpiringSoon(): Promise<ChatMessage[]> {
    const me = this.meId;
    if (!me) return [];
    const now = Date.now();
    const { data: parts } = await this.sb.from('chat_participants').select('chat_id').eq('user_id', me);
    const chatIds = ((parts || []) as Array<{ chat_id: string }>).map((p) => p.chat_id);
    if (chatIds.length === 0) return [];
    const { data } = await this.sb
      .from('messages')
      .select('*')
      .in('chat_id', chatIds)
      .gt('self_destruct_at', now)
      .lte('self_destruct_at', now + 3600 * 1000)
      .order('self_destruct_at', { ascending: true })
      .limit(50);
    const rows = (data || []) as DbMessage[];
    const byChat = new Map<string, DbMessage[]>();
    for (const r of rows) {
      const arr = byChat.get(r.chat_id) || [];
      arr.push(r);
      byChat.set(r.chat_id, arr);
    }
    const out: ChatMessage[] = [];
    for (const [cid, arr] of byChat) out.push(...(await this.decryptRows(cid, arr)).map(toChatMessage));
    return out.sort((a, b) => (a.selfDestructAt || 0) - (b.selfDestructAt || 0));
  }

  /** WA-style message info: sent/delivered/read ke exact timestamps. */
  async getMessageInfo(messageId: string): Promise<MessageInfo> {
    const { data } = await this.sb
      .from('messages')
      .select('created_at,delivered_at,sender_id,read_at')
      .eq('id', messageId)
      .maybeSingle();
    const m = data as { created_at?: number | string; delivered_at?: number | string | null; sender_id?: string; read_at?: Record<string, number> } | null;
    if (!m) throw new Error('Message nahi mila');
    const sentAt = num(m.created_at);
    const deliveredAt = m.delivered_at ? num(m.delivered_at) : 0;
    // readAt = pehle non-sender reader ka waqt
    let readAt = 0;
    const readAtMap = m.read_at || {};
    for (const [uid, t] of Object.entries(readAtMap)) {
      if (uid === m.sender_id) continue;
      const ts = Number(t) || 0;
      if (ts > 0 && (!readAt || ts < readAt)) readAt = ts;
    }
    return { messageId, sentAt, deliveredAt, readAt };
  }

  /**
   * Auto-archive: 30 din se inactive chats (koi naya message nahi) archive karo.
   * Returns: kitni chats archive hui. App-start par chalao.
   */
  async autoArchiveInactive(): Promise<number> {
    const me = this.meId;
    if (!me) return 0;
    const cutoff = Date.now() - 30 * 24 * 3600 * 1000;
    const { data: parts } = await this.sb.from('chat_participants').select('chat_id').eq('user_id', me);
    const chatIds = ((parts || []) as Array<{ chat_id: string }>).map((p) => p.chat_id);
    if (chatIds.length === 0) return 0;
    const { data: chats } = await this.sb.from('chats').select('id,updated_at').in('id', chatIds).lt('updated_at', cutoff);
    const stale = ((chats || []) as Array<{ id: string }>) || [];
    if (stale.length === 0) return 0;
    // Pehle se archived ko dobara mat likho
    const { data: settings } = await this.sb
      .from('user_chat_settings')
      .select('chat_id,archived')
      .eq('user_id', me)
      .in('chat_id', stale.map((c) => c.id));
    const already = new Set(
      ((settings || []) as Array<{ chat_id: string; archived: boolean }>).filter((s) => s.archived).map((s) => s.chat_id)
    );
    const todo = stale.map((c) => c.id).filter((id) => !already.has(id));
    if (todo.length === 0) return 0;
    await this.sb.from('user_chat_settings').upsert(
      todo.map((chat_id) => ({ chat_id, user_id: me, archived: true })),
      { onConflict: 'chat_id,user_id' }
    );
    return todo.length;
  }

  // ==================== v5 additions (single-group pivot) ====================

  // ---- 1. Owner system ----

  /** v5: kya logged-in user owner hai? Pehchan email se: sherazgaming81@gmail.com */
  isOwner(): boolean {
    if (this.ownerIdCache && this.meId && this.meId === this.ownerIdCache) return true;
    return !!this.meId && !!this.meEmail && this.meEmail.toLowerCase() === OWNER_EMAIL;
  }

  /** v5: owner ka user id — profiles me email se dhoonda, cached. */
  async getOwnerId(): Promise<string | null> {
    if (this.ownerIdCache) return this.ownerIdCache;
    if (!this.ownerIdPromise) {
      this.ownerIdPromise = (async () => {
        try {
          const { data } = await this.sb.from('profiles').select('id').eq('email', OWNER_EMAIL).maybeSingle();
          const id = (data as { id?: string } | null)?.id || null;
          if (id) this.ownerIdCache = id;
          return id;
        } catch {
          return null;
        }
      })();
    }
    return this.ownerIdPromise;
  }

  /**
   * v5: badge text — 'Owner' (owner ka id), custom role (user_roles table),
   * warna 'Member'. UI isi string ko badge me dikhaye.
   */
  async getRole(userId: string): Promise<string> {
    const ownerId = await this.getOwnerId();
    if ((ownerId && userId === ownerId) || (userId === this.meId && this.isOwner())) return 'Owner';
    try {
      const { data } = await this.sb.from('user_roles').select('role').eq('user_id', userId).maybeSingle();
      const role = (data as { role?: string } | null)?.role?.trim();
      return role || 'Member';
    } catch {
      return 'Member';
    }
  }

  /** v5: custom role lagao/hatayo — SIRF owner. Khali ya 'Member' = role hatao. */
  async setUserRole(userId: string, role: string): Promise<void> {
    if (!this.isOwner()) throw new Error('Sirf owner roles de sakta hai');
    const r = (role || '').trim().slice(0, 30);
    if (!r || /^member$/i.test(r)) {
      await this.sb.from('user_roles').delete().eq('user_id', userId);
      return;
    }
    await this.sb.from('user_roles').upsert({ user_id: userId, role: r }, { onConflict: 'user_id' });
  }

  // ---- 2. Single-group enforcement ----

  /** v5: Madrasa Group ka Chat object (id 'main-group', naam me 'madrasa', ya is_main_group). */
  async getMainGroup(): Promise<Chat | null> {
    const chats = await this.fetchChats();
    return (
      chats.find((c) => c.isMainGroup) ||
      chats.find((c) => c.id === MAIN_GROUP_ID) ||
      chats.find((c) => /madrasa/i.test(c.name || '')) ||
      null
    );
  }

  /**
   * v5: har login par user ko Madrasa Group me auto-add karo.
   * Ban user skip hota hai (khamoshi se — login flow nahi rokna).
   * Group na bana ho to banao (owner admin banta hai).
   */
  async ensureMemberAutoJoin(userId?: string): Promise<string> {
    const uid = userId || this.meId;
    if (!uid) throw new Error('Not signed in');
    const { data: ban } = await this.sb
      .from('bans')
      .select('user_id')
      .eq('chat_id', MAIN_GROUP_ID)
      .eq('user_id', uid)
      .maybeSingle();
    if (ban) return MAIN_GROUP_ID;
    const { data: existing } = await this.sb.from('chats').select('id').eq('id', MAIN_GROUP_ID).maybeSingle();
    if (!existing) {
      const ownerId = (await this.getOwnerId()) || uid;
      await this.sb.from('chats').insert({
        id: MAIN_GROUP_ID,
        type: 'group',
        name: 'Madrasa Group',
        admin_ids: [ownerId],
        is_main_group: true,
        description: 'Sab doston ka group — ChatsApp',
        updated_at: Date.now(),
      });
    }
    await this.sb.from('chat_participants').upsert(
      { chat_id: MAIN_GROUP_ID, user_id: uid },
      { onConflict: 'chat_id,user_id', ignoreDuplicates: true }
    );
    return MAIN_GROUP_ID;
  }

  /**
   * v5: kya user group chhor sakta hai? Members ke liye HAMESHA false (no-leave).
   * Sirf owner manage kar sakta hai.
   */
  canLeaveGroup(): boolean {
    return this.isOwner();
  }

  // ---- 3. Owner commands ----

  /**
   * v5: '/' se shuru hone wale text ko parse karo.
   * UI: sendMessage se PEHLE isay call karo; natija mile to executeCommand chalao,
   * warna aam message bhejo. Sirf owner ke commands execute hote hain.
   */
  parseCommand(text: string): ParsedCommand | null {
    const t = (text || '').trim();
    if (!t.startsWith('/')) return null;
    const sp = t.indexOf(' ');
    const command = (sp < 0 ? t.slice(1) : t.slice(1, sp)).toLowerCase();
    if (!command) return null;
    const rawArgs = sp < 0 ? '' : t.slice(sp + 1).trim();
    return { command, args: rawArgs ? rawArgs.split(/\s+/) : [], rawArgs };
  }

  /**
   * v5: owner command chalao. Sirf owner — warna Error.
   * Commands: /mute, /timeout, /unmute, /ban, /unban, /warn, /lock, /unlock,
   *           /announce, /clear, /stats
   */
  async executeCommand(command: string, args: string[], chatId?: string): Promise<CommandResult> {
    if (!this.meId) throw new Error('Not signed in');
    if (!this.isOwner()) throw new Error('Ye command sirf owner chala sakta hai');
    const cid = chatId || MAIN_GROUP_ID;
    const cmd = command.toLowerCase().replace(/^\//, '');
    switch (cmd) {
      case 'mute':
      case 'timeout':
        return this.cmdMute(cid, args);
      case 'unmute':
        return this.cmdUnmute(cid, args);
      case 'ban':
        return this.cmdBan(cid, args);
      case 'unban':
        return this.cmdUnban(cid, args);
      case 'warn':
        return this.cmdWarn(cid, args);
      case 'slowmode':
        return this.cmdSlowmode(cid, args);
      case 'lock':
        return this.cmdLockUnlock(true);
      case 'unlock':
        return this.cmdLockUnlock(false);
      case 'announce':
        return this.cmdAnnounce(cid, args);
      case 'clear':
        return this.cmdClear(cid, args);
      case 'stats':
        return this.cmdStats(cid);
      default:
        throw new Error(`'/${cmd}' koi command nahi hai`);
    }
  }

  /** '30s' | '10m' | '2h' | '1d' -> milliseconds. Ghalat ho to null. */
  private parseDurationToken(tok: string): number | null {
    const m = /^(\d+)(s|m|h|d)$/i.exec((tok || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (n <= 0 || n > 365) return null;
    const mult: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return n * (mult[m[2].toLowerCase()] || 0);
  }

  /**
   * v5: naam se user dhoondo (fuzzy). "@Ahmed", "ahmed", "Ahmed Khan" sab chalte
   * hain. UI auto-suggest se seedha userId bhi de sakti hai — wo pehle check hota hai.
   */
  async resolveUserByName(chatId: string, nameQuery: string): Promise<{ userId: string; displayName: string } | null> {
    const q = (nameQuery || '').trim().replace(/^@+/, '').toLowerCase();
    if (!q) return null;
    const parts = await this.getChatParticipantsForMentions(chatId);
    // Seedha userId mila ho to
    const byId = parts.find((p) => p.userId === (nameQuery || '').trim());
    if (byId) return byId;
    let hit = parts.find((p) => p.displayName.toLowerCase() === q);
    if (!hit) hit = parts.find((p) => p.displayName.toLowerCase().startsWith(q));
    if (!hit) hit = parts.find((p) => p.displayName.toLowerCase().includes(q));
    if (!hit) hit = parts.find((p) => p.displayName.toLowerCase().split(/\s+/)[0] === q);
    return hit || null;
  }

  /**
   * Command tokens me se target user nikalo — sab se LAMBA naam pehle try karo
   * ("Ahmed Khan" > "Ahmed"), baqi tokens `rest` me (wajah waghera ke liye).
   */
  private async resolveCommandTarget(
    chatId: string,
    tokens: string[]
  ): Promise<{ userId: string; displayName: string; rest: string[] } | null> {
    const clean = tokens.map((t) => t.replace(/^@+/, ''));
    if (clean.length === 0 || clean.every((t) => !t)) return null;
    for (let k = clean.length; k >= 1; k--) {
      const name = clean.slice(0, k).join(' ');
      if (!name.trim()) continue;
      const hit = await this.resolveUserByName(chatId, name);
      if (hit) return { userId: hit.userId, displayName: hit.displayName, rest: tokens.slice(k) };
    }
    return null;
  }

  private async cmdMute(chatId: string, args: string[]): Promise<CommandResult> {
    // Duration token dhoondo (aakhri duration jaisa token jeet-ta hai); default 10 minute
    let durIdx = -1;
    let durMs = 10 * 60 * 1000;
    for (let i = 0; i < args.length; i++) {
      const d = this.parseDurationToken(args[i]);
      if (d !== null) {
        durIdx = i;
        durMs = d;
      }
    }
    const nameTokens = durIdx >= 0 ? args.slice(0, durIdx) : args;
    const reason = durIdx >= 0 ? args.slice(durIdx + 1).join(' ').trim() : '';
    const target = await this.resolveCommandTarget(chatId, nameTokens);
    if (!target) throw new Error('User nahi mila — naam sahi likhein (misal /mute @ahmed 10m)');
    if (target.userId === this.meId) throw new Error('Khud ko mute nahi kar sakte');
    await this.sb.from('mutes').upsert(
      { chat_id: chatId, user_id: target.userId, muted_until: Date.now() + durMs, reason: reason || null },
      { onConflict: 'chat_id,user_id' }
    );
    return { ok: true, text: `🔇 ${target.displayName} ${formatMs(durMs)} ke liye mute${reason ? ` — ${reason}` : ''}` };
  }

  private async cmdUnmute(chatId: string, args: string[]): Promise<CommandResult> {
    const target = await this.resolveCommandTarget(chatId, args);
    if (!target) throw new Error('User nahi mila — naam sahi likhein (misal /unmute @ahmed)');
    await this.sb.from('mutes').delete().eq('chat_id', chatId).eq('user_id', target.userId);
    return { ok: true, text: `🔊 ${target.displayName} ka mute khatam` };
  }

  private async cmdBan(chatId: string, args: string[]): Promise<CommandResult> {
    const target = await this.resolveCommandTarget(chatId, args);
    if (!target) throw new Error('User nahi mila — naam sahi likhein (misal /ban @ahmed wajah)');
    if (target.userId === this.meId) throw new Error('Khud ko ban nahi kar sakte');
    const reason = target.rest.join(' ').trim() || null;
    await this.sb.from('bans').upsert(
      { chat_id: chatId, user_id: target.userId, reason },
      { onConflict: 'chat_id,user_id' }
    );
    await this.sb.from('chat_participants').delete().eq('chat_id', chatId).eq('user_id', target.userId);
    await this.sb.from('mutes').delete().eq('chat_id', chatId).eq('user_id', target.userId);
    return { ok: true, text: `🚫 ${target.displayName} ko group se ban kar diya${reason ? ` — wajah: ${reason}` : ''}` };
  }

  private async cmdUnban(chatId: string, args: string[]): Promise<CommandResult> {
    const target = await this.resolveCommandTarget(chatId, args);
    if (!target) throw new Error('User nahi mila — naam sahi likhein (misal /unban @ahmed)');
    await this.unbanUser(chatId, target.userId);
    return { ok: true, text: `✅ ${target.displayName} ka ban hata diya — ab group me wapas aa sakta hai` };
  }

  private async cmdWarn(chatId: string, args: string[]): Promise<CommandResult> {
    const target = await this.resolveCommandTarget(chatId, args);
    if (!target) throw new Error('User nahi mila — naam sahi likhein (misal /warn @ahmed wajah)');
    if (target.userId === this.meId) throw new Error('Khud ko warn nahi kar sakte');
    const reason = target.rest.join(' ').trim() || null;
    await this.sb.from('warns').insert({ chat_id: chatId, user_id: target.userId, reason, created_at: Date.now() });
    const { data } = await this.sb.from('warns').select('id').eq('chat_id', chatId).eq('user_id', target.userId);
    const count = (data || []).length;
    let extra = '';
    if (count >= 3) {
      // 3 warnings = 1 minute auto-mute
      await this.sb.from('mutes').upsert(
        { chat_id: chatId, user_id: target.userId, muted_until: Date.now() + 60000, reason: '3 warnings — auto mute' },
        { onConflict: 'chat_id,user_id' }
      );
      extra = ' — 3 warnings par 1 minute ke liye auto-mute kar diya';
    }
    return { ok: true, text: `⚠️ ${target.displayName} ko warning #${count} mili${reason ? ` — ${reason}` : ''}${extra}` };
  }

  private async cmdSlowmode(chatId: string, args: string[]): Promise<CommandResult> {
    // /slowmode @ahmed 30 — aakhri numeric token seconds hai; 0 = slow mode hatao
    let secs = 0;
    let secsIdx = -1;
    for (let i = args.length - 1; i >= 0; i--) {
      const tok = (args[i] || '').trim();
      if (/^\d+$/.test(tok)) {
        secs = parseInt(tok, 10);
        secsIdx = i;
        break;
      }
    }
    const nameTokens = secsIdx >= 0 ? args.filter((_, i) => i !== secsIdx) : args;
    const target = await this.resolveCommandTarget(chatId, nameTokens);
    if (!target) throw new Error('User nahi mila — naam sahi likhein (misal /slowmode @ahmed 30)');
    await this.setMemberSlow(chatId, target.userId, secs);
    return {
      ok: true,
      text:
        secs > 0
          ? `🐢 ${target.displayName} par slow mode lag gaya — har ${secs} second me 1 message`
          : `🚀 ${target.displayName} ka slow mode hata diya`,
    };
  }

  private async cmdLockUnlock(locked: boolean): Promise<CommandResult> {
    await this.setGroupLocked(locked);
    return {
      ok: true,
      text: locked
        ? '🔒 Group lock ho gaya — ab sirf owner message bhej sakta hai'
        : '🔓 Group unlock ho gaya — sab message bhej sakte hain',
    };
  }

  /** v5: group lock lagao/hatayo — SIRF owner (group_settings key='locked'). */
  async setGroupLocked(locked: boolean): Promise<void> {
    if (!this.isOwner()) throw new Error('Sirf owner group lock kar sakta hai');
    await this.sb.from('group_settings').upsert({ key: 'locked', value: locked }, { onConflict: 'key' });
  }

  /** v5: kya group lock hai? (lock me owner ke siwa koi message nahi bhej sakta) */
  async isGroupLocked(_chatId?: string): Promise<boolean> {
    try {
      const { data } = await this.sb.from('group_settings').select('value').eq('key', 'locked').maybeSingle();
      const v = (data as { value?: unknown } | null)?.value;
      if (v === true) return true;
      if (v && typeof v === 'object') return (v as { locked?: unknown }).locked === true;
      return false;
    } catch {
      return false;
    }
  }

  private async cmdAnnounce(chatId: string, args: string[]): Promise<CommandResult> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    const text = args.join(' ').trim();
    if (!text) throw new Error('Likhein: /announce <text>');
    const now = Date.now();
    const base: Record<string, unknown> = {
      chat_id: chatId,
      sender_id: me,
      sender_name: OWNER_DISPLAY_NAME,
      type: 'text',
      text,
      created_at: now,
      read_by: [me],
      is_announcement: true,
    };
    let storedText = text;
    const { error } = await this.sb.from('messages').insert(base);
    if (error) {
      if (/is_announcement/i.test(error.message)) {
        // Column abhi schema me nahi — bina flag ke bhejo, 📢 prefix ke sath
        const retry: Record<string, unknown> = { ...base, text: `📢 ${text}` };
        delete retry.is_announcement;
        const { error: e2 } = await this.sb.from('messages').insert(retry);
        if (e2) throw new Error('Announcement nahi bheja ja saka');
        storedText = `📢 ${text}`;
      } else {
        throw new Error('Announcement nahi bheja ja saka');
      }
    }
    await this.sb.from('chats').update({
      last_message: {
        text: `📢 ${storedText.slice(0, 80)}`,
        senderId: me,
        senderName: OWNER_DISPLAY_NAME,
        createdAt: now,
        type: 'text',
      } as LastMessage,
      updated_at: now,
    }).eq('id', chatId);
    this.firePush(chatId, OWNER_DISPLAY_NAME, `📢 ${text}`.slice(0, 80));
    return { ok: true, text: '📢 Announcement bhej diya gaya' };
  }

  private async cmdClear(chatId: string, args: string[]): Promise<CommandResult> {
    const arg = (args[0] || '').toLowerCase();
    let ids: string[];
    if (arg === 'all') {
      const { data } = await this.sb.from('messages').select('id').eq('chat_id', chatId);
      ids = ((data || []) as Array<{ id: string }>).map((r) => r.id);
    } else {
      const n = Math.max(1, Math.min(500, parseInt(arg, 10) || 0));
      if (!n) throw new Error('Likhein: /clear <number|all> — misal /clear 10 ya /clear all');
      const { data } = await this.sb
        .from('messages')
        .select('id')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(n);
      ids = ((data || []) as Array<{ id: string }>).map((r) => r.id);
    }
    for (let i = 0; i < ids.length; i += 100) {
      await this.sb.from('messages').delete().in('id', ids.slice(i, i + 100));
    }
    await this.sb.from('chats').update({ last_message: null, updated_at: Date.now() }).eq('id', chatId);
    return { ok: true, text: `🧹 ${ids.length} messages delete kar diye` };
  }

  private async cmdStats(chatId: string): Promise<CommandResult> {
    const analytics = await this.getChatAnalytics(chatId);
    const { data: parts } = await this.sb.from('chat_participants').select('user_id').eq('chat_id', chatId);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const { count: today } = await this.sb
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('chat_id', chatId)
      .gte('created_at', dayStart.getTime());
    const topSenders = analytics.perUser.slice(0, 5).map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      count: p.count,
    }));
    const stats: CommandStats = {
      totalMessages: analytics.totalMessages,
      activeMembers: (parts || []).length,
      messagesToday: today || 0,
      topSenders,
    };
    const top = topSenders.map((t, i) => `${i + 1}. ${t.displayName} — ${t.count}`).join('\n') || '—';
    return {
      ok: true,
      text: `📊 Group stats:\n• Kul messages: ${stats.totalMessages}\n• Aaj ke messages: ${stats.messagesToday}\n• Members: ${stats.activeMembers}\n• Top senders:\n${top}`,
      stats,
    };
  }

  // ---- 4. Mute enforcement ----

  /**
   * v5: kya user mute hai? Expired mutes ki lazy-safai bhi yahin hoti hai.
   */
  async isMuted(chatId?: string, userId?: string): Promise<{ muted: boolean; remainingMs: number }> {
    const cid = chatId || MAIN_GROUP_ID;
    const uid = userId || this.meId;
    if (!uid) return { muted: false, remainingMs: 0 };
    const now = Date.now();
    await this.sb.from('mutes').delete().eq('chat_id', cid).eq('user_id', uid).lte('muted_until', now);
    const { data } = await this.sb
      .from('mutes')
      .select('muted_until')
      .eq('chat_id', cid)
      .eq('user_id', uid)
      .maybeSingle();
    const until = num((data as { muted_until?: number | string } | null)?.muted_until);
    if (until > now) return { muted: true, remainingMs: until - now };
    return { muted: false, remainingMs: 0 };
  }

  /**
   * v5: bhejne se pehle guard — ban/mute/lock check. Ruka to Hinglish Error.
   * sendMessage aur insertSpecialMessage dono isi ko call karte hain.
   */
  private async assertCanSend(chatId: string): Promise<void> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    const { data: ban } = await this.sb
      .from('bans')
      .select('user_id')
      .eq('chat_id', chatId)
      .eq('user_id', me)
      .maybeSingle();
    if (ban) throw new Error('Aap is group se ban hain');
    const { muted, remainingMs } = await this.isMuted(chatId, me);
    if (muted) throw new Error(`Aap ${formatMs(remainingMs)} ke liye mute hain — waqt poora hone par dobara try karein`);
    if (!this.isOwner() && (await this.isGroupLocked(chatId))) {
      throw new Error('Group lock hai — sirf owner message bhej sakta hai');
    }
  }

  // ---- 6. Speed (v5) ----

  /**
   * v5 speed: temp message FORAN wapas milta hai (UI turant render kare),
   * asal persist background me hota hai. `sent` par error aaye to UI temp
   * message hata kar error dikhaye.
   */
  sendMessageOptimistic(
    chatId: string,
    input: SendInput,
    sender: { id: string; displayName: string }
  ): { temp: ChatMessage; sent: Promise<void> } {
    const temp = this.buildLocalMessage(chatId, input, sender);
    const sent = this.sendMessage(chatId, input);
    // Caller `sent` ko khud await/catch karega — yahan sirf unhandled warning roko
    sent.catch(() => {});
    return { temp, sent };
  }

  /**
   * v5 speed: realtime event ka PAYLOAD seedha istemal karo (payload.new) —
   * naya message aane par dobara fetch mat karo. UI message ko foran list me
   * daal sakti hai (onMessages wali poori refresh ki zaroorat nahi).
   */
  onMessagePayload(chatId: string, cb: (msg: ChatMessage, event: 'INSERT' | 'UPDATE' | 'DELETE') => void): () => void {
    const ch = this.track(
      this.sb
        .channel(`msgs-payload-${chatId}-${++this.chanSeq}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
          (payload) => {
            try {
              const p = payload as unknown as { eventType: string; new?: DbMessage; old?: DbMessage };
              const row = p.eventType === 'DELETE' ? p.old : p.new;
              if (!row || !row.id) return;
              cb(toChatMessage(row), p.eventType as 'INSERT' | 'UPDATE' | 'DELETE');
            } catch (e) {
              console.error('onMessagePayload handler failed:', e);
            }
          }
        )
        .subscribe()
    );
    return () => {
      this.sb.removeChannel(ch);
      this.channels = this.channels.filter((x) => x !== ch);
    };
  }

  /**
   * v5: Supabase Presence — user ko presence channel par track karo.
   * Disconnect/tab-close par Supabase khud seconds me entry hata deta hai
   * (60-sec heartbeat ki tarah atka "online" nahi rehta).
   */
  trackPresence(userId?: string, meta?: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    const uid = userId || this.meId;
    if (!uid) return;
    const payload = { user_id: uid, online: true, lastSeen: Date.now(), ...(meta || {}) };
    if (this.presenceCh) {
      this.presenceCh.track(payload).catch(() => {});
      return;
    }
    const ch = this.sb.channel('presence-global', { config: { presence: { key: uid } } });
    ch.on('presence', { event: 'sync' }, () => this.emitPresenceState(ch))
      .on('presence', { event: 'join' }, () => this.emitPresenceState(ch))
      .on('presence', { event: 'leave' }, () => this.emitPresenceState(ch));
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await ch.track(payload);
        } catch {
          /* ignore */
        }
      }
    });
    this.presenceCh = this.track(ch);
  }

  private emitPresenceState(ch: RealtimeChannel): void {
    try {
      const raw = ch.presenceState() as Record<string, Array<Record<string, unknown>>>;
      const out: Record<string, PresenceState> = {};
      for (const metas of Object.values(raw)) {
        for (const m of metas) {
          const uid = typeof m.user_id === 'string' ? m.user_id : '';
          if (!uid) continue;
          out[uid] = { online: true, lastSeen: Number(m.lastSeen) || Date.now() };
        }
      }
      this.presenceStateMap = new Map(Object.entries(out));
      this.presenceCbs.forEach((cb) => {
        try {
          cb(out);
        } catch {
          /* ignore */
        }
      });
    } catch (e) {
      console.error('emitPresenceState failed:', e);
    }
  }

  /**
   * v5: presence tabdeelion par subscribe karo — har sync/join/leave par
   * poori online-state milti hai. Foran maujooda state bhi bhej di jati hai.
   * Returns: unsubscribe function.
   */
  onPresenceChange(cb: (state: Record<string, PresenceState>) => void): () => void {
    this.presenceCbs.add(cb);
    try {
      cb(Object.fromEntries(this.presenceStateMap));
    } catch {
      /* ignore */
    }
    return () => {
      this.presenceCbs.delete(cb);
    };
  }

  // ---- 7. Unban helper (v5) ----

  /**
   * v5: user ko ban se hatao aur group me wapas add karo — SIRF owner.
   * /unban command isi ko chalata hai; OwnerDashboard bhi.
   */
  async unbanUser(chatId: string, userId: string): Promise<void> {
    if (!this.isOwner()) throw new Error('Sirf owner unban kar sakta hai');
    await this.sb.from('bans').delete().eq('chat_id', chatId).eq('user_id', userId);
    await this.sb.from('chat_participants').upsert(
      { chat_id: chatId, user_id: userId },
      { onConflict: 'chat_id,user_id', ignoreDuplicates: true }
    );
  }

  /** v5: mute hatao — SIRF owner (OwnerDashboard ke liye). */
  async unmuteUser(chatId: string, userId: string): Promise<void> {
    if (!this.isOwner()) throw new Error('Sirf owner unmute kar sakta hai');
    await this.sb.from('mutes').delete().eq('chat_id', chatId).eq('user_id', userId);
  }

  // ---- 8. Moderation lists (v5, owner dashboard ke liye) ----

  /** v5: mute hue users — baqi muddat (remainingMs) aur wajah ke sath. */
  async getMutedUsers(
    chatId: string
  ): Promise<Array<{ userId: string; displayName: string; until: number; remainingMs: number; reason?: string }>> {
    const now = Date.now();
    try {
      await this.sb.from('mutes').delete().eq('chat_id', chatId).lte('muted_until', now);
      const { data } = await this.sb.from('mutes').select('user_id,muted_until,reason').eq('chat_id', chatId);
      const rows = (data || []) as Array<{ user_id: string; muted_until: number | string; reason: string | null }>;
      const names = await this.displayNames(rows.map((r) => r.user_id));
      return rows
        .map((r) => {
          const until = num(r.muted_until);
          return {
            userId: r.user_id,
            displayName: names.get(r.user_id) || 'User',
            until,
            remainingMs: Math.max(0, until - now),
            reason: r.reason || undefined,
          };
        })
        .filter((r) => r.remainingMs > 0)
        .sort((a, b) => a.remainingMs - b.remainingMs);
    } catch (e) {
      console.error('getMutedUsers failed:', e);
      return [];
    }
  }

  /** v5: ban hue users ki list (wajah ke sath). */
  async getBannedUsers(
    chatId: string
  ): Promise<Array<{ userId: string; displayName: string; at: number; reason?: string }>> {
    try {
      const { data } = await this.sb.from('bans').select('user_id,reason,created_at').eq('chat_id', chatId);
      const rows = (data || []) as Array<{ user_id: string; reason: string | null; created_at: number | string | null }>;
      const names = await this.displayNames(rows.map((r) => r.user_id));
      return rows.map((r) => ({
        userId: r.user_id,
        displayName: names.get(r.user_id) || 'User',
        at: r.created_at ? num(r.created_at) : 0,
        reason: r.reason || undefined,
      }));
    } catch (e) {
      console.error('getBannedUsers failed:', e);
      return [];
    }
  }

  /**
   * v5: warnings — har warning ek row; `count` me us user ki kul warnings.
   * (OwnerDashboard per-user group karke dikhata hai.)
   */
  async getWarnings(
    chatId: string
  ): Promise<
    Array<{ id: string; userId: string; displayName: string; reason: string; at: number; by: string; count: number }>
  > {
    try {
      const { data } = await this.sb
        .from('warns')
        .select('id,user_id,reason,created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false });
      const rows = (data || []) as Array<{
        id: string;
        user_id: string;
        reason: string | null;
        created_at: number | string | null;
      }>;
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1);
      const names = await this.displayNames(rows.map((r) => r.user_id));
      return rows.map((r) => ({
        id: String(r.id),
        userId: r.user_id,
        displayName: names.get(r.user_id) || 'User',
        reason: r.reason || '—',
        at: r.created_at ? num(r.created_at) : 0,
        by: OWNER_DISPLAY_NAME, // warn sirf owner de sakta hai
        count: counts.get(r.user_id) || 1,
      }));
    } catch (e) {
      console.error('getWarnings failed:', e);
      return [];
    }
  }

  /** v5: ek warning hatao — SIRF owner. */
  async clearWarning(chatId: string, warnId: string): Promise<void> {
    if (!this.isOwner()) throw new Error('Sirf owner warning hata sakta hai');
    await this.sb.from('warns').delete().eq('id', warnId).eq('chat_id', chatId);
  }

  /** user ids -> display names (moderation lists ke liye helper). */
  private async displayNames(userIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const ids = [...new Set(userIds.filter(Boolean))];
    if (ids.length === 0) return out;
    try {
      const { data } = await this.sb.from('profiles').select('id,display_name').in('id', ids);
      for (const p of (data || []) as Array<{ id: string; display_name: string }>) {
        out.set(p.id, p.display_name || 'User');
      }
    } catch {
      /* ignore */
    }
    return out;
  }

  // ---- 9. Per-member slow mode (v5) ----

  /**
   * v5: member par slow mode lagao/hatayo — SIRF owner.
   * seconds=0 (ya negative) = slow mode hatao.
   * Table: slow_modes(chat_id, user_id, slow_seconds).
   */
  async setMemberSlow(chatId: string, userId: string, seconds: number): Promise<void> {
    if (!this.isOwner()) throw new Error('Sirf owner slow mode laga sakta hai');
    if (userId === this.meId) throw new Error('Khud par slow mode nahi laga sakte');
    const s = Math.max(0, Math.floor(seconds || 0));
    if (s <= 0) {
      await this.sb.from('slow_modes').delete().eq('chat_id', chatId).eq('user_id', userId);
      return;
    }
    if (s > 86400) throw new Error('Slow mode zyada se zyada 24 ghante ka ho sakta hai');
    await this.sb.from('slow_modes').upsert(
      { chat_id: chatId, user_id: userId, slow_seconds: s },
      { onConflict: 'chat_id,user_id' }
    );
  }

  /** v5: desktop contract ka naam (setMemberSlowMode) — wahi kaam. */
  async setMemberSlowMode(chatId: string, userId: string, seconds: number): Promise<void> {
    return this.setMemberSlow(chatId, userId, seconds);
  }

  /** v5: member ka slow mode (seconds) — 0 = koi limit nahi. */
  async getMemberSlow(chatId: string, userId: string): Promise<number> {
    try {
      const { data } = await this.sb
        .from('slow_modes')
        .select('slow_seconds')
        .eq('chat_id', chatId)
        .eq('user_id', userId)
        .maybeSingle();
      return Math.max(0, num((data as { slow_seconds?: number | string } | null)?.slow_seconds));
    } catch {
      return 0;
    }
  }

  // ---- 10. Group theme (v5) ----

  /**
   * v5: group theme — group_themes(chat_id, theme jsonb).
   * Na mile to null (UI localStorage fallback istemal karti hai).
   */
  async getGroupTheme(chatId: string): Promise<{ kind: string; presetId?: string; url?: string; mediaType?: string } | null> {
    try {
      const { data } = await this.sb.from('group_themes').select('theme').eq('chat_id', chatId).maybeSingle();
      const t = (data as { theme?: unknown } | null)?.theme;
      if (t && typeof t === 'object') {
        const o = t as { kind?: unknown; presetId?: unknown; url?: unknown; mediaType?: unknown };
        if (typeof o.kind === 'string') {
          return {
            kind: o.kind,
            presetId: typeof o.presetId === 'string' ? o.presetId : undefined,
            url: typeof o.url === 'string' ? o.url : undefined,
            mediaType: o.mediaType === 'image' || o.mediaType === 'video' ? o.mediaType : undefined,
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /** v5: group theme set karo — SIRF owner. */
  async setGroupTheme(chatId: string, theme: { kind: string; presetId?: string; url?: string; mediaType?: string }): Promise<void> {
    if (!this.isOwner()) throw new Error('Sirf owner theme badal sakta hai');
    await this.sb.from('group_themes').upsert({ chat_id: chatId, theme }, { onConflict: 'chat_id' });
  }

  // ---- 11. Group stats (v5) ----

  /**
   * v5: group stats — { totalMessages, activeMembers, messagesToday, topSenders }.
   * OwnerDashboard isi ko dikhata hai; /stats command bhi isi par bana hai.
   */
  async getGroupStats(chatId: string): Promise<{
    totalMessages: number;
    activeMembers: number;
    messagesToday: number;
    topSenders: Array<{ userId: string; displayName: string; count: number }>;
  }> {
    try {
      const analytics = await this.getChatAnalytics(chatId);
      const { data: parts } = await this.sb.from('chat_participants').select('user_id').eq('chat_id', chatId);
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const { count: today } = await this.sb
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('chat_id', chatId)
        .gte('created_at', dayStart.getTime());
      return {
        totalMessages: analytics.totalMessages,
        activeMembers: ((parts || []) as Array<{ user_id: string }>).length,
        messagesToday: today || 0,
        topSenders: analytics.perUser.slice(0, 5).map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          count: p.count,
        })),
      };
    } catch (e) {
      console.error('getGroupStats failed:', e);
      return { totalMessages: 0, activeMembers: 0, messagesToday: 0, topSenders: [] };
    }
  }

  // ---- 12. v5 fresh-start reset (v5) ----

  /**
   * v5: FRESH START (user demand). Owner ke login par SIRF EK DAFA chalta hai —
   * group_settings key 'v5_reset_done' flag hai.
   * - 'main-group' ke siwa TAMAM chats delete (participants/messages samet)
   * - main-group ke TAMAM messages delete (chat row rehti hai — fresh start)
   * - mutes / warns / bans / slow_modes sab saaf (clean slate)
   * - Owner ki profile KABHI delete nahi hoti (profiles ko haath nahi lagata)
   */
  async runV5ResetIfNeeded(): Promise<void> {
    if (!this.isOwner()) return;
    try {
      const { data: flag } = await this.sb.from('group_settings').select('value').eq('key', 'v5_reset_done').maybeSingle();
      if ((flag as { value?: unknown } | null)?.value) return; // pehle ho chuka — dobara kabhi nahi
      console.log('[v5] fresh-start reset shuru…');

      // 1. main-group ke siwa tamam chats
      const { data: chats } = await this.sb.from('chats').select('id').neq('id', MAIN_GROUP_ID);
      const chatIds = ((chats || []) as Array<{ id: string }>).map((c) => c.id);
      for (let i = 0; i < chatIds.length; i += 50) {
        const batch = chatIds.slice(i, i + 50);
        await this.sb.from('chat_participants').delete().in('chat_id', batch);
        await this.sb.from('messages').delete().in('chat_id', batch);
        await this.sb.from('chats').delete().in('id', batch);
      }

      // 2. main-group ke tamam messages (chat row rehti hai)
      const { data: mids } = await this.sb.from('messages').select('id').eq('chat_id', MAIN_GROUP_ID);
      const msgIds = ((mids || []) as Array<{ id: string }>).map((m) => m.id);
      for (let i = 0; i < msgIds.length; i += 100) {
        await this.sb.from('messages').delete().in('id', msgIds.slice(i, i + 100));
      }
      await this.sb.from('chats').update({ last_message: null, updated_at: Date.now() }).eq('id', MAIN_GROUP_ID);

      // 3. moderation tables — clean slate
      for (const t of ['mutes', 'warns', 'bans', 'slow_modes']) {
        try {
          await this.sb.from(t).delete().neq('chat_id', '__never__');
        } catch {
          /* table na ho to skip */
        }
      }

      // 4. flag — dobara kabhi nahi chalega
      await this.sb.from('group_settings').upsert({ key: 'v5_reset_done', value: true }, { onConflict: 'key' });
      console.log('[v5] fresh-start reset mukammal.');
    } catch (e) {
      console.error('runV5ResetIfNeeded failed:', e);
    }
  }
}
