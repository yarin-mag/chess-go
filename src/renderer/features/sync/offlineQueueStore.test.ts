import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAll, listItems } from './offlineQueueDB';
import { enqueueOfflineResult, useOfflineQueueStore } from './offlineQueueStore';

beforeEach(async () => {
  await clearAll();
  useOfflineQueueStore.setState({ nextLocalSeq: 1 });
});

describe('enqueueOfflineResult', () => {
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
