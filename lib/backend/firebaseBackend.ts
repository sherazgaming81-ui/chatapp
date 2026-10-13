import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FbUser,
} from 'firebase/auth';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteField,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { getFirebase } from '../firebase';
import type {
  Chat,
  ChatBackend,
  ChatMessage,
  LastMessage,
  SendInput,
  UserProfile,
} from './types';

function toUserProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    id: uid,
    displayName: (data.displayName as string) || 'User',
    email: (data.email as string) || '',
    photoURL: (data.photoURL as string) || '',
    about: (data.about as string) || 'Hey there! I am using Chat.',
    online: (data.online as boolean) || false,
    lastSeen: (data.lastSeen as number) || 0,
  };
}

export class FirebaseBackend implements ChatBackend {
  readonly mode = 'firebase' as const;
  private me: FbUser | null = null;
  private profileCache = new Map<string, { displayName: string; photoURL: string; online?: boolean }>();
  private presenceTimer: ReturnType<typeof setInterval> | null = null;

  private svc() {
    const s = getFirebase();
    if (!s) throw new Error('Firebase is not configured');
    return s;
  }

  onAuth(cb: (user: UserProfile | null) => void): () => void {
    const { auth, db } = this.svc();
    return onAuthStateChanged(auth, async (fbUser) => {
      this.me = fbUser;
      if (!fbUser) {
        cb(null);
        return;
      }
      const userRef = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          displayName: fbUser.displayName || 'User',
          email: fbUser.email || '',
          photoURL: fbUser.photoURL || '',
          about: 'Hey there! I am using Chat.',
          online: true,
          lastSeen: Date.now(),
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(userRef, { online: true, lastSeen: Date.now() });
      }
      const fresh = await getDoc(userRef);
      this.startPresence();
      cb(toUserProfile(fbUser.uid, fresh.data() || {}));
    });
  }

  private startPresence() {
    if (this.presenceTimer || !this.me) return;
    const { db } = this.svc();
    const uid = this.me.uid;
    const beat = () => {
      updateDoc(doc(db, 'users', uid), { lastSeen: Date.now() }).catch(() => {});
    };
    this.presenceTimer = setInterval(beat, 60000);
    const goOffline = () => {
      updateDoc(doc(db, 'users', uid), { online: false, lastSeen: Date.now() }).catch(() => {});
    };
    window.addEventListener('beforeunload', goOffline);
  }

  async signInWithGoogle(): Promise<void> {
    const { auth } = this.svc();
    await signInWithPopup(auth, new GoogleAuthProvider());
  }

  async signOut(): Promise<void> {
    const { auth, db } = this.svc();
    if (this.me) {
      await updateDoc(doc(db, 'users', this.me.uid), { online: false, lastSeen: Date.now() }).catch(() => {});
    }
    if (this.presenceTimer) clearInterval(this.presenceTimer);
    this.presenceTimer = null;
    await fbSignOut(auth);
  }

  async updateProfile(patch: Partial<Pick<UserProfile, 'displayName' | 'about' | 'photoURL'>>): Promise<void> {
    const { db } = this.svc();
    if (!this.me) return;
    await updateDoc(doc(db, 'users', this.me.uid), { ...patch });
  }

  private async profileOf(uid: string) {
    const hit = this.profileCache.get(uid);
    if (hit) return hit;
    const { db } = this.svc();
    const snap = await getDoc(doc(db, 'users', uid));
    const d = snap.data() || {};
    const p = {
      displayName: (d.displayName as string) || 'User',
      photoURL: (d.photoURL as string) || '',
      online: (d.online as boolean) || false,
      lastSeen: (d.lastSeen as number) || 0,
    };
    this.profileCache.set(uid, p);
    return p;
  }

  onChats(cb: (chats: Chat[]) => void): () => void {
    const { db } = this.svc();
    const me = this.me;
    if (!me) return () => {};
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', me.uid),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, async (snap) => {
      const chats: Chat[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        const participants: string[] = data.participants || [];
        const profiles: Chat['participantProfiles'] = {};
        for (const pid of participants) profiles[pid] = await this.profileOf(pid);
        let name = (data.name as string) || '';
        let photoURL = (data.photoURL as string) || '';
        if (data.type === 'direct') {
          const other = participants.find((p) => p !== me.uid);
          if (other && profiles[other]) {
            name = profiles[other].displayName;
            photoURL = profiles[other].photoURL;
          }
        }
        chats.push({
          id: d.id,
          type: data.type === 'group' ? 'group' : 'direct',
          name,
          photoURL,
          participants,
          participantProfiles: profiles,
          lastMessage: (data.lastMessage as LastMessage) || null,
          updatedAt: (data.updatedAt as number) || 0,
          typing: (data.typing as Record<string, number>) || {},
          adminIds: (data.adminIds as string[]) || [],
        });
      }
      cb(chats);
    });
  }

  onMessages(chatId: string, cb: (messages: ChatMessage[]) => void): () => void {
    const { db } = this.svc();
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(200));
    return onSnapshot(q, (snap) => {
      const msgs: ChatMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          chatId,
          senderId: data.senderId as string,
          senderName: data.senderName as string,
          type: (data.type as ChatMessage['type']) || 'text',
          text: (data.text as string) || '',
          mediaURL: data.mediaURL as string | undefined,
          fileName: data.fileName as string | undefined,
          duration: data.duration as number | undefined,
          replyTo: (data.replyTo as ChatMessage['replyTo']) || null,
          createdAt: (data.createdAt as number) || 0,
          readBy: (data.readBy as string[]) || [],
          deletedFor: (data.deletedFor as string[]) || [],
        };
      });
      cb(msgs);
    });
  }

  async sendMessage(chatId: string, input: SendInput): Promise<void> {
    const { db } = this.svc();
    const me = this.me;
    if (!me) return;
    const now = Date.now();
    const preview =
      input.type === 'text' ? input.text : input.type === 'image' ? '📷 Photo' : '🎤 Voice message';
    const batch = writeBatch(db);
    const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
    batch.set(msgRef, {
      senderId: me.uid,
      senderName: me.displayName || 'User',
      type: input.type,
      text: input.text,
      mediaURL: input.mediaURL || null,
      fileName: input.fileName || null,
      duration: input.duration || null,
      replyTo: input.replyTo || null,
      createdAt: now,
      readBy: [me.uid],
    });
    batch.update(doc(db, 'chats', chatId), {
      lastMessage: {
        text: preview,
        senderId: me.uid,
        senderName: me.displayName || 'User',
        createdAt: now,
        type: input.type,
      } as LastMessage,
      updatedAt: now,
    });
    await batch.commit();
  }

  async markRead(chatId: string): Promise<void> {
    const { db } = this.svc();
    const me = this.me;
    if (!me) return;
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(30));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    let n = 0;
    for (const d of snap.docs) {
      const data = d.data();
      if (data.senderId !== me.uid && !(data.readBy || []).includes(me.uid)) {
        batch.update(d.ref, { readBy: arrayUnion(me.uid) });
        n++;
      }
    }
    if (n > 0) await batch.commit();
  }

  async setTyping(chatId: string, isTyping: boolean): Promise<void> {
    const { db } = this.svc();
    const me = this.me;
    if (!me) return;
    await updateDoc(doc(db, 'chats', chatId), {
      [`typing.${me.uid}`]: isTyping ? Date.now() : deleteField(),
    }).catch(() => {});
  }

  async searchUsers(q: string): Promise<UserProfile[]> {
    const { db } = this.svc();
    const me = this.me;
    const term = q.trim();
    if (!term) return [];
    const qq = query(
      collection(db, 'users'),
      orderBy('displayName'),
      startAt(term),
      endAt(term + '\uf8ff'),
      limit(10)
    );
    const snap = await getDocs(qq);
    return snap.docs
      .filter((d) => d.id !== me?.uid)
      .map((d) => toUserProfile(d.id, d.data()));
  }

  async getOrCreateDirectChat(otherId: string): Promise<string> {
    const { db } = this.svc();
    const me = this.me;
    if (!me) throw new Error('Not signed in');
    const id = `dm_${[me.uid, otherId].sort().join('_')}`;
    const refDoc = doc(db, 'chats', id);
    const snap = await getDoc(refDoc);
    if (!snap.exists()) {
      const other = await this.profileOf(otherId);
      await setDoc(refDoc, {
        type: 'direct',
        participants: [me.uid, otherId],
        participantProfiles: {},
        name: other.displayName,
        photoURL: other.photoURL,
        lastMessage: null,
        updatedAt: Date.now(),
        typing: {},
        createdAt: serverTimestamp(),
      });
    }
    return id;
  }

  async createGroup(name: string, memberIds: string[]): Promise<string> {
    const { db } = this.svc();
    const me = this.me;
    if (!me) throw new Error('Not signed in');
    const refDoc = await addDoc(collection(db, 'chats'), {
      type: 'group',
      name,
      photoURL: '',
      participants: [...new Set([me.uid, ...memberIds])],
      participantProfiles: {},
      adminIds: [me.uid],
      lastMessage: null,
      updatedAt: Date.now(),
      typing: {},
      createdAt: serverTimestamp(),
    });
    return refDoc.id;
  }

  async uploadMedia(chatId: string, file: File): Promise<{ url: string; kind: 'image' | 'audio' }> {
    const { storage } = this.svc();
    const kind = file.type.startsWith('audio') ? 'audio' : 'image';
    const r = ref(storage, `chat-media/${chatId}/${Date.now()}_${file.name}`);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    return { url, kind };
  }

  async deleteMessage(chatId: string, messageId: string, forEveryone: boolean): Promise<void> {
    const { db } = this.svc();
    const me = this.me;
    if (!me) return;
    const refDoc = doc(db, 'chats', chatId, 'messages', messageId);
    if (forEveryone) {
      await updateDoc(refDoc, {
        text: '🚫 This message was deleted',
        type: 'text',
        mediaURL: deleteField(),
      });
    } else {
      await updateDoc(refDoc, { deletedFor: arrayUnion(me.uid) });
    }
  }

  // ---- v1 stubs (firebase: not implemented, supabase is primary) ----
  async ensureMainGroup(): Promise<string> { throw new Error('Supabase backend use karein'); }
  async pinMessage(): Promise<void> {}
  async unpinMessage(): Promise<void> {}
  async getPinnedMessages(): Promise<import('./types').ChatMessage[]> { return []; }
  async starMessage(): Promise<void> {}
  async getStarredMessages(): Promise<import('./types').ChatMessage[]> { return []; }
  async editMessage(): Promise<void> {}
  async forwardMessage(): Promise<void> {}
  async createPoll(): Promise<string> { throw new Error('Supabase backend use karein'); }
  async votePoll(): Promise<void> {}
  async toggleReaction(): Promise<void> {}
  async uploadFile(chatId: string, file: File): Promise<import('./types').UploadResult> {
    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file';
    return { url: '', kind, name: file.name, size: file.size } as import('./types').UploadResult;
  }
  async scheduleMessage(): Promise<string> { throw new Error('Supabase backend use karein'); }
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
