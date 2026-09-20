import { describe, expect, it } from 'vitest';
import { ChessGame } from './chessGame';
import { trackPieces } from './pieceTracking';

const play = (fen: string | undefined, moves: [string, string, ('q' | 'r' | 'b' | 'n')?][]) => {
  const g = new ChessGame(fen);
  for (const [from, to, promotion] of moves) g.move({ from, to, promotion });
  return { g, tracked: trackPieces(fen, g.history()) };
};

const at = (tracked: ReturnType<typeof trackPieces>, sq: string) => tracked.find((p) => p.square === sq);

describe('trackPieces', () => {
  it('starts with 32 pieces with unique ids', () => {
    const tracked = trackPieces(undefined, []);
    expect(tracked).toHaveLength(32);
    expect(new Set(tracked.map((p) => p.id)).size).toBe(32);
  });

  it('keeps the same id when a piece moves', () => {
    const before = at(trackPieces(undefined, []), 'e2')!;
    const after = at(play(undefined, [['e2', 'e4']]).tracked, 'e4')!;
    expect(after.id).toBe(before.id);
  });

  it('removes captured pieces', () => {
    const { tracked } = play(undefined, [['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5']]);
    expect(tracked).toHaveLength(31);
    expect(at(tracked, 'd5')).toMatchObject({ color: 'w', type: 'p' });
  });

  it('removes the pawn captured en passant', () => {
    const { tracked } = play(undefined, [['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5'], ['e5', 'd6']]);
    expect(at(tracked, 'd5')).toBeUndefined();
    expect(at(tracked, 'd6')).toMatchObject({ color: 'w' });
    expect(tracked).toHaveLength(31);
  });

  it('moves the rook when castling', () => {
    const { tracked } = play('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', [['e1', 'g1']]);
    expect(at(tracked, 'f1')).toMatchObject({ type: 'r', color: 'w' });
    expect(at(tracked, 'h1')).toBeUndefined();
  });

  it('changes piece type on promotion', () => {
    const { tracked } = play('8/P7/8/8/8/8/k6K/8 w - - 0 1', [['a7', 'a8', 'q']]);
    expect(at(tracked, 'a8')).toMatchObject({ type: 'q', color: 'w' });
  });
});
