import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { AccountsRepo } from './db/accountsRepo.js';

const fakeRepo: AccountsRepo = {
  async findOrCreateByClerkUserId(clerkUserId) {
    return { id: 'acct-1', clerkUserId, createdAt: '2026-01-01T00:00:00.000Z' };
  },
};

function deps() {
  return { verifyToken: async () => ({ clerkUserId: 'u1' }), accountsRepo: fakeRepo };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('buildApp CORS', () => {
  it('reflects any origin when CORS_ORIGINS is unset (dev convenience, unchanged default)', async () => {
    delete process.env.CORS_ORIGINS;
    delete process.env.NODE_ENV;
    const app = buildApp(deps());
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://anything.example' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('https://anything.example');
  });

  // Important finding (final whole-branch review): the packaged Electron renderer loads over file://
  // and sends `Origin: null`. An explicit CORS_ORIGINS list (as README instructs setting in production)
  // would refuse that preflight and the desktop app could never talk to the server at all.
  it('always allows the literal "null" origin (Electron\'s file:// renderer), even with an explicit list', async () => {
    process.env.CORS_ORIGINS = 'https://example.com';
    const app = buildApp(deps());
    const res = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'null' } });
    expect(res.headers['access-control-allow-origin']).toBe('null');
  });

  it('rejects an origin not in an explicit CORS_ORIGINS list', async () => {
    process.env.CORS_ORIGINS = 'https://example.com';
    const app = buildApp(deps());
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://not-allowed.example' },
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  // Important finding: an unset CORS_ORIGINS in production silently reflects any origin — a deploy
  // that forgets one env var becomes wide open instead of failing to boot.
  it('refuses to build in production when CORS_ORIGINS is unset', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGINS;
    expect(() => buildApp(deps())).toThrow(/CORS_ORIGINS/);
  });

  it('builds fine in production when CORS_ORIGINS is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'https://example.com';
    expect(() => buildApp(deps())).not.toThrow();
  });
});

// Important finding (final whole-branch review): Fastify's default 1 MiB bodyLimit is too small for a
// full batch of real game transcripts. Crossing it used to return a 413 that the client retried
// forever against the identical oversized slice — a permanent deadlock for exactly the "played offline
// for a long stretch" scenario the spec calls out.
describe('buildApp bodyLimit', () => {
  it('accepts a request body larger than Fastify\'s 1 MiB default', async () => {
    const app = buildApp(deps());
    const bigItem = {
      localId: 'a',
      accountId: 'acct-1',
      kind: 'vsComputer',
      transcript: { blob: 'x'.repeat(2_000_000) },
      playedAt: '2026-09-30T00:00:00.000Z',
      localSeq: 1,
    };
    const res = await app.inject({
      method: 'POST',
      url: '/sync/offline-results',
      headers: { authorization: 'Bearer tok' },
      payload: { items: [bigItem] },
    });
    expect(res.statusCode).toBe(200);
  });
});
