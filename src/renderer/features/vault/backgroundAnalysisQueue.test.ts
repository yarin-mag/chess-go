import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/review/analyzeGame', () => ({
  analyzeGame: vi.fn(),
}));

import { analyzeGame } from '@/features/review/analyzeGame';
import type { ExplanationTag } from '@/engine/explain';
import { clearAnalysisCache, getCachedAnalysis } from '@/features/review/analysisCache';
import { useBlunderVaultStore } from './blunderVaultStore';
import { abortBackgroundAnalysis, enqueueBackgroundAnalysis } from './backgroundAnalysisQueue';

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  abortBackgroundAnalysis();
  useBlunderVaultStore.setState({ entries: [], solvedIds: [] });
  vi.mocked(analyzeGame).mockReset();
  clearAnalysisCache();
});

const grade = {
  ply: 0,
  tier: 'blunder' as const,
  tags: [] as ExplanationTag[],
  fenBefore: 'fen',
  bestMove: { from: 'a1', to: 'a8' },
  bestSan: 'Ra8',
  bestScore: 100,
  playedScore: -200,
  centipawnLoss: 300,
  move: { san: 'Kh2', color: 'w' } as never,
  opening: null,
};

describe('enqueueBackgroundAnalysis', () => {
  it('runs analyzeGame and stores extracted vault entries on completion', async () => {
    vi.mocked(analyzeGame).mockResolvedValueOnce([grade]);
    enqueueBackgroundAnalysis({ sourceGameId: 'g1', fen: undefined, history: [], humanColors: ['w'] });
    await flush();
    expect(useBlunderVaultStore.getState().entries).toHaveLength(1);
    expect(useBlunderVaultStore.getState().entries[0].sourceGameId).toBe('g1');
  });

  // Reviewing the same game right after it ends (or later, from Saved Games) used to recompute this
  // exact analysis from scratch every time — this is the one place it's ever actually computed, so it's
  // the one place that can cache it for Review to reuse instead of discarding it.
  it('caches the full analysis under the game id so Review can reuse it', async () => {
    vi.mocked(analyzeGame).mockResolvedValueOnce([grade]);
    enqueueBackgroundAnalysis({ sourceGameId: 'g1', fen: undefined, history: [], humanColors: ['w'] });
    await flush();
    expect(getCachedAnalysis('g1')).toEqual([grade]);
  });

  it('runs at most one analysis at a time, queuing the rest', async () => {
    let resolveFirst!: (v: typeof grade[]) => void;
    vi.mocked(analyzeGame).mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)));
    vi.mocked(analyzeGame).mockResolvedValueOnce([]);

    enqueueBackgroundAnalysis({ sourceGameId: 'g1', fen: undefined, history: [], humanColors: ['w'] });
    enqueueBackgroundAnalysis({ sourceGameId: 'g2', fen: undefined, history: [], humanColors: ['w'] });
    await flush();
    expect(analyzeGame).toHaveBeenCalledTimes(1); // second is still queued, not started

    resolveFirst([]);
    await flush();
    expect(analyzeGame).toHaveBeenCalledTimes(2); // second started once the first finished
  });

  it('abortBackgroundAnalysis stops the in-flight run and drops the rest of the queue', async () => {
    vi.mocked(analyzeGame).mockImplementationOnce((_fen, _hist, _progress, signal: AbortSignal) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Analysis aborted', 'AbortError')));
      });
    });
    enqueueBackgroundAnalysis({ sourceGameId: 'g1', fen: undefined, history: [], humanColors: ['w'] });
    enqueueBackgroundAnalysis({ sourceGameId: 'g2', fen: undefined, history: [], humanColors: ['w'] });
    await flush();
    abortBackgroundAnalysis();
    await flush();
    expect(useBlunderVaultStore.getState().entries).toEqual([]);
    // the queued (never-started) g2 item must not run after an abort either
    await flush();
    expect(analyzeGame).toHaveBeenCalledTimes(1);
  });
});
