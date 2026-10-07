import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface WalletState {
  coins: number;
  earn(amount: number): void;
  /** Returns false (and spends nothing) if the balance is insufficient. */
  spend(amount: number): boolean;
}

/** The in-app coin balance — entirely local/mock (see shop/catalogue.ts's doc comment): there is no
 *  payment integration anywhere in this codebase, so coins are earned by playing, never bought. */
export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      coins: 0,
      earn(amount) {
        if (amount <= 0) return;
        set({ coins: get().coins + amount });
      },
      spend(amount) {
        if (amount <= 0 || get().coins < amount) return false;
        set({ coins: get().coins - amount });
        return true;
      },
    }),
    { name: 'b-chess-wallet', storage: createJSONStorage(() => localStorage) },
  ),
);
