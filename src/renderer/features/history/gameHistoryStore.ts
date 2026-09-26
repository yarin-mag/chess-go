import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RecordedGame, RecordedMove } from './weaknessStats';

const MAX_GAMES = 200;

interface GameHistoryState {
  games: RecordedGame[];
  /** Prepends a new game (most recent first) and caps the log so localStorage never grows unbounded. */
  recordGame(moves: RecordedMove[]): void;
  clearHistory(): void;
}

export const useGameHistoryStore = create<GameHistoryState>()(
  persist(
    (set, get) => ({
      games: [],
      recordGame(moves) {
        const entry: RecordedGame = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          playedAt: new Date().toISOString(),
          moves,
        };
        set({ games: [entry, ...get().games].slice(0, MAX_GAMES) });
      },
      clearHistory() {
        set({ games: [] });
      },
    }),
    { name: 'b-chess-game-history', storage: createJSONStorage(() => localStorage) },
  ),
);
