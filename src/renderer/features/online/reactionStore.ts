import { create } from 'zustand';

interface ReactionState {
  current: { text: string; key: number } | null;
  show(text: string): void;
  clear(): void;
}

// Module-level, not store state: a monotonically increasing id so `show()` always produces a distinct
// `current` object, even when the text repeats — the UI's fade-out timer keys off this to restart cleanly
// on a repeat reaction, which a plain `current.text === text` check would miss.
let nextKey = 0;

export const useReactionStore = create<ReactionState>((set) => ({
  current: null,
  show(text) {
    set({ current: { text, key: nextKey++ } });
  },
  clear() {
    set({ current: null });
  },
}));
