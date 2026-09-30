import { verifyToken } from '@clerk/backend';
import type { SessionClaims, TokenVerifier } from './plugins/auth.js';

/** Production token verifier — wraps Clerk's backend SDK. Requires CLERK_SECRET_KEY.
 *
 *  CLERK_AUTHORIZED_PARTIES (optional, comma-separated) is Clerk's recommended hardening: without it,
 *  a valid token is accepted regardless of the `azp` origin it was minted for (Important finding, final
 *  whole-branch review). It's opt-in rather than defaulted, because the right value depends on this
 *  app's actual configured Clerk origins/native redirect setup — the same class of thing Task 14's
 *  provisioning notes already flag as needing a real, configured Clerk Dashboard to get right. */
export const clerkVerifier: TokenVerifier = async (token) => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set');
  const rawParties = process.env.CLERK_AUTHORIZED_PARTIES;
  const authorizedParties = rawParties
    ? rawParties.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const claims = await verifyToken(token, { secretKey, ...(authorizedParties ? { authorizedParties } : {}) });
  return { clerkUserId: claims.sub };
};
