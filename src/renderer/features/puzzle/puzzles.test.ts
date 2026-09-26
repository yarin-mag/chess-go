import { describe, expect, it } from 'vitest';
import { ChessGame } from '@/core/chessGame';
import {
  STAGE_COUNT,
  allPuzzles,
  dailyPuzzle,
  overallProgress,
  puzzlesForStage,
  shuffled,
  totalPuzzleCount,
  totalStagePuzzleCount,
} from './puzzles';

describe('puzzles', () => {
  it('has 8 stages', () => {
    expect(STAGE_COUNT).toBe(8);
  });

  it('groups puzzles by stage, sorted by rating', () => {
    const stage0 = puzzlesForStage(0);
    expect(stage0.length).toBeGreaterThan(50);
    expect(stage0.every((p) => p.stage === 0)).toBe(true);
    for (let i = 1; i < stage0.length; i++) expect(stage0[i].rating).toBeGreaterThanOrEqual(stage0[i - 1].rating);
  });

  it('reports a stage size matching its puzzle list', () => {
    expect(totalStagePuzzleCount(0)).toBe(puzzlesForStage(0).length);
  });

  it('every puzzle is a well-formed, legal starting position', () => {
    for (const p of puzzlesForStage(0).concat(puzzlesForStage(STAGE_COUNT - 1))) {
      expect(() => new ChessGame(p.fen)).not.toThrow();
      expect(p.solution.length).toBeGreaterThan(0);
    }
  });

  it('totals every stage', () => {
    const sum = Array.from({ length: STAGE_COUNT }, (_, s) => totalStagePuzzleCount(s)).reduce((a, b) => a + b, 0);
    expect(totalPuzzleCount()).toBe(sum);
  });

  describe('dailyPuzzle', () => {
    it('is deterministic for the same calendar day', () => {
      const a = dailyPuzzle(new Date(2026, 8, 26, 9, 0));
      const b = dailyPuzzle(new Date(2026, 8, 26, 23, 59));
      expect(a.id).toBe(b.id);
    });

    it('differs across different days (for this dataset)', () => {
      const a = dailyPuzzle(new Date(2026, 8, 26));
      const b = dailyPuzzle(new Date(2026, 8, 27));
      expect(a.id).not.toBe(b.id);
    });

    it('always returns a real, well-formed puzzle', () => {
      const p = dailyPuzzle(new Date(2026, 8, 26));
      expect(() => new ChessGame(p.fen)).not.toThrow();
      expect(p.solution.length).toBeGreaterThan(0);
    });
  });

  describe('allPuzzles', () => {
    it('returns every puzzle, and a fresh copy each time', () => {
      const a = allPuzzles();
      expect(a.length).toBe(totalPuzzleCount());
      a.pop();
      expect(allPuzzles().length).toBe(totalPuzzleCount()); // popping the copy didn't mutate the source
    });
  });

  describe('shuffled', () => {
    it('contains exactly the same elements, in some order', () => {
      const input = [1, 2, 3, 4, 5];
      const out = shuffled(input, () => 0.5);
      expect(out.slice().sort()).toEqual(input.slice().sort());
    });

    it('does not mutate the input array', () => {
      const input = [1, 2, 3];
      shuffled(input, Math.random);
      expect(input).toEqual([1, 2, 3]);
    });

    it('is deterministic for a given rng function', () => {
      const rng = (() => {
        let i = 0;
        const seq = [0.1, 0.9, 0.2];
        return () => seq[i++ % seq.length];
      })();
      const rng2 = (() => {
        let i = 0;
        const seq = [0.1, 0.9, 0.2];
        return () => seq[i++ % seq.length];
      })();
      expect(shuffled([1, 2, 3, 4], rng)).toEqual(shuffled([1, 2, 3, 4], rng2));
    });
  });

  describe('overallProgress', () => {
    it('is 0 at the very start', () => {
      expect(overallProgress(0, 0)).toBe(0);
    });

    it('is 100 once every stage is cleared', () => {
      expect(overallProgress(STAGE_COUNT, 0)).toBe(100);
    });

    it('increases within a stage', () => {
      const mid = overallProgress(0, Math.floor(totalStagePuzzleCount(0) / 2));
      expect(mid).toBeGreaterThan(0);
      expect(mid).toBeLessThan(100);
    });
  });
});
