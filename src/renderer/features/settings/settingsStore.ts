import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type BoardTheme = 'classic' | 'green' | 'blue' | 'dark' | 'gilded' | 'walnut' | 'marble' | 'obsidian' | 'sapphire' | 'jade';
export type Locale = 'en' | 'he' | 'es';

export interface SettingsState {
  /** Highlight legal destination squares (blue borders) after selecting a piece. */
  showLegalMoves: boolean;
  soundOn: boolean;
  /** Local 1v2 only: rotate the board to the side that is about to move. */
  autoFlip: boolean;
  boardTheme: BoardTheme;
  locale: Locale;
  /** Chat settings — read by the Phase 2 chat sheet; exposed in Settings now so the Round 3 Settings
   *  screen matches the design handoff's grouping even before chat itself ships. */
  chatEmojisFromOpponent: boolean;
  quickPhrasesOnly: boolean;
  update(patch: Partial<Omit<SettingsState, 'update'>>): void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      showLegalMoves: true,
      soundOn: true,
      autoFlip: false,
      boardTheme: 'classic',
      locale: 'en',
      chatEmojisFromOpponent: true,
      quickPhrasesOnly: false,
      update: (patch) => set(patch),
    }),
    {
      name: 'b-chess-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ showLegalMoves, soundOn, autoFlip, boardTheme, locale, chatEmojisFromOpponent, quickPhrasesOnly }) => ({
        showLegalMoves,
        soundOn,
        autoFlip,
        boardTheme,
        locale,
        chatEmojisFromOpponent,
        quickPhrasesOnly,
      }),
    },
  ),
);
