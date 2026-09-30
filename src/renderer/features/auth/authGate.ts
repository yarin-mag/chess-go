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
  if (input.status === 'signedIn') return 'showApp';
  // Clerk loads its SDK over the network — `status` can never leave 'checking' while offline (isLoaded
  // never arrives), so 'checking' must resolve immediately here instead of waiting on a network call
  // that will never come. hasEverAuthenticated is the only signal left once there's no live status to
  // trust, exactly like the signedOut+offline case below.
  if (!input.isOnline) return input.hasEverAuthenticated ? 'offlineBlocked' : 'offlineFallback';
  if (input.status === 'checking') return 'checking';
  return 'showSignIn';
}
