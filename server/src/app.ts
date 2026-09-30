import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { authPlugin, type TokenVerifier } from './plugins/auth.js';
import type { AccountsRepo } from './db/accountsRepo.js';

export interface AppDeps {
  verifyToken: TokenVerifier;
  accountsRepo: AccountsRepo;
}

/** Builds (but does not start) the Fastify app — kept separate from index.ts so tests can use
 *  `.inject()` without binding a real port, and without real Clerk/Postgres credentials. */
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false });

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.register(cors, { origin: origins.length > 0 ? origins : true });

  app.register(healthRoutes); // no auth required

  app.register(async (protectedApp) => {
    authPlugin(protectedApp, deps.verifyToken);
    protectedApp.register(meRoutes, { accountsRepo: deps.accountsRepo });
  });

  return app;
}
