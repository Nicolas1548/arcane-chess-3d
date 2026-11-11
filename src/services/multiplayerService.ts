import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { getAuth, signInAnonymously, Auth } from 'firebase/auth';

export interface RoomData {
  roomId: string;
  fen: string;
  pgn: string;
  turn: 'w' | 'b';
  whiteId: string;
  whiteName: string;
  blackId: string | null;
  blackName: string | null;
  status: 'waiting' | 'playing' | 'finished';
  lastMove: { from: string; to: string; captured?: string; san?: string } | null;
  winner: 'w' | 'b' | 'draw' | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

export interface FirebaseConfigInput {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId?: string;
}

const LOCAL_ROOMS_PREFIX = 'arcane_chess_room_';
const LOCAL_CHAT_PREFIX = 'arcane_chess_chat_';
const FIREBASE_CONFIG_STORAGE_KEY = 'arcane_chess_firebase_config';

class MultiplayerService {
  private app: FirebaseApp | null = null;
  private db: Firestore | null = null;
  private auth: Auth | null = null;
  private channel: BroadcastChannel | null = null;
  private localPlayerId: string;
  private unsubscribeRoom: (() => void) | null = null;
  private unsubscribeChat: (() => void) | null = null;

  constructor() {
    const savedId = sessionStorage.getItem('arcane_player_uid');
    if (savedId) {
      this.localPlayerId = savedId;
    } else {
      this.localPlayerId = 'player_' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('arcane_player_uid', this.localPlayerId);
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('arcane_chess_multiplayer_channel');
    }

    this.tryAutoInitFirebase();
  }

  private tryAutoInitFirebase() {
    try {
      const envKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const envProject = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      if (envKey && envProject) {
        this.initFirebase({
          apiKey: envKey,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${envProject}.firebaseapp.com`,
          projectId: envProject,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        });
        return;
      }

      const stored = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FirebaseConfigInput;
        if (parsed.apiKey && parsed.projectId) {
          this.initFirebase(parsed);
        }
      }
    } catch {
      // Fallback to local sync channel
    }
  }

  public async initFirebase(config: FirebaseConfigInput): Promise<boolean> {
    try {
      this.app = initializeApp(config, 'arcane-chess-' + Date.now());
      this.db = getFirestore(this.app);
      this.auth = getAuth(this.app);
      localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config));

      const cred = await signInAnonymously(this.auth);
      if (cred.user) {
        this.localPlayerId = cred.user.uid;
      }
      return true;
    } catch (err) {
      console.warn('Firebase Cloud fallback to Instant Sync Engine:', err);
      this.db = null;
      return false;
    }
  }

  public isCloudConnected(): boolean {
    return this.db !== null;
  }

  public getPlayerId(): string {
    return this.auth?.currentUser?.uid || this.localPlayerId;
  }

  public generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'ARC-';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public async createRoom(playerName: string, initialFen: string): Promise<RoomData> {
    const roomId = this.generateRoomCode();
    const uid = this.getPlayerId();
    const now = Date.now();

    const roomData: RoomData = {
      roomId,
      fen: initialFen,
      pgn: '',
      turn: 'w',
      whiteId: uid,
      whiteName: playerName.trim().slice(0, 40) || 'Rei Artur',
      blackId: null,
      blackName: null,
      status: 'waiting',
      lastMove: null,
      winner: null,
      createdAt: now,
      updatedAt: now,
    };

    if (this.db) {
      await setDoc(doc(this.db, 'rooms', roomId), roomData);
    } else {
      localStorage.setItem(LOCAL_ROOMS_PREFIX + roomId, JSON.stringify(roomData));
      this.channel?.postMessage({ type: 'ROOM_UPDATE', roomId, data: roomData });
    }

    return roomData;
  }

  public async joinRoom(roomIdInput: string, playerName: string): Promise<{ room: RoomData; assignedColor: 'w' | 'b' }> {
    const roomId = roomIdInput.trim().toUpperCase();
    const uid = this.getPlayerId();
    const cleanName = playerName.trim().slice(0, 40) || 'Cavaleiro Negro';

    if (this.db) {
      const ref = doc(this.db, 'rooms', roomId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        throw new Error('Sala não encontrada no reino.');
      }
      const data = snap.data() as RoomData;
      if (data.whiteId === uid) {
        return { room: data, assignedColor: 'w' };
      }
      if (!data.blackId || data.blackId === uid) {
        const updated: Partial<RoomData> = {
          blackId: uid,
          blackName: cleanName,
          status: 'playing',
          updatedAt: Date.now(),
        };
        await updateDoc(ref, updated);
        return { room: { ...data, ...updated }, assignedColor: 'b' };
      }
      throw new Error('Esta sala já possui dois duelistas.');
    } else {
      const raw = localStorage.getItem(LOCAL_ROOMS_PREFIX + roomId);
      if (!raw) {
        throw new Error('Sala não encontrada. Crie uma sala ou verifique o código.');
      }
      const data = JSON.parse(raw) as RoomData;
      if (data.whiteId === uid) {
        return { room: data, assignedColor: 'w' };
      }
      const updated: RoomData = {
        ...data,
        blackId: uid,
        blackName: cleanName,
        status: 'playing',
        updatedAt: Date.now(),
      };
      localStorage.setItem(LOCAL_ROOMS_PREFIX + roomId, JSON.stringify(updated));
      this.channel?.postMessage({ type: 'ROOM_UPDATE', roomId, data: updated });
      return { room: updated, assignedColor: 'b' };
    }
  }

  public async pushMove(
    roomId: string,
    payload: {
      fen: string;
      pgn: string;
      turn: 'w' | 'b';
      lastMove: { from: string; to: string; captured?: string; san?: string } | null;
      status: 'waiting' | 'playing' | 'finished';
      winner: 'w' | 'b' | 'draw' | null;
    }
  ) {
    const now = Date.now();
    if (this.db) {
      const ref = doc(this.db, 'rooms', roomId);
      await updateDoc(ref, {
        ...payload,
        updatedAt: now,
      });
    } else {
      const raw = localStorage.getItem(LOCAL_ROOMS_PREFIX + roomId);
      if (!raw) return;
      const current = JSON.parse(raw) as RoomData;
      const updated: RoomData = {
        ...current,
        ...payload,
        updatedAt: now,
      };
      localStorage.setItem(LOCAL_ROOMS_PREFIX + roomId, JSON.stringify(updated));
      this.channel?.postMessage({ type: 'ROOM_UPDATE', roomId, data: updated });
    }
  }

  public subscribeToRoom(
    roomId: string,
    onRoomChange: (room: RoomData) => void,
    onChatUpdate: (messages: ChatMessage[]) => void
  ) {
    this.cleanupSubscriptions();

    if (this.db) {
      const roomRef = doc(this.db, 'rooms', roomId);
      this.unsubscribeRoom = onSnapshot(roomRef, (snap) => {
        if (snap.exists()) {
          onRoomChange(snap.data() as RoomData);
        }
      });

      const chatQuery = query(collection(this.db, 'rooms', roomId, 'messages'), orderBy('createdAt', 'asc'));
      this.unsubscribeChat = onSnapshot(chatQuery, (snap) => {
        const msgs: ChatMessage[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, 'id'>),
        }));
        onChatUpdate(msgs);
      });
    } else {
      // Initial load from localStorage
      const rawRoom = localStorage.getItem(LOCAL_ROOMS_PREFIX + roomId);
      if (rawRoom) onRoomChange(JSON.parse(rawRoom) as RoomData);

      const rawChat = localStorage.getItem(LOCAL_CHAT_PREFIX + roomId);
      if (rawChat) onChatUpdate(JSON.parse(rawChat) as ChatMessage[]);

      const handleBroadcast = (ev: MessageEvent) => {
        if (!ev.data) return;
        if (ev.data.type === 'ROOM_UPDATE' && ev.data.roomId === roomId) {
          onRoomChange(ev.data.data as RoomData);
        }
        if (ev.data.type === 'CHAT_UPDATE' && ev.data.roomId === roomId) {
          onChatUpdate(ev.data.messages as ChatMessage[]);
        }
      };

      const handleStorage = (ev: StorageEvent) => {
        if (ev.key === LOCAL_ROOMS_PREFIX + roomId && ev.newValue) {
          onRoomChange(JSON.parse(ev.newValue) as RoomData);
        }
        if (ev.key === LOCAL_CHAT_PREFIX + roomId && ev.newValue) {
          onChatUpdate(JSON.parse(ev.newValue) as ChatMessage[]);
        }
      };

      this.channel?.addEventListener('message', handleBroadcast);
      window.addEventListener('storage', handleStorage);

      this.unsubscribeRoom = () => {
        this.channel?.removeEventListener('message', handleBroadcast);
        window.removeEventListener('storage', handleStorage);
      };
    }
  }

  public async sendChatMessage(roomId: string, senderName: string, text: string) {
    const cleanText = text.trim().slice(0, 300);
    if (!cleanText) return;

    const msg: Omit<ChatMessage, 'id'> = {
      senderId: this.getPlayerId(),
      senderName: senderName.trim().slice(0, 40) || 'Duelista',
      text: cleanText,
      createdAt: Date.now(),
    };

    if (this.db) {
      await addDoc(collection(this.db, 'rooms', roomId, 'messages'), msg);
    } else {
      const raw = localStorage.getItem(LOCAL_CHAT_PREFIX + roomId);
      const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
      const newMsg: ChatMessage = { id: 'msg_' + Date.now() + '_' + Math.random(), ...msg };
      const updated = [...list, newMsg];
      localStorage.setItem(LOCAL_CHAT_PREFIX + roomId, JSON.stringify(updated));
      this.channel?.postMessage({ type: 'CHAT_UPDATE', roomId, messages: updated });
    }
  }

  public cleanupSubscriptions() {
    if (this.unsubscribeRoom) {
      this.unsubscribeRoom();
      this.unsubscribeRoom = null;
    }
    if (this.unsubscribeChat) {
      this.unsubscribeChat();
      this.unsubscribeChat = null;
    }
  }
}

export const multiplayerService = new MultiplayerService();
