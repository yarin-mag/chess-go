import { ChessGame } from './chessGame';
import type { MoveInput, MoveRecord, PieceType } from './types';

/** Plain-English names for the piece letters used in algebraic notation and internal move records. */
export const PIECE_NAMES: Record<PieceType, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

/** Turns a played move into a beginner-friendly sentence describing what actually happened on the board. */
export function describeMove(move: MoveRecord): string {
  if (move.flags.includes('k')) return 'Castles kingside (king and rook swap sides toward the h-file).';
  if (move.flags.includes('q')) return 'Castles queenside (king and rook swap sides toward the a-file).';

  const piece = PIECE_NAMES[move.piece];
  let text: string;
  if (move.flags.includes('e')) {
    text = `The ${piece} on ${move.from} captures en passant, landing on ${move.to}.`;
  } else if (move.captured) {
    text = `The ${piece} on ${move.from} captures the ${PIECE_NAMES[move.captured]} on ${move.to}.`;
  } else {
    text = `The ${piece} on ${move.from} moves to ${move.to}.`;
  }

  if (move.promotion) text += ` The pawn then promotes to a ${PIECE_NAMES[move.promotion]}.`;
  if (move.san.endsWith('#')) text += ' This delivers checkmate.';
  else if (move.san.endsWith('+')) text += ' This puts the opponent in check.';

  return text;
}

/**
 * Describes a move that was not (or not yet) played — typically the engine's suggested best move —
 * by playing it on a throwaway copy of the position. The caller's position is never touched.
 */
export function describePotentialMove(fenBefore: string, move: MoveInput): string {
  const game = new ChessGame(fenBefore);
  const record = game.move(move);
  return record ? describeMove(record) : `${move.from} to ${move.to}.`;
}
