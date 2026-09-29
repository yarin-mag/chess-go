import type { MoveInput } from '@/core/types';
import type { PuzzleData } from '@/features/puzzle/puzzles';
import type { VaultEntry } from './blunderVaultStore';

const toUci = (m: MoveInput): string => `${m.from}${m.to}${m.promotion ?? ''}`;

/**
 * Converts a vault entry into the shape PuzzleScreen's solve/hint/feedback UI already consumes.
 * `solution` is a single-element array — PuzzleData's own contract ("always ending on a player move")
 * means one entry already terminates the puzzle immediately on a correct guess, with no scripted
 * opponent reply, which is exactly right: a vault entry has one "you should have played X" answer,
 * not a forced multi-move sequence like the bundled tactical puzzles.
 */
export function toPuzzleData(entry: VaultEntry): PuzzleData {
  return {
    id: entry.id,
    fen: entry.fenBefore,
    solution: [toUci(entry.bestMove)],
    rating: 0,
    stage: -1,
    themes: entry.tags,
  };
}
