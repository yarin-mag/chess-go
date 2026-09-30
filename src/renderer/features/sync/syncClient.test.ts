import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./offlineQueueDB', () => ({
  listItems: vi.fn(),
  deleteItem: vi.fn(),
}));

import { deleteItem, listItems } from './offlineQueueDB';
import { syncOfflineQueue } from './syncClient';
import { useAuthStore } from '@/features/auth/authStore';

const item = (localId: string) => ({
  localId,
  accountId: 'acct-1',
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
  useAuthStore.setState({ status: 'signedOut', accountId: null, clerkUserId: null, hasEverAuthenticated: false });
});

describe('syncOfflineQueue', () => {
  it('does nothing when the queue is empty', async () => {
    vi.mocked(listItems).mockResolvedValue([]);
    await syncOfflineQueue(async () => 'tok');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('POSTs the queue and deletes accepted items', async () => {
    vi.mocked(listItems).mockResolvedValue([item('a'), item('b')]);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ results: [{ localId: 'a', status: 'accepted' }, { localId: 'b', status: 'rejected', reason: 'malformed item' }] }), { status: 200 }),
    );
    await syncOfflineQueue(async () => 'tok');
    expect(deleteItem).toHaveBeenCalledWith('a');
  });

  // Important finding (final whole-branch review): a rejected item used to stay queued forever,
  // re-sent (and re-rejected) on every future sync — a permanent poison pill occupying a batch slot.
  // Every reason this server ever returns today is terminal (not "try again later"), so any rejection
  // is also removed.
  it('deletes a rejected item too, so it is not retried forever', async () => {
    vi.mocked(listItems).mockResolvedValue([item('b')]);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ results: [{ localId: 'b', status: 'rejected', reason: 'malformed item' }] }), { status: 200 }),
    );
    await syncOfflineQueue(async () => 'tok');
    expect(deleteItem).toHaveBeenCalledWith('b');
  });

  // Important finding: the wire contract reserves 'account_invalid' for a queued item whose accountId
  // doesn't match the server's real account for this session (e.g. a shared device switched users
  // without ever draining the previous user's queue). The client must stop trusting the current
  // session and force a fresh sign-in, not keep looping.
  it('signs out and stops draining when the server rejects an item as account_invalid', async () => {
    useAuthStore.setState({ status: 'signedIn', accountId: 'acct-1', clerkUserId: 'u1', hasEverAuthenticated: true });
    vi.mocked(listItems).mockResolvedValue([item('a')]);
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ results: [{ localId: 'a', status: 'rejected', reason: 'account_invalid' }] }), { status: 200 }),
    );
    await syncOfflineQueue(async () => 'tok');
    expect(deleteItem).toHaveBeenCalledWith('a');
    expect(useAuthStore.getState().status).toBe('signedOut');
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

  // Important finding (final whole-branch review): a batch capped only by item count could still cross
  // the server's body-size limit for large real transcripts, get a 413 forever, and deadlock every
  // item behind it (chunk() always reslices the same oversized items). Splitting on 413 instead of
  // retrying the identical slice fixes that without needing to predict transcript sizes up front.
  it('splits a batch in half and retries each half when the server responds 413 (too large)', async () => {
    vi.mocked(listItems).mockResolvedValue([item('a'), item('b')]);
    const calls: number[] = [];
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse(init!.body as string) as { items: { localId: string }[] };
      calls.push(body.items.length);
      if (body.items.length > 1) return new Response(null, { status: 413 });
      return new Response(
        JSON.stringify({ results: body.items.map((i) => ({ localId: i.localId, status: 'accepted' })) }),
        { status: 200 },
      );
    });
    await syncOfflineQueue(async () => 'tok');
    expect(calls).toEqual([2, 1, 1]); // the 2-item batch 413s, then each half (1 item) succeeds
    expect(deleteItem).toHaveBeenCalledWith('a');
    expect(deleteItem).toHaveBeenCalledWith('b');
  });

  // Important finding: real transcripts (full move history + FEN per move) can be large enough that a
  // handful of them alone crosses a sensible body-size limit well before hitting the 50-item cap.
  it('also caps a batch by serialized byte size, not just item count', async () => {
    const bigItem = (localId: string) => ({ ...item(localId), transcript: { blob: 'x'.repeat(1_200_000) } });
    vi.mocked(listItems).mockResolvedValue([bigItem('a'), bigItem('b'), bigItem('c')]);
    const batchSizes: number[] = [];
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const body = JSON.parse(init!.body as string) as { items: { localId: string }[] };
      batchSizes.push(body.items.length);
      return new Response(
        JSON.stringify({ results: body.items.map((i) => ({ localId: i.localId, status: 'accepted' })) }),
        { status: 200 },
      );
    });
    await syncOfflineQueue(async () => 'tok');
    expect(Math.max(...batchSizes)).toBeLessThan(3); // three ~200KB items must not all land in one request
    expect(fetch).toHaveBeenCalledTimes(batchSizes.length);
  });

  // Important finding: an 'online' event coinciding with `status` flipping to 'signedIn' could run two
  // overlapping drains of the same not-yet-deleted queue, double-POSTing the same items.
  it('does not run a second sync while one is already in flight', async () => {
    let resolveList!: (items: ReturnType<typeof item>[]) => void;
    vi.mocked(listItems).mockImplementation(() => new Promise((resolve) => (resolveList = resolve)));
    const first = syncOfflineQueue(async () => 'tok');
    const second = syncOfflineQueue(async () => 'tok'); // overlaps while `first` is still awaiting listItems()
    resolveList([]);
    await Promise.all([first, second]);
    expect(listItems).toHaveBeenCalledTimes(1);
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
