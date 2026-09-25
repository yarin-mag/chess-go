import { describe, expect, it } from 'vitest';
import { attackersOf } from './attacks';

describe('attackersOf', () => {
  it('finds a rook attacking down a clear file', () => {
    expect(attackersOf('6k1/8/8/8/8/8/8/R3K3 w - - 0 1', 'a8', 'w')).toEqual(['a1']);
  });

  it('returns no attackers when the square is out of reach', () => {
    expect(attackersOf('6k1/8/8/8/8/8/8/R3K3 w - - 0 1', 'h8', 'w')).toEqual([]);
  });

  it('finds a defender on a square occupied by its own color (chess.js move generation cannot)', () => {
    // White knight on d4, defended by a white pawn on c3 (c3 attacks b4 and d4).
    expect(attackersOf('6k1/8/8/8/3N4/2P5/8/6K1 w - - 0 1', 'd4', 'w')).toEqual(['c3']);
  });

  it('finds a pawn attacker diagonally', () => {
    expect(attackersOf('6k1/8/8/4p3/3N4/8/8/6K1 w - - 0 1', 'd4', 'b')).toEqual(['e5']);
  });

  it('stops a sliding attacker at the first blocker', () => {
    expect(attackersOf('6k1/8/8/8/3n4/8/8/R3K3 w - - 0 1', 'a8', 'w')).toEqual(['a1']); // unaffected: d4 is off-file
    expect(attackersOf('r5k1/8/8/8/8/8/8/R3K3 w - - 0 1', 'a1', 'b')).toEqual(['a8']);
  });
});
