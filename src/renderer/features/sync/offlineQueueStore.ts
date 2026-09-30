import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { addItem, type QueuedItem } from './offlineQueueDB';
import { useAuthStore } from '@/features/auth/authStore';

interface OfflineQueueMetaState {
  /** The next localSeq to assign — persisted separately from the queue items themselves (in
   *  localStorage, not IndexedDB) so it survives even a queue that's been fully drained, and never
   *  resets to 1 and starts colliding with a still-syncing earlier batch's sequence numbers. */
  nextLocalSeq: number;
}

export const useOfflineQueueStore = create<OfflineQueueMetaState>()(
  persist(() => ({ nextLocalSeq: 1 }), {
    name: 'b-chess-offline-queue-seq',
    storage: createJSONStorage(() => localStorage),
  }),
);

/** Records one offline result for later sync. Never throws on the caller — a write failure here
 *  (e.g. IndexedDB unavailable in some embedded context) should never interrupt the game that just
 *  finished; callers fire-and-forget this. */
export async function enqueueOfflineResult(input: {
  kind: QueuedItem['kind'];
  transcript: unknown;
}): Promise<void> {
  // Stamped from the store, not passed in — every caller already gates on status === 'signedIn'
  // before calling this, but re-deriving it here (rather than trusting a caller-supplied value) is
  // what lets the server later catch a shared device that switched signed-in users without ever
  // draining the previous user's queue (Important finding, final whole-branch review).
  const accountId = useAuthStore.getState().accountId;
  if (!accountId) return;

  const localSeq = useOfflineQueueStore.getState().nextLocalSeq;
  useOfflineQueueStore.setState({ nextLocalSeq: localSeq + 1 });
  const item: QueuedItem = {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    accountId,
    kind: input.kind,
    transcript: input.transcript,
    playedAt: new Date().toISOString(),
    localSeq,
  };
  // Genuinely never throws (the doc comment's promise) — a caller that `void`s this, as gameStore and
  // puzzleProgressStore both do, would otherwise leave an unhandled rejection on any IndexedDB failure.
  await addItem(item).catch((err) => {
    console.error('Failed to queue offline result; it will not be synced', err);
  });
}
