import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReviewStore } from './reviewStore';
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
});
