import type { FastifyInstance } from 'fastify';
import type { AccountsRepo } from '../db/accountsRepo.js';

export function meRoutes(app: FastifyInstance, opts: { accountsRepo: AccountsRepo }): void {
  app.get('/me', async (req, reply) => {
    if (!req.session) return reply.code(401).send({ error: 'missing session' });
    const account = await opts.accountsRepo.findOrCreateByClerkUserId(req.session.clerkUserId);
    return { accountId: account.id, clerkUserId: account.clerkUserId, createdAt: account.createdAt };
  });
}
