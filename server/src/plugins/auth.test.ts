import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import { authPlugin } from './auth.js';

describe('authPlugin', () => {
  it('rejects a request with no Authorization header', async () => {
    const app = Fastify();
    authPlugin(app, async () => ({ clerkUserId: 'user_1' }));
    app.get('/protected', async (req) => ({ clerkUserId: req.session?.clerkUserId }));
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a request whose token fails verification', async () => {
    const app = Fastify();
    authPlugin(app, async () => { throw new Error('bad token'); });
    app.get('/protected', async () => ({ ok: true }));
    const res = await app.inject({ method: 'GET', url: '/protected', headers: { authorization: 'Bearer bad' } });
    expect(res.statusCode).toBe(401);
  });

  it('attaches session claims to the request when the token verifies', async () => {
    const app = Fastify();
    authPlugin(app, async (token) => ({ clerkUserId: `user-for-${token}` }));
    app.get('/protected', async (req) => ({ clerkUserId: req.session?.clerkUserId }));
    const res = await app.inject({ method: 'GET', url: '/protected', headers: { authorization: 'Bearer tok123' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ clerkUserId: 'user-for-tok123' });
  });
});
