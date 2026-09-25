import { describe, expect, it } from 'vitest';
import { attackersOf, cheapestAttackerValue } from './attacks';

describe('attacks', () => {
  it('finds the pieces of a color that attack a square', () => {
    expect(attackersOf('6k1/8/8/8/8/8/8/R3K3 w - - 0 1', 'a8', 'w')).toEqual(['a1']);
  });

  it('returns no attackers when the square is out of reach', () => {
    expect(attackersOf('6k1/8/8/8/8/8/8/R3K3 w - - 0 1', 'h8', 'w')).toEqual([]);
  });

  it('reports null when the color has no attacker on the square', () => {
    // Black pawn on d5 attacks c4/e4, not a5.
    expect(cheapestAttackerValue('6k1/8/8/3p4/8/8/8/R3K3 w - - 0 1', 'a5', 'b')).toBeNull();
  });

  it('is null when nothing attacks the square', () => {
    expect(cheapestAttackerValue('6k1/8/8/8/8/8/8/R3K3 w - - 0 1', 'h1', 'w')).toBeNull();
  });
});
