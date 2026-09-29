import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { ChessGame } from '@/core/chessGame';
import { explainTags, isHanging, sacrificesMaterial, phraseFor, reasonFor } from './explain';
import type { MoveGrade } from './analyze';

// A locale-switch test that throws before its own restore call would otherwise leave every later
// test in this file running against the wrong locale — restore unconditionally instead.
afterEach(async () => {
  if (i18n.language !== 'en') await i18n.changeLanguage('en');
});

const grade = (bestScore: number, playedScore: number): MoveGrade => ({
  bestMove: { from: 'a1', to: 'a1' },
  bestSan: '',
  bestScore,
  playedScore,
  centipawnLoss: Math.max(0, bestScore - playedScore),
});

describe('isHanging', () => {
  it('is true for an undefended piece a lower-value attacker can take', () => {
    // White knight on d4, black pawn on e5 attacks it, nothing white defends d4.
    expect(isHanging('6k1/8/8/4p3/3N4/8/8/6K1 w - - 0 1', 'd4')).toBe(true);
  });

  it('is false when nothing attacks the square', () => {
    expect(isHanging('6k1/8/8/8/3N4/8/8/6K1 w - - 0 1', 'd4')).toBe(false);
  });

  it('is false when the attacker is no cheaper and the piece is defended', () => {
    // Knight d4 attacked by a knight of equal value; a pawn on c3 defends d4, so the trade is even.
    expect(isHanging('6k1/8/8/1n6/3N4/2P5/8/6K1 w - - 0 1', 'd4')).toBe(false);
  });
});

describe('sacrificesMaterial', () => {
  it('is true when a move captures a cheaper piece with a pricier one', () => {
    const before = new ChessGame('6k1/8/8/3p4/8/8/8/3RK3 w - - 0 1');
    const move = before.move({ from: 'd1', to: 'd5' })!; // rook takes pawn
    expect(sacrificesMaterial(before, move)).toBe(true);
  });

  it('is false for a roughly even trade', () => {
    const before = new ChessGame('3r2k1/8/8/8/8/8/8/3RK3 w - - 0 1');
    const move = before.move({ from: 'd1', to: 'd8' })!; // rook takes rook
    expect(sacrificesMaterial(before, move)).toBe(false);
  });
});

describe('explainTags', () => {
  it('tags a move that hangs the piece it just moved', () => {
    const before = new ChessGame('6k1/8/8/4p3/8/5N2/8/4K3 w - - 0 1');
    const move = before.move({ from: 'f3', to: 'd4' })!; // knight lands where the e5 pawn takes it for free
    const after = new ChessGame(move.fen);
    const tags = explainTags({ before, after, move, grade: grade(0, -320), tier: 'blunder', ply: 10 });
    expect(tags).toContain('hangsPiece');
  });

  it('tags a missed forced mate', () => {
    const before = new ChessGame('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1');
    const move = before.move({ from: 'a1', to: 'a7' })!; // not the mating move
    const after = new ChessGame(move.fen);
    const tags = explainTags({ before, after, move, grade: grade(99_990, 50), tier: 'blunder', ply: 10 });
    expect(tags).toContain('missedMate');
  });

  it('falls back to a non-empty tag list when nothing else fires', () => {
    const before = new ChessGame();
    const move = before.move({ from: 'e2', to: 'e4' })!;
    const after = new ChessGame(move.fen);
    const tags = explainTags({ before, after, move, grade: grade(20, 15), tier: 'good', ply: 0 });
    expect(tags.length).toBeGreaterThan(0);
  });
});

describe('phraseFor', () => {
  it('substitutes the move san', () => {
    expect(phraseFor('hangsPiece', 'blunder', 'e4', 0)).toContain('e4');
  });

  it('translates through the active locale', async () => {
    const { default: i18n } = await import('@/i18n');
    await i18n.changeLanguage('es');
    expect(phraseFor('hangsPiece', 'blunder', 'e4', 0)).toContain('colgada');
    await i18n.changeLanguage('en');
  });
});

describe('reasonFor', () => {
  it('substitutes the move san', () => {
    expect(reasonFor('hangsPiece', 'blunder', 'e4', 0)).toContain('e4');
  });

  it('is longer than the short phrase for the same tag, since it is the expanded "why"', () => {
    const short = phraseFor('developsPiece', 'good', 'Nf3', 0);
    const long = reasonFor('developsPiece', 'good', 'Nf3', 0);
    expect(long.length).toBeGreaterThan(short.length);
  });

  it('falls back to the solid reason for an unknown tag/tier combo', () => {
    expect(reasonFor('walksIntoMate', 'brilliant', 'Qh5', 0)).toBeTruthy();
  });
});
