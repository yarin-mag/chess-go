import { describe, it, expect } from 'vitest';
import { ChessGame } from './chessGame';

describe('ChessGame', () => {
  it('lists legal targets for the e2 pawn', () => {
    expect(new ChessGame().legalMovesFrom('e2').sort()).toEqual(['e3', 'e4']);
  });

  it('rejects illegal moves', () => {
    expect(new ChessGame().move({ from: 'e2', to: 'e5' })).toBeNull();
  });

  it("detects fool's mate", () => {
    const g = new ChessGame();
    for (const [from, to] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) g.move({ from, to });
    expect(g.result()).toEqual({ kind: 'checkmate', winner: 'b' });
  });

  it('detects stalemate', () => {
    expect(new ChessGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').result()).toEqual({ kind: 'draw', reason: 'stalemate' });
  });

  it('flags promotion moves and expands promotion choices', () => {
    const g = new ChessGame('8/P7/8/8/8/8/k6K/8 w - - 0 1');
    expect(g.isPromotion('a7', 'a8')).toBe(true);
    const promos = g.legalMoves().filter((m) => m.from === 'a7').map((m) => m.promotion).sort();
    expect(promos).toEqual(['b', 'n', 'q', 'r']);
  });

  it('undo restores the position', () => {
    const g = new ChessGame();
    const start = g.fen();
    g.move({ from: 'e2', to: 'e4' });
    g.undo();
    expect(g.fen()).toBe(start);
  });

  it('reports check and king square', () => {
    const g = new ChessGame('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
    expect(g.inCheck()).toBe(true);
    expect(g.kingSquare('w')).toBe('e1');
  });

  it('records captures in history', () => {
    const g = new ChessGame();
    for (const [from, to] of [['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5']]) g.move({ from, to });
    expect(g.history()[2]).toMatchObject({ captured: 'p', san: 'exd5', color: 'w' });
  });
});
