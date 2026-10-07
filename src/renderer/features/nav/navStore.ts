import { create } from 'zustand';

export type NavTab = 'home' | 'learn' | 'friends' | 'shop' | 'me';

interface NavState {
  tab: NavTab;
  setTab(tab: NavTab): void;
}

/** Which bottom tab is selected. Not persisted — the app always opens on Home, same as today. Overlay
 *  screens (game, review, puzzle map, settings, …) are still owned by their own existing feature stores
 *  (see App.tsx) — this store only ever decides *which tab* renders once no overlay is active. */
export const useNavStore = create<NavState>((set) => ({
  tab: 'home',
  setTab: (tab) => set({ tab }),
}));
