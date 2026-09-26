import { describe, expect, it } from 'vitest';
import { ChessGame } from '@/core/chessGame';
import { STAGE_COUNT, overallProgress, puzzlesForStage, totalPuzzleCount, totalStagePuzzleCount } from './puzzles';

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
