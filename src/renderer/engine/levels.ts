import type { Level } from '@/core/types';

export interface LevelConfig {
  /** Maximum search depth in plies. */
  depth: number;
  /** Wall-clock budget; deeper iterations are abandoned once it is spent. */
  timeMs: number;
  /** Search captures beyond the horizon (avoids horizon-effect blunders). */
  quiescence: boolean;
  /** Pick randomly among the best N root moves (1 = always the best). */
  randomTopN: number;
  /** Probability of taking the random pick above. */
  randomChance: number;
  /** Uniform noise (centipawns) added to root scores. */
  noise: number;
  /** Score every root move exactly rather than pruning later ones with a narrowed window. */
  exact: boolean;
}

export const LEVELS: Record<Level, LevelConfig> = {
  easy: { depth: 1, timeMs: 300, quiescence: false, randomTopN: 4, randomChance: 0.3, noise: 40, exact: true },
  medium: { depth: 3, timeMs: 1500, quiescence: true, randomTopN: 1, randomChance: 0, noise: 10, exact: true },
  hard: { depth: 5, timeMs: 2500, quiescence: true, randomTopN: 1, randomChance: 0, noise: 0, exact: false },
};
