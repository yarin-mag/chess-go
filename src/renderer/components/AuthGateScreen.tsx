import { SignIn, useAuth, useClerk, useSignIn } from '@clerk/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/authStore';
import styles from './AuthGateScreen.module.css';

const AUTH_CALLBACK_URL = 'b-chess://auth-callback';

/** True only inside the Electron build — Task 12's preload script is the one thing that ever defines
 *  this global, so its presence is a reliable "are we in Electron" check without any bundler config. */
const isElectron = typeof window !== 'undefined' && !!window.electronAuth;

/** Shown whenever decideGate() says 'showSignIn'. Once Clerk reports a signed-in session, fetches
 *  /me to get this account's server-side id and populate authStore — the one place that ever calls
 *  setSignedIn, so every other screen can trust useAuthStore.accountId is real. */
export function AuthGateScreen() {
  const { t } = useTranslation();
  const { isSignedIn, getToken } = useAuth();
  const { signIn } = useSignIn();
  const clerk = useClerk();
  const setSignedIn = useAuthStore((s) => s.setSignedIn);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      const token = await getToken();
      const base = import.meta.env.VITE_API_BASE_URL as string;
      const res = await fetch(`${base}/me`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok || cancelled) return;
      const { accountId, clerkUserId } = await res.json();
      setSignedIn(accountId, clerkUserId);
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, setSignedIn]);

  // Electron only: the embedded <SignIn/> below can't complete a real sign-in inside a BrowserWindow
  // (no OAuth-provider trust, no way back from a system-browser-only flow) — instead we open Clerk's
  // hosted sign-in page in the OS's default browser and catch the redirect via the custom b-chess://
  // protocol (Task 12), exchanging whatever it hands back for an active session here.
  useEffect(() => {
    if (!isElectron || !signIn) return;
    const unsubscribe = window.electronAuth!.onAuthCallback((url) => {
      void (async () => {
        // Clerk's exact query-param name for a ticket handed back to a *native app's* custom-scheme
        // redirect (as opposed to a web redirect_url) depends on the "Native applications" feature
        // being configured for this Clerk application in its Dashboard, with b-chess://auth-callback
        // registered as an allowed redirect URI (see server/README.md's provisioning notes) — verified
        // live against a real app in Task 14. `ticket` matches Clerk's documented ticket-strategy param
        // name; `__clerk_ticket` is checked too since that's the name Clerk uses for its own invitation
        // /email-link redirects, in case the native-redirect flow reuses it.
        const parsed = new URL(url);
        const ticket = parsed.searchParams.get('ticket') ?? parsed.searchParams.get('__clerk_ticket');
        if (!ticket) return;

        const { error } = await signIn.ticket({ ticket });
        if (!error && signIn.status === 'complete') {
          // No `navigate` needed — this isn't a web page with a route to redirect to. Once finalize()
          // resolves, Clerk's own reactive state flips isSignedIn to true, and the effect above (which
          // already exists for the web sign-in path) picks it up and calls /me exactly the same way.
          await signIn.finalize();
        }
      })();
    });
    return unsubscribe;
  }, [signIn]);

  const signInViaSystemBrowser = () => {
    const signInUrl = clerk.buildSignInUrl({ redirectUrl: AUTH_CALLBACK_URL });
    void window.electronAuth!.openExternalSignIn(signInUrl);
  };

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1>{t('common:appTitle')}</h1>
        {isElectron ? (
          <button className="btn btn-primary" onClick={signInViaSystemBrowser}>
            {t('auth:signInWithBrowser')}
          </button>
        ) : (
          <SignIn routing="hash" />
        )}
      </div>
    </div>
  );
}
