import { deleteItem, listItems, type QueuedItem } from './offlineQueueDB';

// Mirrors server/src/routes/sync.ts's MAX_SYNC_BATCH exactly — kept in sync manually since client and
// server are separate npm projects with no shared package yet (see the spec's note on the shared
// engine package being deferred until sub-project 2 actually needs it).
const MAX_SYNC_BATCH = 50;

interface SyncResultItem {
  localId: string;
  status: 'accepted' | 'rejected';
  reason?: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Drains the offline queue to the server, one capped-size batch at a time. Never throws — a sync
 *  failure (network down, server error) just leaves the queue as-is for the next attempt; only
 *  server-acknowledged ('accepted') items are ever deleted locally. Called on the browser's 'online'
 *  event (Task 11) and is safe to call redundantly (e.g. app foreground) since an empty queue is a
 *  fast no-op. */
export async function syncOfflineQueue(getToken: () => Promise<string | null>): Promise<void> {
  const items = await listItems();
  if (items.length === 0) return;

  const token = await getToken();
  if (!token) return; // signed out mid-flight — nothing to authenticate this sync with

  const base = import.meta.env.VITE_API_BASE_URL as string;

  for (const batch of chunk(items, MAX_SYNC_BATCH)) {
    try {
      const res = await fetch(`${base}/sync/offline-results`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ items: batch }),
      });
      if (!res.ok) continue; // whole batch stays queued, retried on the next sync attempt
      const { results } = (await res.json()) as { results: SyncResultItem[] };
      await Promise.all(
        results.filter((r) => r.status === 'accepted').map((r) => deleteItem(r.localId)),
      );
    } catch {
      // Network failure mid-batch — this batch (and any later ones) stays queued; nothing to do here.
    }
  }
}

export type { QueuedItem };
