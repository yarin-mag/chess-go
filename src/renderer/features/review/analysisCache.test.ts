import { beforeEach, describe, expect, it } from 'vitest';
import { clearAnalysisCache, getCachedAnalysis, setCachedAnalysis } from './analysisCache';
import type { MoveAnalysis } from './analyzeGame';

const analysis = [{ ply: 0 }] as unknown as MoveAnalysis[];

describe('analysisCache', () => {
  beforeEach(() => clearAnalysisCache());

  it('returns undefined for a game id that was never cached', () => {
    expect(getCachedAnalysis('g1')).toBeUndefined();
  });

  it('returns what was set for a given game id', () => {
    setCachedAnalysis('g1', analysis);
    expect(getCachedAnalysis('g1')).toBe(analysis);
  });

  it('keeps separate entries per game id', () => {
    setCachedAnalysis('g1', analysis);
    expect(getCachedAnalysis('g2')).toBeUndefined();
  });

  it('clearAnalysisCache empties every entry', () => {
    setCachedAnalysis('g1', analysis);
    clearAnalysisCache();
    expect(getCachedAnalysis('g1')).toBeUndefined();
  });
});
