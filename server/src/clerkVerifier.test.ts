import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const verifyTokenMock = vi.fn(async () => ({ sub: 'u1' }));
vi.mock('@clerk/backend', () => ({ verifyToken: verifyTokenMock }));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  verifyTokenMock.mockClear();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('clerkVerifier', () => {
  it('throws a clear error when CLERK_SECRET_KEY is not set, instead of surfacing as a bare 401 later', async () => {
    delete process.env.CLERK_SECRET_KEY;
    const { clerkVerifier } = await import('./clerkVerifier.js');
    await expect(clerkVerifier('tok')).rejects.toThrow('CLERK_SECRET_KEY');
  });

  it('does not pass authorizedParties when CLERK_AUTHORIZED_PARTIES is unset (unchanged default)', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    delete process.env.CLERK_AUTHORIZED_PARTIES;
    const { clerkVerifier } = await import('./clerkVerifier.js');
    await clerkVerifier('tok');
    expect(verifyTokenMock).toHaveBeenCalledWith('tok', { secretKey: 'sk_test_x' });
  });

  // Important finding (final whole-branch review): Clerk recommends always passing authorizedParties;
  // without it, a valid token is accepted regardless of the `azp` origin it was minted for. The exact
  // right value can't be determined without a live, configured Clerk app (same class of uncertainty as
  // the native ticket-redirect param name), so it's opt-in via env rather than a guessed default that
  // could reject every real request instead.
  it('passes authorizedParties, split on commas, when CLERK_AUTHORIZED_PARTIES is set', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.CLERK_AUTHORIZED_PARTIES = 'https://example.com, https://other.example.com';
    const { clerkVerifier } = await import('./clerkVerifier.js');
    await clerkVerifier('tok');
    expect(verifyTokenMock).toHaveBeenCalledWith('tok', {
      secretKey: 'sk_test_x',
      authorizedParties: ['https://example.com', 'https://other.example.com'],
    });
  });
});
