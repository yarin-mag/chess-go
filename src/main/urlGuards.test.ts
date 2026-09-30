import { describe, expect, it } from 'vitest';
import { isAllowedExternalUrl, isAuthCallbackUrl } from './urlGuards';

// Important findings (final whole-branch review): main/index.ts forwarded ANY b-chess://... URL to the
// renderer, and ipcMain's 'open-external' handler accepted ANY scheme (including file:) from the
// renderer. Both are protocol/launch-surface hardening gaps once the renderer runs third-party script.
describe('isAuthCallbackUrl', () => {
  it('accepts the literal auth-callback host, with or without a query string', () => {
    expect(isAuthCallbackUrl('b-chess://auth-callback')).toBe(true);
    expect(isAuthCallbackUrl('b-chess://auth-callback?ticket=abc&state=xyz')).toBe(true);
  });

  it('rejects any other b-chess:// path', () => {
    expect(isAuthCallbackUrl('b-chess://something-else')).toBe(false);
  });

  it('rejects a different scheme entirely', () => {
    expect(isAuthCallbackUrl('https://auth-callback')).toBe(false);
  });

  it('rejects a malformed URL instead of throwing', () => {
    expect(isAuthCallbackUrl('not a url')).toBe(false);
  });
});

describe('isAllowedExternalUrl', () => {
  it('accepts https URLs', () => {
    expect(isAllowedExternalUrl('https://example.clerk.accounts.dev/sign-in')).toBe(true);
  });

  it('rejects file: and other launchable schemes', () => {
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects a malformed URL instead of throwing', () => {
    expect(isAllowedExternalUrl('not a url')).toBe(false);
  });
});
