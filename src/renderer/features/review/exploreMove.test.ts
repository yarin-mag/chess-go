import { describe, expect, it, vi } from 'vitest';

vi.mock('@/engine/engineClient', () => ({
  requestMoveGrade: vi.fn(async (fen: string, move: { from: string; to: string; promotion?: string }) => {
    const { scoreRootMoves } = await import('@/engine/search');
    const { ANALYSIS_LEVEL } = await import('@/engine/analyzeLevel');
    const scored = scoreRootMoves(fen, ANALYSIS_LEVEL);
    const best = scored[0];
    const played = scored.find((s) => s.move.from === move.from && s.move.to === move.to) ?? best;
    return {
      bestMove: best.move, bestSan: best.san, bestScore: best.score,
      playedScore: played.score, centipawnLoss: Math.max(0, best.score - played.score),
    };
  }),
}));

import { exploreMove } from './exploreMove';

describe('exploreMove', () => {
  it('grades an arbitrary legal move without requiring it to have been played', async () => {
    // Same fixture used by describeMove/explain tests: a move that hangs a piece.
    const fen = '6k1/8/8/4p3/8/5N2/8/4K3 w - - 0 1';
    const result = await exploreMove(fen, { from: 'f3', to: 'd4' });
    expect(result.san).toBe('Nd4');
    expect(result.tags).toContain('hangsPiece');
    expect(result.phrase).toContain('Nd4');
    expect(result.reason.length).toBeGreaterThan(result.phrase.length);
  });

  it('never marks an explored move as best/brilliant — it always grades as a plain candidate', async () => {
    const fen = new (await import('@/core/chessGame')).ChessGame().fen();
    const result = await exploreMove(fen, { from: 'e2', to: 'e4' });
    expect(result.tier).not.toBe('brilliant');
  });
});
