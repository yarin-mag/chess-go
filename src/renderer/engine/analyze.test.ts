import { describe, expect, it } from 'vitest';
import { analyzeMove } from './analyze';

describe('analyzeMove', () => {
  it('gives zero loss for the actual best move', () => {
    const fen = '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1';
    const grade = analyzeMove(fen, { from: 'a1', to: 'a8' });
    expect(grade.bestMove).toMatchObject({ from: 'a1', to: 'a8' });
    expect(grade.centipawnLoss).toBe(0);
  });

  it('gives positive loss for a blunder that hangs the queen', () => {
    const fen = '4k3/8/8/4p3/8/8/8/3QK3 w - - 0 1'; // Qd1-d4?? loses the queen to the e5 pawn
    const grade = analyzeMove(fen, { from: 'd1', to: 'd4' });
    expect(grade.centipawnLoss).toBeGreaterThan(300);
  });
});
