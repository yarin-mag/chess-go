import { describe, expect, it } from 'vitest';
import { parseAuthCallback } from './authCallback';

describe('parseAuthCallback', () => {
  it('reads the ticket and state query params', () => {
    expect(parseAuthCallback('b-chess://auth-callback?ticket=abc&state=xyz')).toEqual({
      ticket: 'abc',
      state: 'xyz',
    });
  });

  it('falls back to __clerk_ticket when ticket is absent', () => {
    expect(parseAuthCallback('b-chess://auth-callback?__clerk_ticket=abc&state=xyz')).toEqual({
      ticket: 'abc',
      state: 'xyz',
    });
  });

  it('returns state: null when no state param is present', () => {
    expect(parseAuthCallback('b-chess://auth-callback?ticket=abc')).toEqual({ ticket: 'abc', state: null });
  });

  it('returns null when there is no ticket at all', () => {
    expect(parseAuthCallback('b-chess://auth-callback?state=xyz')).toBeNull();
  });

  it('returns null for a malformed URL instead of throwing', () => {
    expect(parseAuthCallback('not a url')).toBeNull();
  });
});
