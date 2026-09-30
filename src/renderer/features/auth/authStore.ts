import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AuthStatus = 'checking' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  accountId: string | null;
  clerkUserId: string | null;
  /** True once this device has completed at least one real sign-in — the fact `decideGate` uses to
   *  tell "never signed in" apart from "signed out, but has an account". */
  hasEverAuthenticated: boolean;
  setSignedIn(accountId: string, clerkUserId: string): void;
  setSignedOut(): void;
  setChecking(): void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      status: 'checking',
      accountId: null,
      clerkUserId: null,
      hasEverAuthenticated: false,
      setSignedIn(accountId, clerkUserId) {
        set({ status: 'signedIn', accountId, clerkUserId, hasEverAuthenticated: true });
      },
      setSignedOut() {
        set({ status: 'signedOut', accountId: null, clerkUserId: null });
      },
      setChecking() {
        set({ status: 'checking' });
      },
    }),
    { name: 'b-chess-auth', storage: createJSONStorage(() => localStorage) },
  ),
);
