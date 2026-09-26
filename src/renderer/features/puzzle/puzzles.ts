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

/** A deterministic, date-seeded pick from the whole set — the same puzzle for everyone on a given day. */
export function dailyPuzzle(date: Date = new Date()): PuzzleData {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return ALL[hash % ALL.length];
}

/** How far (0-100) through the whole ladder `furthestStage`/`furthestPuzzleIndex` reaches. */
export function overallProgress(furthestStage: number, furthestPuzzleIndex: number): number {
  let solvedCount = 0;
  for (let s = 0; s < furthestStage; s++) solvedCount += totalStagePuzzleCount(s);
  solvedCount += Math.min(furthestPuzzleIndex, totalStagePuzzleCount(furthestStage));
  return Math.round((solvedCount / totalPuzzleCount()) * 100);
}
