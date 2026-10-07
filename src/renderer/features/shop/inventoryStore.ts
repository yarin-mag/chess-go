import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_BOARD_THEMES } from '@/styles/themes';
import type { BoardTheme } from '@/features/settings/settingsStore';

interface InventoryState {
  ownedBoardThemes: BoardTheme[];
  owns(theme: BoardTheme): boolean;
  unlock(theme: BoardTheme): void;
}

/** What the player has unlocked from the Shop. Only board skins so far (see shop/catalogue.ts) — the
 *  other categories the design handoff specs (piece sets, frames, effects) aren't wired to anything
 *  renderable yet, so there's nothing for an inventory of them to equip. The 4 pre-shop board themes
 *  are owned from the start — the shop didn't exist when they shipped, so grandfathering them in is
 *  what "owned" already meant for every existing player. */
export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      ownedBoardThemes: [...DEFAULT_BOARD_THEMES],
      owns(theme) {
        return get().ownedBoardThemes.includes(theme);
      },
      unlock(theme) {
        if (get().owns(theme)) return;
        set({ ownedBoardThemes: [...get().ownedBoardThemes, theme] });
      },
    }),
    { name: 'b-chess-inventory', storage: createJSONStorage(() => localStorage) },
  ),
);
