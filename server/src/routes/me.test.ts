import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { AccountsRepo } from '../db/accountsRepo.js';

function fakeRepo(): AccountsRepo & { calls: string[] } {
  const calls: string[] = [];
  const accounts = new Map<string, { id: string; clerkUserId: string; createdAt: string }>();
  return {
    calls,
    async findOrCreateByClerkUserId(clerkUserId) {
      calls.push(clerkUserId);
      let account = accounts.get(clerkUserId);
      if (!account) {
        account = { id: `acct-${accounts.size + 1}`, clerkUserId, createdAt: '2026-09-30T00:00:00.000Z' };
        accounts.set(clerkUserId, account);
      }
      return account;
    },
  };
}

describe('GET /me', () => {
  it('returns 401 with no bearer token', async () => {
    const app = buildApp({ verifyToken: async () => ({ clerkUserId: 'u1' }), accountsRepo: fakeRepo() });
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
  });

  it('creates and returns an account on first call', async () => {
    const repo = fakeRepo();
    const app = buildApp({ verifyToken: async () => ({ clerkUserId: 'u1' }), accountsRepo: repo });
    const res = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer tok' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().clerkUserId).toBe('u1');
    expect(repo.calls).toEqual(['u1']);
  });

  it('returns the same account id on a second call — never creates two rows', async () => {
    const repo = fakeRepo();
    const app = buildApp({ verifyToken: async () => ({ clerkUserId: 'u1' }), accountsRepo: repo });
    const first = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer tok' } });
    const second = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer tok' } });
    expect(first.json().accountId).toBe(second.json().accountId);
  });
});
