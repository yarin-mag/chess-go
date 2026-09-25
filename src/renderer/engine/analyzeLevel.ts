import type { LevelConfig } from './levels';

/** Depth/time budget for post-game analysis. Not tied to the play difficulties in levels.ts. */
export const ANALYSIS_LEVEL: LevelConfig = {
  depth: 4,
  timeMs: 800,
  quiescence: true,
  randomTopN: 1,
  randomChance: 0,
  noise: 0,
  exact: true,
};
