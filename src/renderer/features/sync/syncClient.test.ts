import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./offlineQueueDB', () => ({
  listItems: vi.fn(),
  deleteItem: vi.fn(),
}));

import { deleteItem, listItems } from './offlineQueueDB';
import { syncOfflineQueue } from './syncClient';

const item = (localId: string) => ({
  localId,
  kind: 'vsComputer' as const,
  transcript: { moves: [] },
  playedAt: '2026-09-30T00:00:00.000Z',
  localSeq: 1,
});

beforeEach(() => {
  vi.mocked(listItems).mockReset();
  vi.mocked(deleteItem).mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('syncOfflineQueue', () => {
  it('does nothing when the queue is empty', async () => {
    vi.mocked(listItems).mockResolvedValue([]);
    await syncOfflineQueue(async () => 'tok');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('POSTs the queue and deletes only the accepted items', async () => {
    vi.mocked(listItems).mockResolvedValue([item('a'), item('b')]);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ results: [{ localId: 'a', status: 'accepted' }, { localId: 'b', status: 'rejected', reason: 'malformed item' }] }), { status: 200 }),
    );
    await syncOfflineQueue(async () => 'tok');
    expect(deleteItem).toHaveBeenCalledWith('a');
    expect(deleteItem).not.toHaveBeenCalledWith('b');
  });

  it('sends the bearer token from getToken', async () => {
    vi.mocked(listItems).mockResolvedValue([item('a')]);
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ results: [{ localId: 'a', status: 'accepted' }] }), { status: 200 }));
    await syncOfflineQueue(async () => 'my-token');
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer my-token');
  });

  it('leaves every item queued (deletes nothing) when the whole request fails', async () => {
    vi.mocked(listItems).mockResolvedValue([item('a')]);
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    await syncOfflineQueue(async () => 'tok'); // must not throw — a failed sync is not the caller's problem
    expect(deleteItem).not.toHaveBeenCalled();
  });

  it('splits the queue into batches no larger than the server\'s cap', async () => {
    const items = Array.from({ length: 120 }, (_, i) => item(`item-${i}`));
    vi.mocked(listItems).mockResolvedValue(items);
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse(init!.body as string) as { items: { localId: string }[] };
      expect(body.items.length).toBeLessThanOrEqual(50);
      return new Response(JSON.stringify({ results: body.items.map((i) => ({ localId: i.localId, status: 'accepted' })) }), { status: 200 });
    });
    await syncOfflineQueue(async () => 'tok');
    expect(fetch).toHaveBeenCalledTimes(3); // 50 + 50 + 20
  });
});
