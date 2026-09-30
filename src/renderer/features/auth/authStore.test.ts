import { beforeEach, describe, expect, it, vi } from 'vitest';

// Critical fix (final whole-branch review): `status` used to be persisted verbatim, so a cold start
// while offline — where `setChecking()` runs and never resolves, because Clerk's SDK needs the network
// to ever leave 'checking' — wrote 'checking' to localStorage. The *next* launch then started from that
// persisted 'checking' too, even before any effect ran: a permanent, self-worsening blank screen for a
// device that HAD a valid cached identity. Fix: never persist `status`; derive the initial in-memory
// status synchronously from whatever identity is already cached, so a previously-authenticated device
// starts as 'signedIn' (usable offline) without waiting on a network call that may never arrive.
describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('starts signedIn when a previous session already cached an account (cold start, e.g. offline)', async () => {
    localStorage.setItem(
      'b-chess-auth',
      JSON.stringify({
        state: { accountId: 'acct-1', clerkUserId: 'u1', hasEverAuthenticated: true },
        version: 0,
      }),
    );
    const { useAuthStore } = await import('./authStore');
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(useAuthStore.getState().accountId).toBe('acct-1');
  });

  it('starts checking when nothing is cached yet (first-ever launch)', async () => {
    const { useAuthStore } = await import('./authStore');
    expect(useAuthStore.getState().status).toBe('checking');
  });

  it('never persists status — only accountId/clerkUserId/hasEverAuthenticated', async () => {
    const { useAuthStore } = await import('./authStore');
    useAuthStore.getState().setSignedIn('acct-2', 'u2');
    const stored = JSON.parse(localStorage.getItem('b-chess-auth')!);
    expect(stored.state).not.toHaveProperty('status');
    expect(stored.state.accountId).toBe('acct-2');
  });
});
