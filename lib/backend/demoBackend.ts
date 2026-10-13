import type {
  Chat,
  ChatBackend,
  ChatMessage,
  SendInput,
  UserProfile,
} from './types';

const ME_ID = 'demo-me';
const STORE_KEY = 'chat-demo-v1';

const BOT_REPLIES = [
  'Haha sahi hai 😄',
  'Achha, phir baat karte hain!',
  'Bilkul, done ✅',
  'Yaar kal milte hain phir',
  '👍👍',
  'Samajh gaya, theek hai',
  'Interesting! Aur batao',
  'Hmm, sochne do zara 🤔',
  'Pakki baat? 😄',
  'Chalo theek hai, bye for now!',
];

function avatar(seed: number) {
  return `https://i.pravatar.cc/100?img=${seed}`;
}

function seed(): { chats: Chat[]; messages: Record<string, ChatMessage[]>; users: UserProfile[] } {
  const now = Date.now();
  const m = 60000;
  const users: UserProfile[] = [
    { id: ME_ID, displayName: 'Demo User', email: 'demo@chat.app', photoURL: '', about: 'Hey there! I am using Chat.', online: true, lastSeen: now },
    { id: 'u-ayesha', displayName: 'Ayesha Khan', email: 'ayesha@example.com', photoURL: avatar(47), about: 'Busy ✨', online: true, lastSeen: now },
    { id: 'u-bilal', displayName: 'Bilal Ahmed', email: 'bilal@example.com', photoURL: avatar(12), about: 'Cricket lover 🏏', online: false, lastSeen: now - 25 * m },
    { id: 'u-mama', displayName: 'Mama ❤', email: 'mama@example.com', photoURL: avatar(25), about: 'Duaon mein yaad rakhna', online: true, lastSeen: now },
    { id: 'u-sara', displayName: 'Sara Malik', email: 'sara@example.com', photoURL: avatar(32), about: 'Work mode 💼', online: false, lastSeen: now - 3 * 60 * m },
    { id: 'u-danish', displayName: 'Danish Raza', email: 'danish@example.com', photoURL: avatar(59), about: 'Gamer 🎮', online: true, lastSeen: now },
  ];
  const prof = (u: UserProfile) => ({ displayName: u.displayName, photoURL: u.photoURL, online: u.online });
  const byId = Object.fromEntries(users.map((u) => [u.id, u]));

  const chats: Chat[] = [
    {
      id: 'c-ayesha', type: 'direct', name: 'Ayesha Khan', photoURL: avatar(47),
      participants: [ME_ID, 'u-ayesha'],
      participantProfiles: { [ME_ID]: prof(byId[ME_ID]), 'u-ayesha': prof(byId['u-ayesha']) },
      updatedAt: now - 2 * m, typing: {},
    },
    {
      id: 'c-office', type: 'group', name: 'Office Group', photoURL: '',
      participants: [ME_ID, 'u-ayesha', 'u-bilal', 'u-sara'],
      participantProfiles: { [ME_ID]: prof(byId[ME_ID]), 'u-ayesha': prof(byId['u-ayesha']), 'u-bilal': prof(byId['u-bilal']), 'u-sara': prof(byId['u-sara']) },
      updatedAt: now - 15 * m, typing: {}, adminIds: ['u-sara'],
    },
    {
      id: 'c-mama', type: 'direct', name: 'Mama ❤', photoURL: avatar(25),
      participants: [ME_ID, 'u-mama'],
      participantProfiles: { [ME_ID]: prof(byId[ME_ID]), 'u-mama': prof(byId['u-mama']) },
      updatedAt: now - 60 * m, typing: {},
    },
    {
      id: 'c-bilal', type: 'direct', name: 'Bilal Ahmed', photoURL: avatar(12),
      participants: [ME_ID, 'u-bilal'],
      participantProfiles: { [ME_ID]: prof(byId[ME_ID]), 'u-bilal': prof(byId['u-bilal']) },
      updatedAt: now - 5 * 60 * m, typing: {},
    },
    {
      id: 'c-danish', type: 'direct', name: 'Danish Raza', photoURL: avatar(59),
      participants: [ME_ID, 'u-danish'],
      participantProfiles: { [ME_ID]: prof(byId[ME_ID]), 'u-danish': prof(byId['u-danish']) },
      updatedAt: now - 26 * 60 * m, typing: {},
    },
  ];

  const mk = (
    chatId: string, senderId: string, text: string, agoMin: number,
    extra: Partial<ChatMessage> = {}
  ): ChatMessage => ({
    id: `m-${chatId}-${agoMin}-${senderId}`,
    chatId,
    senderId,
    senderName: byId[senderId]?.displayName || 'User',
    type: 'text',
    text,
    createdAt: now - agoMin * m,
    readBy: senderId === ME_ID ? [ME_ID, ...chats.find((c) => c.id === chatId)!.participants.filter((p) => p !== ME_ID)] : [senderId, ME_ID],
    ...extra,
  });

  const messages: Record<string, ChatMessage[]> = {
    'c-ayesha': [
      mk('c-ayesha', 'u-ayesha', 'Assalam o Alaikum! Weekend ka kya plan hai? 😊', 120),
      mk('c-ayesha', ME_ID, 'Walaikum Assalam! Koi khaas nahi, tum batao', 115),
      mk('c-ayesha', 'u-ayesha', 'Chalo kahin chai peete hain ☕', 110),
      mk('c-ayesha', ME_ID, 'Done! Saturday evening?', 100),
      mk('c-ayesha', 'u-ayesha', 'Perfect 👍 main location bhejti hoon', 90, { readBy: ['u-ayesha'] }),
      mk('c-ayesha', 'u-ayesha', 'Ye dekho, nayi jagah khuli hai!', 3, { readBy: ['u-ayesha'] }),
    ],
    'c-office': [
      mk('c-office', 'u-sara', 'Team, kal 10 baje meeting hai, sab on time ⏰', 180),
      mk('c-office', ME_ID, 'Noted 👍', 175),
      mk('c-office', 'u-bilal', 'Main 5 min late ho sakta hoon', 170),
      mk('c-office', 'u-ayesha', 'Agenda kya hai?', 160),
      mk('c-office', 'u-sara', 'Q3 planning discuss karenge', 150),
      mk('c-office', 'u-sara', 'Slides ready hain kya?', 15, { readBy: ['u-sara'] }),
    ],
    'c-mama': [
      mk('c-mama', 'u-mama', 'Beta khana khaya? 🍲', 200),
      mk('c-mama', ME_ID, 'Ji Mama, abhi khaya ❤', 195),
      mk('c-mama', 'u-mama', 'Dawai time par lena!', 190),
      mk('c-mama', ME_ID, 'Ji zaroor 😊', 185),
      mk('c-mama', 'u-mama', 'Ghar kab aaoge?', 60, { readBy: ['u-mama'] }),
    ],
    'c-bilal': [
      mk('c-bilal', ME_ID, 'Match dekha kal? Kya innings thi! 🏏', 400),
      mk('c-bilal', 'u-bilal', 'Haan yaar, last over mein dil ruk gaya tha 😅', 390),
      mk('c-bilal', ME_ID, 'Agla match saath dekhte hain', 380),
      mk('c-bilal', 'u-bilal', 'Done, mere ghar aa jana', 300, { readBy: ['u-bilal', ME_ID] }),
    ],
    'c-danish': [
      mk('c-danish', 'u-danish', 'Bro naya game aaya hai, khelna hai? 🎮', 1600),
      mk('c-danish', ME_ID, 'Kaunsa? Download kar raha hoon', 1590),
      mk('c-danish', 'u-danish', 'Raat ko online aana phir', 1580, { readBy: ['u-danish', ME_ID] }),
    ],
  };

  for (const chat of chats) {
    const msgs = messages[chat.id] || [];
    const last = msgs[msgs.length - 1];
    if (last) {
      chat.lastMessage = {
        text: last.type === 'text' ? last.text : last.type === 'image' ? '📷 Photo' : '🎤 Voice message',
        senderId: last.senderId,
        senderName: last.senderName,
        createdAt: last.createdAt,
        type: last.type,
      };
      chat.updatedAt = last.createdAt;
    }
  }
  return { chats, messages, users };
}

export class DemoBackend implements ChatBackend {
  readonly mode = 'demo' as const;
  private user: UserProfile | null = null;
  private chats: Chat[] = [];
  private messages: Record<string, ChatMessage[]> = {};
  private users: UserProfile[] = [];
  private authCbs = new Set<(u: UserProfile | null) => void>();
  private chatCbs = new Set<(c: Chat[]) => void>();
  private msgCbs = new Map<string, Set<(m: ChatMessage[]) => void>>();
  private typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.chats = data.chats;
        this.messages = data.messages;
        this.users = data.users;
        return;
      }
    } catch { /* seed fresh */ }
    const s = seed();
    this.chats = s.chats;
    this.messages = s.messages;
    this.users = s.users;
    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ chats: this.chats, messages: this.messages, users: this.users }));
    } catch { /* ignore */ }
  }

  private emitChats() {
    const sorted = [...this.chats].sort((a, b) => b.updatedAt - a.updatedAt);
    this.chatCbs.forEach((cb) => cb(sorted));
  }

  private emitMessages(chatId: string) {
    const cbs = this.msgCbs.get(chatId);
    if (!cbs) return;
    const msgs = [...(this.messages[chatId] || [])].sort((a, b) => a.createdAt - b.createdAt);
    cbs.forEach((cb) => cb(msgs));
  }

  onAuth(cb: (user: UserProfile | null) => void): () => void {
    this.authCbs.add(cb);
    cb(this.user);
    return () => { this.authCbs.delete(cb); };
  }

  async signInWithGoogle(): Promise<void> {
    await new Promise((r) => setTimeout(r, 900));
    this.user = this.users.find((u) => u.id === ME_ID)!;
    this.authCbs.forEach((cb) => cb(this.user));
  }

  async signOut(): Promise<void> {
    this.user = null;
    this.authCbs.forEach((cb) => cb(null));
  }

  async updateProfile(patch: Partial<Pick<UserProfile, 'displayName' | 'about' | 'photoURL'>>): Promise<void> {
    if (!this.user) return;
    Object.assign(this.user, patch);
    const u = this.users.find((x) => x.id === ME_ID);
    if (u) Object.assign(u, patch);
    this.persist();
    this.authCbs.forEach((cb) => cb(this.user));
  }

  onChats(cb: (chats: Chat[]) => void): () => void {
    this.chatCbs.add(cb);
    cb([...this.chats].sort((a, b) => b.updatedAt - a.updatedAt));
    return () => { this.chatCbs.delete(cb); };
  }

  onMessages(chatId: string, cb: (messages: ChatMessage[]) => void): () => void {
    if (!this.msgCbs.has(chatId)) this.msgCbs.set(chatId, new Set());
    this.msgCbs.get(chatId)!.add(cb);
    cb([...(this.messages[chatId] || [])].sort((a, b) => a.createdAt - b.createdAt));
    return () => { this.msgCbs.get(chatId)?.delete(cb); };
  }

  async sendMessage(chatId: string, input: SendInput): Promise<void> {
    if (!this.user) return;
    const chat = this.chats.find((c) => c.id === chatId);
    if (!chat) return;
    const now = Date.now();
    const msg: ChatMessage = {
      id: `m-${now}-${Math.random().toString(36).slice(2)}`,
      chatId,
      senderId: ME_ID,
      senderName: this.user.displayName,
      type: input.type,
      text: input.text,
      mediaURL: input.mediaURL,
      fileName: input.fileName,
      duration: input.duration,
      replyTo: input.replyTo || null,
      createdAt: now,
      readBy: [ME_ID],
    };
    (this.messages[chatId] = this.messages[chatId] || []).push(msg);
    chat.lastMessage = {
      text: input.type === 'text' ? input.text : input.type === 'image' ? '📷 Photo' : '🎤 Voice message',
      senderId: ME_ID, senderName: this.user.displayName, createdAt: now, type: input.type,
    };
    chat.updatedAt = now;
    this.persist();
    this.emitMessages(chatId);
    this.emitChats();
    this.scheduleBotReply(chat);
  }

  private scheduleBotReply(chat: Chat) {
    const others = chat.participants.filter((p) => p !== ME_ID);
    if (others.length === 0) return;
    const replierId = others[Math.floor(Math.random() * others.length)];
    const replier = this.users.find((u) => u.id === replierId);
    if (!replier) return;
    const typingKey = `${chat.id}:${replierId}`;
    if (this.typingTimers.has(typingKey)) return;
    const delay = 2500 + Math.random() * 3500;
    this.typingTimers.set(typingKey, setTimeout(() => {
      this.typingTimers.delete(typingKey);
      chat.typing[replierId] = Date.now();
      this.emitChats();
      setTimeout(() => {
        delete chat.typing[replierId];
        const now = Date.now();
        const text = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
        const msg: ChatMessage = {
          id: `m-${now}-bot`,
          chatId: chat.id,
          senderId: replierId,
          senderName: replier.displayName,
          type: 'text',
          text,
          createdAt: now,
          readBy: [replierId],
        };
        (this.messages[chat.id] = this.messages[chat.id] || []).push(msg);
        chat.lastMessage = { text, senderId: replierId, senderName: replier.displayName, createdAt: now, type: 'text' };
        chat.updatedAt = now;
        this.persist();
        this.emitMessages(chat.id);
        this.emitChats();
      }, 1500 + Math.random() * 1500);
    }, delay));
  }

  async markRead(chatId: string): Promise<void> {
    let changed = false;
    for (const m of this.messages[chatId] || []) {
      if (m.senderId !== ME_ID && !m.readBy.includes(ME_ID)) {
        m.readBy.push(ME_ID);
        changed = true;
      }
    }
    if (changed) {
      this.persist();
      this.emitMessages(chatId);
      this.emitChats();
    }
  }

  async setTyping(chatId: string, isTyping: boolean): Promise<void> {
    const chat = this.chats.find((c) => c.id === chatId);
    if (!chat) return;
    if (isTyping) chat.typing[ME_ID] = Date.now();
    else delete chat.typing[ME_ID];
    this.emitChats();
  }

  async searchUsers(q: string): Promise<UserProfile[]> {
    const term = q.trim().toLowerCase();
    if (!term) return this.users.filter((u) => u.id !== ME_ID);
    return this.users.filter(
      (u) => u.id !== ME_ID && (u.displayName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
    );
  }

  async getOrCreateDirectChat(otherId: string): Promise<string> {
    const existing = this.chats.find(
      (c) => c.type === 'direct' && c.participants.includes(ME_ID) && c.participants.includes(otherId)
    );
    if (existing) return existing.id;
    const other = this.users.find((u) => u.id === otherId);
    if (!other) throw new Error('User not found');
    const chat: Chat = {
      id: `c-${Date.now()}`,
      type: 'direct',
      name: other.displayName,
      photoURL: other.photoURL,
      participants: [ME_ID, otherId],
      participantProfiles: {
        [ME_ID]: { displayName: this.user?.displayName || 'Demo User', photoURL: '' },
        [otherId]: { displayName: other.displayName, photoURL: other.photoURL, online: other.online },
      },
      updatedAt: Date.now(),
      typing: {},
    };
    this.chats.push(chat);
    this.messages[chat.id] = [];
    this.persist();
    this.emitChats();
    return chat.id;
  }

  async createGroup(name: string, memberIds: string[]): Promise<string> {
    const chat: Chat = {
      id: `c-g-${Date.now()}`,
      type: 'group',
      name,
      photoURL: '',
      participants: [...new Set([ME_ID, ...memberIds])],
      participantProfiles: Object.fromEntries(
        [ME_ID, ...memberIds].map((id) => {
          const u = this.users.find((x) => x.id === id);
          return [id, { displayName: u?.displayName || 'User', photoURL: u?.photoURL || '' }];
        })
      ),
      updatedAt: Date.now(),
      typing: {},
      adminIds: [ME_ID],
    };
    this.chats.push(chat);
    this.messages[chat.id] = [];
    this.persist();
    this.emitChats();
    return chat.id;
  }

  async uploadMedia(chatId: string, file: File): Promise<{ url: string; kind: 'image' | 'audio' }> {
    const kind = file.type.startsWith('audio') ? 'audio' : 'image';
    const url = URL.createObjectURL(file);
    return { url, kind };
  }

  async deleteMessage(chatId: string, messageId: string, forEveryone: boolean): Promise<void> {
    const msgs = this.messages[chatId] || [];
    const msg = msgs.find((m) => m.id === messageId);
    if (!msg) return;
    if (forEveryone) {
      msg.text = '🚫 This message was deleted';
      msg.type = 'text';
      delete msg.mediaURL;
    } else {
      msg.deletedFor = [...(msg.deletedFor || []), ME_ID];
    }
    this.persist();
    this.emitMessages(chatId);
  }

  // ---- v1 stubs (demo mode: basic/no-op) ----
  async ensureMainGroup(): Promise<string> { return 'demo-main'; }
  async pinMessage(): Promise<void> {}
  async unpinMessage(): Promise<void> {}
  async getPinnedMessages(): Promise<import('./types').ChatMessage[]> { return []; }
  async starMessage(): Promise<void> {}
  async getStarredMessages(): Promise<import('./types').ChatMessage[]> { return []; }
  async editMessage(): Promise<void> {}
  async forwardMessage(): Promise<void> {}
  async createPoll(): Promise<string> { throw new Error('Demo mode me polls nahi'); }
  async votePoll(): Promise<void> {}
  async toggleReaction(): Promise<void> {}
  async uploadFile(chatId: string, file: File): Promise<import('./types').UploadResult> {
    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file';
    return { url: URL.createObjectURL(file), kind, name: file.name, size: file.size } as import('./types').UploadResult;
  }
  async scheduleMessage(): Promise<string> { throw new Error('Demo mode me schedule nahi'); }
  async cancelScheduledMessage(): Promise<void> {}
  async getScheduledMessages(): Promise<import('./types').ScheduledMessage[]> { return []; }
  async removeMember(): Promise<void> {}
  async makeAdmin(): Promise<void> {}
  async setGroupDescription(): Promise<void> {}
  async setSlowMode(): Promise<void> {}
  async setDisappearingAfter(): Promise<void> {}
  async getMessageReaders(): Promise<import('./types').ReaderInfo[]> { return []; }
  async updatePrivacy(): Promise<void> {}
  async setChatPinned(): Promise<void> {}
  async getPinnedChats(): Promise<string[]> { return []; }
  async setChatMuted(): Promise<void> {}
  async setChatSound(): Promise<void> {}
  async getChatNotificationSettings(): Promise<import('./types').ChatNotificationSettings> { return { muted: false, sound: null }; }
  async subscribePush(): Promise<void> {}
  async unsubscribePush(): Promise<void> {}
  async searchInChat(): Promise<import('./types').ChatMessage[]> { return []; }
}
