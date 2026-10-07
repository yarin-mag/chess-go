import { create } from 'zustand';
import type { ReactionKey } from './protocol';

export interface ChatMessage {
  id: string;
  from: 'me' | 'opponent';
  at: number;
  /** 'reaction' entries carry the already-locale-resolved display text (same as ReactionBubble shows),
   *  not the raw key — the log is append-only display state, not something replayed through i18n later. */
  kind: 'text' | 'reaction';
  text: string;
  reactionKey?: ReactionKey;
}

interface ChatState {
  messages: ChatMessage[];
  add(entry: Omit<ChatMessage, 'id'>): void;
  clear(): void;
}

// Bounds memory for a very long or very chatty game — old messages just scroll out of what's kept,
// same spirit as savedGamesStore's MAX_SAVED_GAMES cap.
const MAX_MESSAGES = 200;

/** The online chat sheet's message log — one game's worth, never persisted (cleared on leave/new game
 *  by onlineStore). Separate from `reactionStore`, which stays exactly as it was: a transient "just
 *  popped up" bubble for glanceable reactions, shown whether or not the chat sheet is open. */
export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  add(entry) {
    const id = `${entry.at}-${Math.random().toString(36).slice(2, 8)}`;
    set({ messages: [...get().messages, { ...entry, id }].slice(-MAX_MESSAGES) });
  },
  clear() {
    set({ messages: [] });
  },
}));
