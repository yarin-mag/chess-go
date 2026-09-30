import { verifyToken } from '@clerk/backend';
import type { SessionClaims, TokenVerifier } from './plugins/auth.js';

/** Production token verifier — wraps Clerk's backend SDK. Requires CLERK_SECRET_KEY. */
export const clerkVerifier: TokenVerifier = async (token) => {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is not set');
  const claims = await verifyToken(token, { secretKey });
  return { clerkUserId: claims.sub };
};
