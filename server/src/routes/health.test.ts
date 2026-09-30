import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

describe('GET /health', () => {
  it('responds ok without requiring auth', async () => {
    const app = buildApp({ verifyToken: async () => ({ clerkUserId: 'unused' }), accountsRepo: { findOrCreateByClerkUserId: async () => ({ id: 'unused', clerkUserId: 'unused', createdAt: '2026-01-01T00:00:00.000Z' }) } });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
