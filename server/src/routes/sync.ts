import type { FastifyInstance } from 'fastify';
import type { AccountsRepo } from '../db/accountsRepo.js';

const MAX_SYNC_BATCH = 50;

/** The wire contract's full set of rejection reasons. 'account_invalid' is the one the client acts on
 *  specially (forces a fresh sign-in) — reserved here as a real type, not just plan prose, per the
 *  final whole-branch review's Important finding that it existed only in the spec, never in code. */
export type SyncRejectionReason = 'malformed item' | 'account_invalid';

export interface SyncResultItem {
  localId: string;
  status: 'accepted' | 'rejected';
  reason?: SyncRejectionReason;
}

interface SyncItem {
  localId: string;
  accountId: string;
  kind: 'vsComputer' | 'milestone';
  transcript: unknown;
  playedAt: string;
  localSeq: number;
}

function isValidItem(item: unknown): item is SyncItem {
  if (typeof item !== 'object' || item === null) return false;
  const i = item as Record<string, unknown>;
  return (
    typeof i.localId === 'string' &&
    typeof i.accountId === 'string' &&
    (i.kind === 'vsComputer' || i.kind === 'milestone') &&
    typeof i.playedAt === 'string' &&
    typeof i.localSeq === 'number' &&
    'transcript' in i
  );
}

/** Shape-validates and acknowledges a batch of offline results — does not credit any coins.
 *  Sub-project 2 replaces the accept-everything-valid loop below with real replay-verification and
 *  ledger crediting, without changing this route's request/response contract. */
export function syncRoutes(app: FastifyInstance, opts: { accountsRepo: AccountsRepo }): void {
  app.post('/sync/offline-results', async (req, reply) => {
    if (!req.session) return reply.code(401).send({ error: 'missing session' });

    const body = req.body as { items?: unknown };
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items) return reply.code(400).send({ error: 'items must be an array' });
    if (items.length > MAX_SYNC_BATCH) {
      return reply.code(400).send({ error: `at most ${MAX_SYNC_BATCH} items per sync request` });
    }

    const account = await opts.accountsRepo.findOrCreateByClerkUserId(req.session.clerkUserId);

    const results: SyncResultItem[] = items.map((item) => {
      if (!isValidItem(item)) {
        const localId = typeof (item as { localId?: unknown })?.localId === 'string' ? (item as { localId: string }).localId : 'unknown';
        return { localId, status: 'rejected', reason: 'malformed item' };
      }
      // A queued item stamped with a different account than this session's real one means the device
      // switched signed-in users without ever draining the previous user's queue — reject rather than
      // silently crediting the wrong account (Important finding, final whole-branch review).
      if (item.accountId !== account.id) {
        return { localId: item.localId, status: 'rejected', reason: 'account_invalid' };
      }
      return { localId: item.localId, status: 'accepted' };
    });

    return { results };
  });
}
