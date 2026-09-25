import type { MoveInput } from '@/core/types';
import { ANALYSIS_LEVEL } from './analyzeLevel';
import { scoreRootMoves } from './search';

export interface MoveGrade {
  bestMove: MoveInput;
  bestSan: string;
  bestScore: number;
  playedScore: number;
  centipawnLoss: number;
}

const sameMove = (a: MoveInput, b: MoveInput) => a.from === b.from && a.to === b.to && a.promotion === b.promotion;

/** Grades one played move against the engine's own best move at that position. */
export function analyzeMove(fenBefore: string, played: MoveInput): MoveGrade {
  const scored = scoreRootMoves(fenBefore, ANALYSIS_LEVEL);
  const best = scored[0];
  // The played move is always one of the scored legal moves; falling back to best guards against a desync.
  const playedEntry = scored.find((s) => sameMove(s.move, played)) ?? best;
  return {
    bestMove: best.move,
    bestSan: best.san,
    bestScore: best.score,
    playedScore: playedEntry.score,
    centipawnLoss: Math.max(0, best.score - playedEntry.score),
  };
}
