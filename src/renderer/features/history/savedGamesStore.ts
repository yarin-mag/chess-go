import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { GameResult, MoveRecord } from '@/core/types';
import type { GameConfig } from '@/features/game/gameStore';

// Full game histories (SAN + FEN per ply) are heavier than the lightweight per-ply stats in
// gameHistoryStore.ts, so this keeps a smaller cap while still comfortably fitting in localStorage.
const MAX_SAVED_GAMES = 100;

export interface SavedGame {
  id: string;
  playedAt: string; // ISO timestamp
  config: GameConfig;
  history: MoveRecord[];
  result: GameResult;
}

interface SavedGamesState {
  games: SavedGame[];
  /** Prepends a finished game (most recent first) and caps the log so localStorage never grows unbounded. */
  saveGame(config: GameConfig, history: MoveRecord[], result: GameResult): void;
  deleteGame(id: string): void;
  clearSaved(): void;
}

export const useSavedGamesStore = create<SavedGamesState>()(
  persist(
    (set, get) => ({
      games: [],
      saveGame(config, history, result) {
        const entry: SavedGame = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          playedAt: new Date().toISOString(),
          config,
          history,
          result,
        };
        set({ games: [entry, ...get().games].slice(0, MAX_SAVED_GAMES) });
      },
      deleteGame(id) {
        set({ games: get().games.filter((g) => g.id !== id) });
      },
      clearSaved() {
        set({ games: [] });
      },
    }),
    { name: 'b-chess-saved-games', storage: createJSONStorage(() => localStorage) },
  ),
);
