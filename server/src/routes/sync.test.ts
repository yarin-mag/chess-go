import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import type { AccountsRepo } from '../db/accountsRepo.js';

const fakeRepo: AccountsRepo = {
  async findOrCreateByClerkUserId(clerkUserId) {
    return { id: 'acct-1', clerkUserId, createdAt: '2026-01-01T00:00:00.000Z' };
  },
};

function app() {
  return buildApp({ verifyToken: async () => ({ clerkUserId: 'u1' }), accountsRepo: fakeRepo });
}

const auth = { authorization: 'Bearer tok' };
const validItem = { localId: 'a', kind: 'vsComputer', transcript: { moves: [] }, playedAt: '2026-09-30T00:00:00.000Z', localSeq: 1 };

describe('POST /sync/offline-results', () => {
  it('returns 401 with no bearer token', async () => {
    const res = await app().inject({ method: 'POST', url: '/sync/offline-results', payload: { items: [] } });
    expect(res.statusCode).toBe(401);
  });

  it('rejects a request whose body is not { items: [] }', async () => {
    const res = await app().inject({ method: 'POST', url: '/sync/offline-results', headers: auth, payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a batch larger than the max size', async () => {
    const items = Array.from({ length: 51 }, (_, i) => ({ ...validItem, localId: `item-${i}` }));
    const res = await app().inject({ method: 'POST', url: '/sync/offline-results', headers: auth, payload: { items } });
    expect(res.statusCode).toBe(400);
  });

  it('accepts a shape-valid item and rejects a malformed one, per item, in the same batch', async () => {
    const malformed = { localId: 'b', kind: 'not-a-real-kind' };
    const res = await app().inject({
      method: 'POST',
      url: '/sync/offline-results',
      headers: auth,
      payload: { items: [validItem, malformed] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().results).toEqual([
      { localId: 'a', status: 'accepted' },
      { localId: 'b', status: 'rejected', reason: 'malformed item' },
    ]);
  });
});
