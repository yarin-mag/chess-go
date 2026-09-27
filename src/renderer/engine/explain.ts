import { attackersOf } from '@/core/attacks';
import { ChessGame } from '@/core/chessGame';
import type { MoveRecord } from '@/core/types';
import { PIECE_VALUE } from './evaluate';
import type { MoveGrade } from './analyze';
import type { Tier } from './classify';

export type ExplanationTag =
  | 'hangsPiece'
  | 'missedMate'
  | 'walksIntoMate'
  | 'goodTrade'
  | 'developsPiece'
  | 'ignoresCenter'
  | 'keepsAdvantage'
  | 'throwsAwayAdvantage'
  | 'solid';

export interface ExplainContext {
  before: ChessGame;
  after: ChessGame;
  move: MoveRecord;
  grade: MoveGrade;
  tier: Tier;
  ply: number;
}

const MATE_THRESHOLD = 99_000; // engine mate scores are (100_000 - plyToMate); this is safely below any real one
const OPENING_PLIES = 10;
const CENTER: readonly string[] = ['d4', 'd5', 'e4', 'e5'];

/** True when `square` can be captured by its own color's opponent for less than the piece is worth. */
export function isHanging(fen: string, square: string): boolean {
  const game = new ChessGame(fen);
  const piece = game.pieceAt(square);
  if (!piece) return false;
  const opponent = piece.color === 'w' ? 'b' : 'w';
  const attackerSquares = attackersOf(fen, square, opponent);
  if (attackerSquares.length === 0) return false;
  const attackerValue = Math.min(...attackerSquares.map((sq) => PIECE_VALUE[game.pieceAt(sq)!.type]));
  const defended = attackersOf(fen, square, piece.color).length > 0;
  const pieceValue = PIECE_VALUE[piece.type];
  return !defended || attackerValue < pieceValue;
}

/** True when a capture gives up more material than it immediately wins back. */
export function sacrificesMaterial(before: ChessGame, move: MoveRecord): boolean {
  if (!move.captured) return false;
  return PIECE_VALUE[move.piece] > PIECE_VALUE[move.captured] + 50;
}

function isMateScore(score: number): boolean {
  return Math.abs(score) > MATE_THRESHOLD;
}

/** Ordered detectors; the first matches win, capped at two tags so the sentence stays short. */
export function explainTags(ctx: ExplainContext): ExplanationTag[] {
  const tags: ExplanationTag[] = [];
  const push = (tag: ExplanationTag) => {
    if (tags.length < 2 && !tags.includes(tag)) tags.push(tag);
  };

  if (isMateScore(ctx.grade.bestScore) && !isMateScore(ctx.grade.playedScore)) push('missedMate');
  if (isHanging(ctx.move.fen, ctx.move.to)) push('hangsPiece');
  if (ctx.move.captured && !sacrificesMaterial(ctx.before, ctx.move) && ctx.tier !== 'blunder' && ctx.tier !== 'mistake') {
    push('goodTrade');
  }
  if (ctx.ply < OPENING_PLIES) {
    if (CENTER.includes(ctx.move.to)) push('developsPiece');
    else if (ctx.move.piece === 'p' && !CENTER.some((sq) => sq[0] === ctx.move.to[0])) push('ignoresCenter');
  }
  if (tags.length === 0) {
    if (ctx.tier === 'mistake' || ctx.tier === 'blunder') push('throwsAwayAdvantage');
    else if (ctx.tier === 'good' || ctx.tier === 'best' || ctx.tier === 'brilliant') push('keepsAdvantage');
    else push('solid');
  }
  return tags;
}

export { phraseFor, reasonFor } from './phrases';
