import { create } from 'zustand';
import type { ReactionKey } from './protocol';

interface ReactionState {
  current: { text: string; key: number; reactionKey?: ReactionKey } | null;
  show(text: string, reactionKey?: ReactionKey): void;
  clear(): void;
}

// Module-level, not store state: a monotonically increasing id so `show()` always produces a distinct
// `current` object, even when the text repeats — the UI's fade-out timer keys off this to restart cleanly
// on a repeat reaction, which a plain `current.text === text` check would miss. Unrelated to
// `reactionKey` below (that's the semantic reaction/emoji id, this is just a render-dedup counter).
let nextKey = 0;

export const useReactionStore = create<ReactionState>((set) => ({
  current: null,
  show(text, reactionKey) {
    set({ current: { text, key: nextKey++, reactionKey } });
  },
  clear() {
    set({ current: null });
  },
}));
