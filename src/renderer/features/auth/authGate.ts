export type GateDecision = 'checking' | 'showApp' | 'showSignIn' | 'offlineFallback' | 'offlineBlocked';

interface GateInput {
  hasEverAuthenticated: boolean;
  status: 'checking' | 'signedOut' | 'signedIn';
  isOnline: boolean;
}

/** The one place all five states this app can be in resolve to a single screen decision:
 *  - signed in (any connectivity) -> the real app, always
 *  - never authenticated + online -> sign-in screen
 *  - never authenticated + offline -> today's old no-account experience (Clerk is unreachable
 *    anyway, and there's no account yet to attach anything to)
 *  - previously authenticated, now signed out, offline -> explicitly BLOCKED, never silently
 *    downgraded to the no-account fallback (a real account exists; losing that distinction would
 *    let a banned/invalidated session's device keep queueing offline results indefinitely)
 *  - previously authenticated, now signed out, online -> sign-in screen (normal re-login) */
export function decideGate(input: GateInput): GateDecision {
  if (input.status === 'checking') return 'checking';
  if (input.status === 'signedIn') return 'showApp';
  if (!input.hasEverAuthenticated) return input.isOnline ? 'showSignIn' : 'offlineFallback';
  return input.isOnline ? 'showSignIn' : 'offlineBlocked';
}
