import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Chat,
  ChatBackend,
  ChatMessage,
  ChatNotificationSettings,
  LastMessage,
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
};

const num = (v: number | string | null | undefined): number => Number(v || 0);

function toUserProfile(p: DbProfile): UserProfile {
  return {
    id: p.id,
    displayName: p.display_name || 'User',
    email: p.email || '',
    photoURL: p.photo_url || '',
    about: p.about || 'Hey there! I am using Chat.',
    online: !!p.online,
    lastSeen: num(p.last_seen),
    coverURL: p.cover_url || '',
    privacy: (p.privacy as PrivacySettings) || { lastSeen: 'everyone', photo: 'everyone', online: 'everyone' },
    disappearingAfter: Number(p.disappearing_after || 0),
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
  };
}

export class SupabaseBackend implements ChatBackend {
  readonly mode = 'supabase' as const;
  private sb: SupabaseClient;
  private meId: string | null = null;
  private channels: RealtimeChannel[] = [];
  private presenceTimer: ReturnType<typeof setInterval> | null = null;
  private typingCache = new Map<string, Record<string, number>>();

  constructor() {
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
        cb(null);
        return;
      }
      this.meId = sessionUser.id;
      const meta = sessionUser.user_metadata || {};
      const row: Partial<DbProfile> = {
        id: sessionUser.id,
        display_name: meta.full_name || meta.name || 'User',
        email: sessionUser.email || '',
        photo_url: meta.avatar_url || meta.picture || '',
        online: true,
        last_seen: Date.now(),
      };
      await this.sb.from('profiles').upsert(row, { onConflict: 'id' });
      const { data: prof } = await this.sb.from('profiles').select('*').eq('id', sessionUser.id).single();
      this.startPresence();
      if (alive) cb(prof ? toUserProfile(prof as DbProfile) : null);
    };
    emit();
    const { data: listener } = this.sb.auth.onAuthStateChange(() => emit());
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }

  private startPresence() {
    if (this.presenceTimer || !this.meId) return;
    const beat = () => {
      if (!this.meId) return;
      this.sb.from('profiles').update({ online: true, last_seen: Date.now() }).eq('id', this.meId);
    };
    this.presenceTimer = setInterval(beat, 60000);
    const goOffline = () => {
      if (!this.meId) return;
      this.sb.from('profiles').update({ online: false, last_seen: Date.now() }).eq('id', this.meId);
    };
    window.addEventListener('beforeunload', goOffline);
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
        if (pr) profiles[pid] = { displayName: pr.displayName, photoURL: pr.photoURL, online: pr.online, lastSeen: pr.lastSeen };
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
    return chats;
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
        .channel('chats-list')
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

  onMessages(chatId: string, cb: (messages: ChatMessage[]) => void): () => void {
    let alive = true;
    const refresh = async () => {
      if (!alive) return;
      const { data } = await this.sb
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (alive) cb(((data || []) as DbMessage[]).map(toChatMessage));
    };
    refresh();
    const ch = this.track(
      this.sb
        .channel(`msgs-${chatId}`)
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
    const now = Date.now();
    const { data: prof } = await this.sb.from('profiles').select('display_name').eq('id', me).single();
    const senderName = (prof as { display_name?: string } | null)?.display_name || 'User';
    const preview = input.type === 'text' ? input.text : input.type === 'image' ? '📷 Photo' : '🎤 Voice message';
    await this.sb.from('messages').insert({
      chat_id: chatId,
      sender_id: me,
      sender_name: senderName,
      type: input.type,
      text: input.text,
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

  async getOrCreateDirectChat(otherId: string): Promise<string> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    if (!otherId || otherId === me) throw new Error('Ghalat user');
    const id = `dm_${[me, otherId].sort().join('_')}`;
    try {
      const { data: existing } = await this.sb.from('chats').select('id').eq('id', id).maybeSingle();
      if (!existing) {
        const { error: cErr } = await this.sb.from('chats').insert({ id, type: 'direct', updated_at: Date.now() });
        if (cErr) throw cErr;
        const { error: pErr } = await this.sb.from('chat_participants').insert([
          { chat_id: id, user_id: me },
          { chat_id: id, user_id: otherId },
        ]);
        if (pErr) throw pErr;
      }
      return id;
    } catch (e) {
      console.error('getOrCreateDirectChat failed:', e);
      throw new Error('Chat nahi khul saki, dobara try karein');
    }
  }

  async createGroup(name: string, memberIds: string[]): Promise<string> {
    const me = this.meId;
    if (!me) throw new Error('Not signed in');
    const members = [...new Set([me, ...memberIds])];
    const { data, error } = await this.sb
      .from('chats')
      .insert({ type: 'group', name, admin_ids: [me], updated_at: Date.now() })
      .select('id')
      .single();
    if (error || !data) throw new Error('Group nahi ban saka');
    await this.sb.from('chat_participants').insert(members.map((uid) => ({ chat_id: data.id, user_id: uid })));
    return data.id as string;
  }

  async uploadMedia(chatId: string, file: File): Promise<{ url: string; kind: 'image' | 'audio' }> {
    const kind = file.type.startsWith('audio') ? 'audio' : 'image';
    const path = `${chatId}/${Date.now()}_${file.name}`;
    const { error } = await this.sb.storage.from('chat-media').upload(path, file);
    if (error) throw error;
    const { data } = this.sb.storage.from('chat-media').getPublicUrl(path);
    return { url: data.publicUrl, kind };
  }

  async deleteMessage(chatId: string, messageId: string, forEveryone: boolean): Promise<void> {
    const me = this.meId;
    if (!me) return;
    if (forEveryone) {
      await this.sb.from('messages').update({ text: '🚫 This message was deleted', type: 'text', media_url: null }).eq('id', messageId);
    } else {
      const { data } = await this.sb.from('messages').select('deleted_for').eq('id', messageId).maybeSingle();
      const cur = ((data as { deleted_for?: string[] } | null)?.deleted_for || []) as string[];
      await this.sb.from('messages').update({ deleted_for: [...cur, me] }).eq('id', messageId);
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
    return ((data || []) as DbMessage[]).map(toChatMessage);
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
    const map = new Map(((data || []) as DbMessage[]).map((m) => [m.id, toChatMessage(m)]));
    return ids.map((id) => map.get(id)).filter((m): m is ChatMessage => !!m);
  }

  async editMessage(chatId: string, messageId: string, newText: string): Promise<void> {
    const t = newText.trim();
    if (!t) return;
    await this.sb.from('messages').update({ text: t, edited_at: Date.now() }).eq('id', messageId);
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
    await this.sb.from('messages').insert({
      chat_id: targetChatId,
      sender_id: me,
      sender_name: senderName,
      type: src.type,
      text: src.text,
      media_url: src.media_url,
      file_name: src.file_name,
      file_size: src.file_size,
      duration: src.duration,
      poll: src.poll,
      forwarded: true,
      created_at: now,
      read_by: [me],
    });
    const preview = src.type === 'text' ? src.text : src.type === 'image' ? '📷 Photo' : src.type === 'poll' ? '📊 Poll' : '📎 File';
    await this.sb.from('chats').update({
      last_message: { text: preview, senderId: me, senderName, createdAt: now, type: src.type } as LastMessage,
      updated_at: now,
    }).eq('id', targetChatId);
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
    return (data as { id: string }).id;
  }

  async votePoll(chatId: string, messageId: string, optionIndex: number): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const { data } = await this.sb.from('messages').select('poll').eq('id', messageId).maybeSingle();
    const poll = (data as { poll?: PollData } | null)?.poll;
    if (!poll) return;
    const votes: Record<string, string[]> = { ...(poll.votes || {}) };
    for (const k of Object.keys(votes)) votes[k] = (votes[k] || []).filter((u) => u !== me);
    const key = String(optionIndex);
    votes[key] = [...(votes[key] || []), me];
    await this.sb.from('messages').update({ poll: { ...poll, votes } }).eq('id', messageId);
  }

  async toggleReaction(chatId: string, messageId: string, emoji: string): Promise<void> {
    const me = this.meId;
    if (!me) return;
    const { data } = await this.sb.from('messages').select('reactions').eq('id', messageId).maybeSingle();
    const reactions: Record<string, string[]> = { ...(((data as { reactions?: Record<string, string[]> } | null)?.reactions) || {}) };
    const users = reactions[emoji] || [];
    reactions[emoji] = users.includes(me) ? users.filter((u) => u !== me) : [...users, me];
    if (reactions[emoji].length === 0) delete reactions[emoji];
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

  async removeMember(chatId: string, userId: string): Promise<void> {
    const me = this.meId;
    if (!me || userId === me) return;
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
    return ((data || []) as DbMessage[]).map(toChatMessage);
  }

  async getAuthToken(): Promise<string | null> {
    const { data } = await this.sb.auth.getSession();
    return data.session?.access_token || null;
  }
}
