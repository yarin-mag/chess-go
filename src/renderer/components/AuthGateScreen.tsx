import { SignIn, useClerk, useSignIn } from '@clerk/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { parseAuthCallback } from '../features/auth/authCallback';
import styles from './AuthGateScreen.module.css';

const AUTH_CALLBACK_URL = 'b-chess://auth-callback';

/** This device's nonce for the sign-in attempt currently in flight, round-tripped through
 *  redirectUrl's query string and checked back against the callback (Important finding, final
 *  whole-branch review: without it, any local process able to invoke this app's custom protocol could
 *  hand back its own ticket and sign the victim into an attacker-controlled Clerk account). Module
 *  scope, not component state — it must survive whatever remounts happen between opening the system
 *  browser and the callback arriving. */
let pendingState: string | null = null;

function randomState(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** True only inside the Electron build — Task 12's preload script is the one thing that ever defines
 *  this global, so its presence is a reliable "are we in Electron" check without any bundler config. */
const isElectron = typeof window !== 'undefined' && !!window.electronAuth;

/** Shown whenever decideGate() says 'showSignIn'. Purely presentational — reacting to isSignedIn and
 *  calling /me lives in App.tsx's own effect (always mounted, so it can never miss the moment
 *  isSignedIn flips true the way a component that only renders while gate === 'showSignIn' can). */
export function AuthGateScreen() {
  const { t } = useTranslation();
  const { signIn } = useSignIn();
  const clerk = useClerk();

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
        // live against a real app in Task 14.
        const parsed = parseAuthCallback(url);
        if (!parsed) return;
        // Reject any callback that doesn't carry the exact nonce this device generated for its own
        // most recent sign-in attempt (Important finding, final whole-branch review) — otherwise any
        // local process able to invoke b-chess:// could hand back its own ticket and sign the victim
        // into an attacker-controlled account. Assumes Clerk round-trips redirectUrl's query string
        // unchanged onto its final redirect, appending only its own params — the standard OAuth
        // state-param pattern; unverified live, same as the ticket-vs-__clerk_ticket param name below.
        if (!pendingState || parsed.state !== pendingState) return;
        pendingState = null;

        const { error } = await signIn.ticket({ ticket: parsed.ticket });
        if (!error && signIn.status === 'complete') {
          // No `navigate` needed — this isn't a web page with a route to redirect to. Once finalize()
          // resolves, Clerk's own reactive state flips isSignedIn to true, and App.tsx's always-mounted
          // effect (shared with the web sign-in path) picks it up and calls /me exactly the same way.
          await signIn.finalize();
        }
      })();
    });
    return unsubscribe;
  }, [signIn]);

  const signInViaSystemBrowser = () => {
    pendingState = randomState();
    const signInUrl = clerk.buildSignInUrl({ redirectUrl: `${AUTH_CALLBACK_URL}?state=${pendingState}` });
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
