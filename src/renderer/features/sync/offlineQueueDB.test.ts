import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { addItem, clearAll, deleteItem, listItems } from './offlineQueueDB';

beforeEach(async () => {
  await clearAll();
});

describe('offlineQueueDB', () => {
  it('adds and lists items in insertion order', async () => {
    await addItem({ localId: 'a', kind: 'vsComputer', transcript: {}, playedAt: 't1', localSeq: 1 });
    await addItem({ localId: 'b', kind: 'vsComputer', transcript: {}, playedAt: 't2', localSeq: 2 });
    const items = await listItems();
    expect(items.map((i) => i.localId)).toEqual(['a', 'b']);
  });

  it('deletes a specific item by localId', async () => {
    await addItem({ localId: 'a', kind: 'vsComputer', transcript: {}, playedAt: 't1', localSeq: 1 });
    await addItem({ localId: 'b', kind: 'vsComputer', transcript: {}, playedAt: 't2', localSeq: 2 });
    await deleteItem('a');
    expect((await listItems()).map((i) => i.localId)).toEqual(['b']);
  });

  it('clearAll empties the queue', async () => {
    await addItem({ localId: 'a', kind: 'vsComputer', transcript: {}, playedAt: 't1', localSeq: 1 });
    await clearAll();
    expect(await listItems()).toEqual([]);
  });
});
