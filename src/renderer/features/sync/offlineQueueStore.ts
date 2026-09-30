import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { addItem, type QueuedItem } from './offlineQueueDB';

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
  const localSeq = useOfflineQueueStore.getState().nextLocalSeq;
  useOfflineQueueStore.setState({ nextLocalSeq: localSeq + 1 });
  const item: QueuedItem = {
    localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    transcript: input.transcript,
    playedAt: new Date().toISOString(),
    localSeq,
  };
  await addItem(item);
}
