import { ChessGame } from '@/core/chessGame';
import type { MoveInput } from '@/core/types';
import { requestMoveGrade } from '@/engine/engineClient';
import { classify, type Tier } from '@/engine/classify';
import { explainTags, phraseFor, reasonFor, type ExplanationTag } from '@/engine/explain';

export interface ExploredMove {
  san: string;
  tier: Tier;
  tags: ExplanationTag[];
  phrase: string;
  reason: string;
}

/**
 * Grades a move the player is merely curious about — never actually played — through the same
 * worker-backed grading path puzzleStore's wrong-attempt feedback already uses, so this never blocks
 * the UI thread. `tier`/`tags` always compute as a plain candidate (never "best"/"brilliant"): those
 * labels describe how a move compares to what was actually played in a real game, which has no meaning
 * for a hypothetical the player is just exploring.
 */
export async function exploreMove(fenBefore: string, candidate: MoveInput, seed = 0): Promise<ExploredMove> {
  const grade = await requestMoveGrade(fenBefore, candidate);
  const before = new ChessGame(fenBefore);
  const after = new ChessGame(fenBefore);
  const record = after.move(candidate)!;
  const tier = classify(grade.centipawnLoss, false, false);
  const tags = explainTags({ before, after, move: record, grade, tier, ply: 0 });
  return {
    san: record.san,
    tier,
    tags,
    phrase: tags.map((tag, i) => phraseFor(tag, tier, record.san, seed + i)).join(' '),
    reason: tags.map((tag, i) => reasonFor(tag, tier, record.san, seed + i)).join(' '),
  };
}
