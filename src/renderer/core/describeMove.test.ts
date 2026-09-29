import { describe, expect, it } from 'vitest';
import { ChessGame } from './chessGame';
import { describeMove, describePotentialMove } from './describeMove';

describe('describeMove', () => {
  it('describes a plain move', () => {
    const g = new ChessGame();
    const m = g.move({ from: 'e2', to: 'e4' })!;
    expect(describeMove(m)).toBe('The pawn on e2 moves to e4.');
  });

  it('describes a capture', () => {
    const g = new ChessGame('6k1/8/8/3p4/8/8/8/3RK3 w - - 0 1');
    const m = g.move({ from: 'd1', to: 'd5' })!;
    expect(describeMove(m)).toBe('The rook on d1 captures the pawn on d5.');
  });

  it('describes an en passant capture', () => {
    const g = new ChessGame('6k1/8/8/8/4pP2/8/8/6K1 b - f3 0 1');
    const m = g.move({ from: 'e4', to: 'f3' })!;
    expect(describeMove(m)).toBe('The pawn on e4 captures en passant, landing on f3.');
  });

  it('describes kingside castling', () => {
    const g = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const m = g.move({ from: 'e1', to: 'g1' })!;
    expect(describeMove(m)).toBe('Castles kingside (king and rook swap sides toward the h-file).');
  });

  it('describes queenside castling', () => {
    const g = new ChessGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const m = g.move({ from: 'e1', to: 'c1' })!;
    expect(describeMove(m)).toBe('Castles queenside (king and rook swap sides toward the a-file).');
  });

  it('describes a promotion', () => {
    const g = new ChessGame('8/P6k/8/8/8/8/8/6K1 w - - 0 1');
    const m = g.move({ from: 'a7', to: 'a8', promotion: 'q' })!;
    expect(describeMove(m)).toBe('The pawn on a7 moves to a8. The pawn then promotes to a queen.');
  });

  it('notes check and checkmate', () => {
    const check = new ChessGame('7k/8/8/8/8/8/8/4K1R1 w - - 0 1').move({ from: 'g1', to: 'g8' })!;
    expect(describeMove(check)).toContain('This puts the opponent in check.');

    const mate = new ChessGame('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1').move({ from: 'a1', to: 'a8' })!;
    expect(describeMove(mate)).toContain('This delivers checkmate.');
  });

  it('describes the same move in Spanish once the locale changes', async () => {
    const { default: i18n } = await import('@/i18n');
    await i18n.changeLanguage('es');
    const g = new ChessGame();
    const m = g.move({ from: 'e2', to: 'e4' })!;
    expect(describeMove(m)).toBe('El peón en e2 se mueve a e4.');
    await i18n.changeLanguage('en');
  });
});

describe('describePotentialMove', () => {
  it('describes a move that was not actually played, without mutating the caller', () => {
    const fen = '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1';
    const text = describePotentialMove(fen, { from: 'a1', to: 'a8' });
    expect(text).toContain('This delivers checkmate.');
    expect(new ChessGame(fen).fen()).toBe(fen); // original position untouched
  });
});
