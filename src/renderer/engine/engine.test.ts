import { describe, it, expect } from 'vitest';
import { findBestMove } from './search';
import { ChessGame } from '@/core/chessGame';

const uci = (m: { from: string; to: string }) => `${m.from}${m.to}`;

describe('engine', () => {
  it('finds mate in one (back rank)', () => {
    const fen = '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1';
    for (const level of ['medium', 'hard'] as const) expect(uci(findBestMove(fen, level))).toBe('a1a8');
  });

  it('always returns a legal move at every level', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const m = findBestMove(fen, level);
      expect(new ChessGame(fen).legalMovesFrom(m.from)).toContain(m.to);
    }
  });

  it('hard does not hang its queen', () => {
    // The e5 pawn guards d4; Qd8+ loses the queen to the king.
    const m = findBestMove('4k3/8/8/4p3/8/8/8/3QK3 w - - 0 1', 'hard');
    expect(['d1d4', 'd1d8']).not.toContain(uci(m));
  });

  it('captures a free queen', () => {
    expect(uci(findBestMove('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1', 'hard'))).toBe('d1d5');
  });

  it('returns the only legal move', () => {
    // Rook on h1 checks the h8 king; only Kg8 escapes.
    expect(uci(findBestMove('7k/8/6K1/8/8/8/8/7R b - - 0 1', 'easy'))).toBe('h8g8');
  });
});
