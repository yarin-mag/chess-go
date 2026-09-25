import { requestMoveGrade } from '@/engine/engineClient';
import { classify, type Tier } from '@/engine/classify';
import { explainTags, sacrificesMaterial, type ExplanationTag } from '@/engine/explain';
import { ChessGame } from '@/core/chessGame';
import { lookupOpening, type Opening } from '@/core/openings';
import type { MoveInput, MoveRecord } from '@/core/types';

export interface MoveAnalysis {
  ply: number;
  move: MoveRecord;
  bestMove: MoveInput;
  bestSan: string;
  bestScore: number;
  playedScore: number;
  centipawnLoss: number;
  tier: Tier;
  tags: ExplanationTag[];
  opening: Opening | null;
}

const MATE_THRESHOLD = 99_000;
const toUci = (m: MoveInput) => `${m.from}${m.to}${m.promotion ?? ''}`;

/**
 * Grades every move of a finished game. Runs sequentially (one worker round-trip per ply) so `onProgress`
 * reports steady incremental progress; aborting `signal` stops before the next ply's request is sent.
 */
export async function analyzeGame(
  startFen: string | undefined,
  history: MoveRecord[],
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<MoveAnalysis[]> {
  const results: MoveAnalysis[] = [];
  const replay = new ChessGame(startFen);
  const uciSoFar: string[] = [];

  for (let ply = 0; ply < history.length; ply++) {
    if (signal.aborted) throw new DOMException('Analysis aborted', 'AbortError');

    const move = history[ply];
    const fenBefore = replay.fen();
    const before = new ChessGame(fenBefore);
    const grade = await requestMoveGrade(fenBefore, { from: move.from, to: move.to, promotion: move.promotion });
    replay.move(move);
    const after = new ChessGame(replay.fen());

    const isBestMove =
      grade.bestMove.from === move.from && grade.bestMove.to === move.to && grade.bestMove.promotion === move.promotion;
    const tier = classify(grade.centipawnLoss, isBestMove, isBestMove && sacrificesMaterial(before, move));
    const tags = explainTags({ before, after, move, grade, tier, ply });

    uciSoFar.push(toUci({ from: move.from, to: move.to, promotion: move.promotion }));

    results.push({
      ply,
      move,
      bestMove: grade.bestMove,
      bestSan: grade.bestSan,
      bestScore: grade.bestScore,
      playedScore: grade.playedScore,
      centipawnLoss: grade.centipawnLoss,
      tier,
      tags,
      opening: lookupOpening(uciSoFar),
    });

    onProgress(ply + 1, history.length);
  }

  // Second pass: a move "walks into mate" when the very next ply's best score is a forced mate for
  // whoever moves there (i.e. the opponent, immediately after this move).
  for (let i = 0; i < results.length - 1; i++) {
    if (Math.abs(results[i + 1].bestScore) > MATE_THRESHOLD && !results[i].tags.includes('walksIntoMate')) {
      const prepended: ExplanationTag[] = ['walksIntoMate', ...results[i].tags];
      results[i].tags = prepended.slice(0, 2);
    }
  }

  return results;
}
