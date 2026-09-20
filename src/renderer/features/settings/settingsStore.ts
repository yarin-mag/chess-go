import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type BoardTheme = 'classic' | 'green' | 'blue' | 'dark';

export interface SettingsState {
  /** Highlight legal destination squares (blue borders) after selecting a piece. */
  showLegalMoves: boolean;
  soundOn: boolean;
  /** Local 1v2 only: rotate the board to the side that is about to move. */
  autoFlip: boolean;
  boardTheme: BoardTheme;
  update(patch: Partial<Omit<SettingsState, 'update'>>): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      showLegalMoves: true,
      soundOn: true,
      autoFlip: false,
      boardTheme: 'classic',
      update: (patch) => set(patch),
    }),
    {
      name: 'b-chess-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ showLegalMoves, soundOn, autoFlip, boardTheme }) => ({ showLegalMoves, soundOn, autoFlip, boardTheme }),
    },
  ),
);
