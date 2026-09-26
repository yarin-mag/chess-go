import { create, type UseBoundStore, type StoreApi } from 'zustand';

export interface VisibilityState {
  visible: boolean;
  show(): void;
  hide(): void;
}

/** A tiny "is this standalone screen showing?" store — used for screens that aren't the main play/review/puzzle flow. */
export function createVisibilityStore(): UseBoundStore<StoreApi<VisibilityState>> {
  return create<VisibilityState>((set) => ({
    visible: false,
    show: () => set({ visible: true }),
    hide: () => set({ visible: false }),
  }));
}
