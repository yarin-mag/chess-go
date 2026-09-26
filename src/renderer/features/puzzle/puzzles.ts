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
