import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface SessionClaims {
  /** Clerk's own user id (the token's `sub` claim) — the only identity fact this app trusts. */
  clerkUserId: string;
}

export type TokenVerifier = (token: string) => Promise<SessionClaims>;

declare module 'fastify' {
  interface FastifyRequest {
    session?: SessionClaims;
  }
}

/** Rejects with 401 any request in this plugin's scope missing a valid `Authorization: Bearer
 *  <token>` header. Registered inside app.ts's protected sub-scope only — /health is registered
 *  outside that scope and never passes through this hook at all. */
export function authPlugin(app: FastifyInstance, verify: TokenVerifier): void {
  app.decorateRequest('session', undefined);

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) return reply.code(401).send({ error: 'missing bearer token' });

    try {
      req.session = await verify(token);
    } catch {
      return reply.code(401).send({ error: 'invalid or expired session' });
    }
  });
}
