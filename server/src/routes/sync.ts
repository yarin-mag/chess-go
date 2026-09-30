import type { FastifyInstance } from 'fastify';

const MAX_SYNC_BATCH = 50;

interface SyncItem {
  localId: string;
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
    (i.kind === 'vsComputer' || i.kind === 'milestone') &&
    typeof i.playedAt === 'string' &&
    typeof i.localSeq === 'number' &&
    'transcript' in i
  );
}

/** Shape-validates and acknowledges a batch of offline results — does not credit any coins.
 *  Sub-project 2 replaces the accept-everything-valid loop below with real replay-verification and
 *  ledger crediting, without changing this route's request/response contract. */
export function syncRoutes(app: FastifyInstance): void {
  app.post('/sync/offline-results', async (req, reply) => {
    if (!req.session) return reply.code(401).send({ error: 'missing session' });

    const body = req.body as { items?: unknown };
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items) return reply.code(400).send({ error: 'items must be an array' });
    if (items.length > MAX_SYNC_BATCH) {
      return reply.code(400).send({ error: `at most ${MAX_SYNC_BATCH} items per sync request` });
    }

    const results = items.map((item) => {
      if (!isValidItem(item)) {
        const localId = typeof (item as { localId?: unknown })?.localId === 'string' ? (item as { localId: string }).localId : 'unknown';
        return { localId, status: 'rejected' as const, reason: 'malformed item' };
      }
      return { localId: item.localId, status: 'accepted' as const };
    });

    return { results };
  });
}
