import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, listItems } from './offlineQueueDB';
import { enqueueOfflineResult, useOfflineQueueStore } from './offlineQueueStore';
import { useAuthStore } from '@/features/auth/authStore';

beforeEach(async () => {
  await clearAll();
  useOfflineQueueStore.setState({ nextLocalSeq: 1 });
  // Real callers (gameStore, puzzleProgressStore) only ever call this while signed in.
  useAuthStore.setState({ status: 'signedIn', accountId: 'acct-1', clerkUserId: 'u1', hasEverAuthenticated: true });
});

describe('enqueueOfflineResult', () => {
  // Important finding (final whole-branch review): without a stamped accountId, a device that signs
  // out and a different user signs in on the same machine would sync the first user's queued games
  // under the second user's bearer token, crediting the wrong account.
  it('stamps each item with the currently signed-in accountId', async () => {
    await enqueueOfflineResult({ kind: 'vsComputer', transcript: { moves: ['e4'] } });
    const [stored] = await listItems();
    expect(stored.accountId).toBe('acct-1');
  });

  it('does not enqueue anything when there is no signed-in account', async () => {
    useAuthStore.setState({ status: 'signedOut', accountId: null, clerkUserId: null, hasEverAuthenticated: false });
    await enqueueOfflineResult({ kind: 'vsComputer', transcript: { moves: ['e4'] } });
    expect(await listItems()).toHaveLength(0);
  });

  it('persists the item with a monotonically increasing localSeq', async () => {
    await enqueueOfflineResult({ kind: 'vsComputer', transcript: { moves: ['e4'] } });
    await enqueueOfflineResult({ kind: 'vsComputer', transcript: { moves: ['d4'] } });
    const items = await listItems();
    expect(items.map((i) => i.localSeq)).toEqual([1, 2]);
  });

  it('assigns each item a unique localId', async () => {
    await enqueueOfflineResult({ kind: 'milestone', transcript: { stage: 2 } });
    await enqueueOfflineResult({ kind: 'milestone', transcript: { stage: 3 } });
    const items = await listItems();
    expect(new Set(items.map((i) => i.localId)).size).toBe(2);
  });
});
