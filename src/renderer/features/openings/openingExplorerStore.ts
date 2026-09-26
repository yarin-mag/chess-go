import { create } from 'zustand';

/** Just a screen-visibility flag — the actual opening data lives in curatedOpenings.ts (pure, no store needed). */
interface OpeningExplorerState {
  visible: boolean;
  show(): void;
  hide(): void;
}

export const useOpeningExplorerStore = create<OpeningExplorerState>((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));
