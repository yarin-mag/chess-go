import raw from '@/assets/puzzles.json';

export interface PuzzleData {
  id: string;
  fen: string;
  /** UCI moves, alternating [player, opponent, player, ...], always ending on a player move. */
  solution: string[];
  rating: number;
  stage: number;
  themes: string[];
}

const ALL = raw as PuzzleData[];

export const STAGE_COUNT = ALL.reduce((max, p) => Math.max(max, p.stage), 0) + 1;

const BY_STAGE: PuzzleData[][] = Array.from({ length: STAGE_COUNT }, (_, stage) =>
  ALL.filter((p) => p.stage === stage).sort((a, b) => a.rating - b.rating),
);

export function puzzlesForStage(stage: number): PuzzleData[] {
  return BY_STAGE[stage] ?? [];
}

export function totalStagePuzzleCount(stage: number): number {
  return puzzlesForStage(stage).length;
}

export function totalPuzzleCount(): number {
  return ALL.length;
}

/** How far (0-100) through the whole ladder `furthestStage`/`furthestPuzzleIndex` reaches. */
export function overallProgress(furthestStage: number, furthestPuzzleIndex: number): number {
  let solvedCount = 0;
  for (let s = 0; s < furthestStage; s++) solvedCount += totalStagePuzzleCount(s);
  solvedCount += Math.min(furthestPuzzleIndex, totalStagePuzzleCount(furthestStage));
  return Math.round((solvedCount / totalPuzzleCount()) * 100);
}
