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

/** Reads the raw persisted accountId synchronously, before zustand's own (slightly-delayed) persist
 *  rehydration runs — so the very first render already knows whether this device has a cached
 *  identity, instead of starting 'checking' and briefly flashing the wrong screen. Never throws:
 *  a missing/corrupt entry is exactly "no cached identity", not an error. */
function readCachedAccountId(): string | null {
  try {
    const raw = localStorage.getItem('b-chess-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { accountId?: string | null } };
    return parsed.state?.accountId ?? null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // A previously-cached identity starts 'signedIn' immediately — offline or online, Clerk's SDK
      // needs the network to ever resolve 'checking', so waiting on it would mean a permanently blank
      // screen for exactly the device the spec says must keep working offline. No cached identity
      // starts 'checking' as before, pending the real Clerk/`/me` check in App.tsx's effect.
      status: readCachedAccountId() ? 'signedIn' : 'checking',
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
    {
      name: 'b-chess-auth',
      storage: createJSONStorage(() => localStorage),
      // `status` is deliberately excluded: it's live/transient session state, not a fact to remember.
      // Persisting it let a `setChecking()` call (which can be permanent while offline) overwrite a
      // perfectly good cached identity for every future launch, not just this one.
      partialize: (state) => ({
        accountId: state.accountId,
        clerkUserId: state.clerkUserId,
        hasEverAuthenticated: state.hasEverAuthenticated,
      }),
    },
  ),
);
