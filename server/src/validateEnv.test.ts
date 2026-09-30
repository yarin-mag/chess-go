import { describe, expect, it } from 'vitest';
import { validateRequiredEnv } from './validateEnv.js';

// Important finding (final whole-branch review): a missing CLERK_SECRET_KEY used to surface only as a
// generic 401 "invalid or expired session" on the very first real request — indistinguishable, to
// whoever's on call, from an actual auth problem. Failing fast at boot makes a deploy misconfiguration
// loud and immediate instead.
describe('validateRequiredEnv', () => {
  it('throws naming every missing required variable when none are set', () => {
    expect(() => validateRequiredEnv({})).toThrow(/CLERK_SECRET_KEY/);
    expect(() => validateRequiredEnv({})).toThrow(/DATABASE_URL/);
  });

  it('throws naming only the variables that are actually missing', () => {
    expect(() => validateRequiredEnv({ CLERK_SECRET_KEY: 'sk_test_x' })).toThrow(/DATABASE_URL/);
  });

  it('does not throw when every required variable is set', () => {
    expect(() =>
      validateRequiredEnv({ CLERK_SECRET_KEY: 'sk_test_x', DATABASE_URL: 'postgresql://x' }),
    ).not.toThrow();
  });
});
