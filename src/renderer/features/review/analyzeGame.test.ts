import { describe, expect, it, vi } from 'vitest';
import { ChessGame } from '@/core/chessGame';
import { analyzeGame } from './analyzeGame';

vi.mock('@/engine/engineClient', () => ({
  requestMoveGrade: vi.fn(async (fen: string, move: { from: string; to: string; promotion?: string }) => {
    const { scoreRootMoves } = await import('@/engine/search');
    const { ANALYSIS_LEVEL } = await import('@/engine/analyzeLevel');
    const scored = scoreRootMoves(fen, ANALYSIS_LEVEL);
    const best = scored[0];
    const played = scored.find((s) => s.move.from === move.from && s.move.to === move.to) ?? best;
    return {
      bestMove: best.move,
      bestSan: best.san,
      bestScore: best.score,
      playedScore: played.score,
      centipawnLoss: Math.max(0, best.score - played.score),
    };
  }),
}));

function playHistory(moves: [string, string][]) {
  const g = new ChessGame();
  for (const [from, to] of moves) g.move({ from, to });
  return g.history();
}

describe('analyzeGame', () => {
  it('produces one analysis entry per ply, in order', async () => {
    const history = playHistory([['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3']]);
    const progress = vi.fn();
    const analysis = await analyzeGame(undefined, history, progress, new AbortController().signal);
    expect(analysis).toHaveLength(3);
    expect(analysis.map((a) => a.ply)).toEqual([0, 1, 2]);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
  });

  it('tags the opening for early moves', async () => {
    const history = playHistory([['e2', 'e4'], ['e7', 'e5']]);
    const analysis = await analyzeGame(undefined, history, () => {}, new AbortController().signal);
    expect(analysis[1].opening).not.toBeNull();
  });

  it('flags a move that allows a forced mate next', async () => {
    // Fool's mate: 1.f3 e5 2.g4?? Qh4# — g4 (ply 2) allows the mate Black then actually delivers (ply 3).
    const history = playHistory([['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]);
    const analysis = await analyzeGame(undefined, history, () => {}, new AbortController().signal);
    expect(analysis[2].tags).toContain('walksIntoMate');
  });

  it('stops early when aborted', async () => {
    const history = playHistory([['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3']]);
    const controller = new AbortController();
    controller.abort();
    await expect(analyzeGame(undefined, history, () => {}, controller.signal)).rejects.toThrow();
  });
});
