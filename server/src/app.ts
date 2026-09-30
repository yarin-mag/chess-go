import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';

/** Builds (but does not start) the Fastify app — kept separate from index.ts so tests can use
 *  `.inject()` without binding a real port. */
export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  const origins = (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  app.register(cors, { origin: origins.length > 0 ? origins : true });

  app.register(healthRoutes);

  return app;
}
