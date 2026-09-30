import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { syncRoutes } from './routes/sync.js';
import { authPlugin, type TokenVerifier } from './plugins/auth.js';
import type { AccountsRepo } from './db/accountsRepo.js';

export interface AppDeps {
  verifyToken: TokenVerifier;
  accountsRepo: AccountsRepo;
}

/** Builds (but does not start) the Fastify app — kept separate from index.ts so tests can use
 *  `.inject()` without binding a real port, and without real Clerk/Postgres credentials. */
export function buildApp(deps: AppDeps): FastifyInstance {
  // Fastify's default bodyLimit (1 MiB) is too small for a full batch of real game transcripts (full
  // move history + FEN per move) — crossing it returned a 413 that the client then retried forever
  // against the identical oversized slice, deadlocking every item behind it (Important finding, final
  // whole-branch review). Sized comfortably above the client's own MAX_BATCH_BYTES cap so that cap is
  // what usually applies; the client's 413-split handles the rest.
  const app = Fastify({ logger: false, bodyLimit: 5_000_000 });

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  // An unset CORS_ORIGINS in production used to silently reflect any origin — a deploy that forgot one
  // env var became wide open instead of failing to boot (Important finding, final whole-branch review).
  if (process.env.NODE_ENV === 'production' && origins.length === 0) {
    throw new Error('CORS_ORIGINS must be set in production (an empty value would allow any origin)');
  }
  app.register(cors, {
    origin: (origin, cb) => {
      // No Origin header (server-to-server calls, curl) or the literal "null" origin — which is what
      // the packaged Electron renderer's file:// page sends — is always allowed. An explicit
      // CORS_ORIGINS list (as this app's own README tells operators to set in production) would
      // otherwise refuse that preflight and the desktop app could never reach the server at all
      // (Important finding, final whole-branch review). Electron sends its bearer token via an
      // Authorization header, never cookies, so allowing "null" here carries none of the CSRF risk
      // that makes "null" dangerous to allow for a browser tab.
      if (!origin || origin === 'null' || origins.length === 0 || origins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error('Not allowed by CORS'), false);
    },
  });

  app.register(healthRoutes); // no auth required

  app.register(async (protectedApp) => {
    authPlugin(protectedApp, deps.verifyToken);
    protectedApp.register(meRoutes, { accountsRepo: deps.accountsRepo });
    protectedApp.register(syncRoutes, { accountsRepo: deps.accountsRepo });
  });

  return app;
}
