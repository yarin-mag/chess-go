import { deleteItem, listItems, type QueuedItem } from './offlineQueueDB';
import { useAuthStore } from '@/features/auth/authStore';

// Mirrors server/src/routes/sync.ts's MAX_SYNC_BATCH exactly — kept in sync manually since client and
// server are separate npm projects with no shared package yet (see the spec's note on the shared
// engine package being deferred until sub-project 2 actually needs it).
const MAX_SYNC_BATCH = 50;

// Conservative margin under the server's explicit bodyLimit (server/src/app.ts) — real transcripts
// (full move history + FEN per move) can cross a sensible body-size limit well before hitting the
// item-count cap above; a batch is capped by both (Important finding, final whole-branch review).
const MAX_BATCH_BYTES = 3_000_000;

// Mirrors server/src/routes/sync.ts's SyncRejectionReason exactly (same manual-sync note as above).
// 'account_invalid' is reserved for a queued item whose accountId doesn't match this session's real
// account — the client's one signal to stop trusting the current session.
type SyncRejectionReason = 'malformed item' | 'account_invalid';

interface SyncResultItem {
  localId: string;
  status: 'accepted' | 'rejected';
  reason?: SyncRejectionReason;
}

/** A single in-flight guard — without it, an 'online' event coinciding with `status` flipping to
 *  'signedIn' could run two overlapping drains of the same not-yet-deleted queue, double-POSTing the
 *  same items (Important finding, final whole-branch review). */
let syncing = false;

function chunkByCountAndBytes(items: QueuedItem[]): QueuedItem[][] {
  const batches: QueuedItem[][] = [];
  let current: QueuedItem[] = [];
  let currentBytes = 0;
  for (const item of items) {
    const size = JSON.stringify(item).length;
    if (current.length > 0 && (current.length >= MAX_SYNC_BATCH || currentBytes + size > MAX_BATCH_BYTES)) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

type BatchOutcome = 'ok' | 'failed' | 'account-invalid';

/** Sends one batch. On a 413 (too large), splits it in half and retries each half instead of retrying
 *  the identical oversized slice forever — the byte cap above is a best-effort estimate, not a
 *  guarantee, so this is the real backstop (Important finding, final whole-branch review). */
async function sendBatch(base: string, token: string, batch: QueuedItem[]): Promise<BatchOutcome> {
  if (batch.length === 0) return 'ok';
  try {
    const res = await fetch(`${base}/sync/offline-results`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: batch }),
    });

    if (res.status === 413 && batch.length > 1) {
      const mid = Math.ceil(batch.length / 2);
      const [first, second] = await Promise.all([
        sendBatch(base, token, batch.slice(0, mid)),
        sendBatch(base, token, batch.slice(mid)),
      ]);
      if (first === 'account-invalid' || second === 'account-invalid') return 'account-invalid';
      return first === 'failed' || second === 'failed' ? 'failed' : 'ok';
    }
    if (!res.ok) return 'failed'; // whole batch stays queued, retried on the next sync attempt

    const { results } = (await res.json()) as { results: SyncResultItem[] };
    // Every rejection reason this server returns today is terminal (not "try again later"), so a
    // rejected item is removed exactly like an accepted one — otherwise it's a permanent poison
    // pill, re-sent and re-rejected on every future sync forever (Important finding, final review).
    await Promise.all(results.map((r) => deleteItem(r.localId)));

    return results.some((r) => r.status === 'rejected' && r.reason === 'account_invalid')
      ? 'account-invalid'
      : 'ok';
  } catch {
    return 'failed'; // network failure mid-batch — this batch stays queued; nothing to do here.
  }
}

/** Drains the offline queue to the server, one capped-size batch at a time. Never throws — a sync
 *  failure (network down, server error) just leaves the queue as-is for the next attempt; only
 *  server-acknowledged or terminally-rejected items are ever deleted locally. Called on the browser's
 *  'online' event (Task 11) and is safe to call redundantly (e.g. app foreground) since an empty queue
 *  is a fast no-op, and an overlapping call is a no-op too. Returns false when anything failed, so the
 *  caller (App.tsx) can schedule its own backoff retry — this module owns no timers of its own, so its
 *  tests never leak one. */
export async function syncOfflineQueue(getToken: () => Promise<string | null>): Promise<boolean> {
  if (syncing) return true; // an overlapping call is a no-op; the in-flight one already owns this drain
  syncing = true;
  try {
    const items = await listItems();
    if (items.length === 0) return true;

    const token = await getToken();
    if (!token) return true; // signed out mid-flight — nothing to authenticate this sync with

    const base = import.meta.env.VITE_API_BASE_URL as string;

    let anyFailed = false;
    for (const batch of chunkByCountAndBytes(items)) {
      const outcome = await sendBatch(base, token, batch);
      if (outcome === 'account-invalid') {
        // This session's account no longer matches what's queued (e.g. a different user signed in on
        // this device without ever draining the previous one's queue) — force a fresh sign-in instead
        // of continuing to drain under a token that will just keep getting the same rejection.
        useAuthStore.getState().setSignedOut();
        return true;
      }
      if (outcome === 'failed') anyFailed = true;
    }
    return !anyFailed;
  } finally {
    syncing = false;
  }
}

export type { QueuedItem };
