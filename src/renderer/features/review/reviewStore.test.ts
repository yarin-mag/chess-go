import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReviewStore } from './reviewStore';
import { useGameHistoryStore } from '@/features/history/gameHistoryStore';
import { clearAnalysisCache, setCachedAnalysis } from './analysisCache';
import { UNTIMED } from '@/features/clock/presets';
import type { MoveRecord } from '@/core/types';

vi.mock('./analyzeGame', () => ({
  analyzeGame: vi.fn(async (_fen: string | undefined, history: MoveRecord[], onProgress: (d: number, t: number) => void, signal: AbortSignal) => {
    for (let i = 0; i < history.length; i++) {
      if (signal.aborted) throw new DOMException('aborted', 'AbortError');
      onProgress(i + 1, history.length);
    }
    return history.map((move, ply) => ({
      ply,
      move,
      fenBefore: 'x',
      bestMove: move,
      bestSan: move.san,
      bestScore: 0,
      playedScore: 0,
      centipawnLoss: 0,
      tier: 'best' as const,
      tags: ['solid' as const],
      opening: null,
    }));
  }),
}));

const config = { white: { type: 'human' } as const, black: { type: 'human' } as const, timeControl: UNTIMED };
const fakeHistory = (n: number): MoveRecord[] =>
  Array.from({ length: n }, (_, i) => ({ from: 'e2', to: 'e4', san: `m${i}`, color: 'w' as const, piece: 'p' as const, flags: 'n', fen: 'x' }));

describe('reviewStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameHistoryStore.setState({ games: [] });
    clearAnalysisCache();
  });
  afterEach(() => useReviewStore.getState().exit());

  it('goes from analyzing to ready with full analysis', async () => {
    useReviewStore.getState().start(config, fakeHistory(3));
    expect(useReviewStore.getState().status).toBe('analyzing');
    await vi.waitFor(() => expect(useReviewStore.getState().status).toBe('ready'));
    expect(useReviewStore.getState().analysis).toHaveLength(3);
    expect(useReviewStore.getState().index).toBe(2); // starts on the final position
  });

  it('clamps navigation to valid bounds', async () => {
    useReviewStore.getState().start(config, fakeHistory(2));
    await vi.waitFor(() => expect(useReviewStore.getState().status).toBe('ready'));
    useReviewStore.getState().goTo(-5);
    expect(useReviewStore.getState().index).toBe(-1);
    useReviewStore.getState().goTo(99);
    expect(useReviewStore.getState().index).toBe(1);
    useReviewStore.getState().prev();
    expect(useReviewStore.getState().index).toBe(0);
    useReviewStore.getState().next();
    expect(useReviewStore.getState().index).toBe(1);
  });

  it('exit resets to idle', async () => {
    useReviewStore.getState().start(config, fakeHistory(1));
    await vi.waitFor(() => expect(useReviewStore.getState().status).toBe('ready'));
    useReviewStore.getState().exit();
    expect(useReviewStore.getState().status).toBe('idle');
    expect(useReviewStore.getState().analysis).toHaveLength(0);
  });

  it('reports progress while analyzing', async () => {
    useReviewStore.getState().start(config, fakeHistory(4));
    await vi.waitFor(() => expect(useReviewStore.getState().status).toBe('ready'));
    expect(useReviewStore.getState().progress).toEqual({ done: 4, total: 4 });
  });

  it('records the finished analysis to the game history log by default', async () => {
    useReviewStore.getState().start(config, fakeHistory(3));
    await vi.waitFor(() => expect(useReviewStore.getState().status).toBe('ready'));
    expect(useGameHistoryStore.getState().games).toHaveLength(1);
    expect(useGameHistoryStore.getState().games[0].moves).toHaveLength(3);
  });

  it('skips recording when recordStats is false (Opening Explorer "Watch")', async () => {
    useReviewStore.getState().start(config, fakeHistory(2), { recordStats: false });
    await vi.waitFor(() => expect(useReviewStore.getState().status).toBe('ready'));
    expect(useGameHistoryStore.getState().games).toHaveLength(0);
  });

  // Re-grading the same game every time Review opens (right after finishing, or again later from Saved
  // Games) is exactly the "doesn't cache, re-grades every time" complaint — backgroundAnalysisQueue
  // already computes this once per game for the blunder vault; reviewStore should reuse that instead of
  // re-running analyzeGame from scratch when a sourceGameId is given and already cached.
  it('uses a cached analysis instead of calling analyzeGame again when sourceGameId is already cached', async () => {
    const cached = [{ ply: 0, move: fakeHistory(1)[0], tier: 'best' as const, tags: [] }] as never;
    setCachedAnalysis('g1', cached);
    const { analyzeGame } = await import('./analyzeGame');
    vi.mocked(analyzeGame).mockClear(); // only earlier tests' calls accumulated on this shared mock
    useReviewStore.getState().start(config, fakeHistory(1), { sourceGameId: 'g1' });
    expect(useReviewStore.getState().status).toBe('ready'); // no 'analyzing' wait — it's synchronous from cache
    expect(useReviewStore.getState().analysis).toBe(cached);
    expect(analyzeGame).not.toHaveBeenCalled();
  });

  it('caches a freshly computed analysis under sourceGameId so a later start() reuses it', async () => {
    useReviewStore.getState().start(config, fakeHistory(2), { sourceGameId: 'g2' });
    await vi.waitFor(() => expect(useReviewStore.getState().status).toBe('ready'));
    useReviewStore.getState().exit();

    const { analyzeGame } = await import('./analyzeGame');
    vi.mocked(analyzeGame).mockClear();
    useReviewStore.getState().start(config, fakeHistory(2), { sourceGameId: 'g2' });
    expect(useReviewStore.getState().status).toBe('ready'); // served from cache, not 'analyzing'
    expect(analyzeGame).not.toHaveBeenCalled();
  });
});
