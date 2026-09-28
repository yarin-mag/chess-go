export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';
/** Algebraic square name, e.g. 'e4'. */
export type Square = string;

export interface Piece {
  type: PieceType;
  color: Color;
}

export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

export interface MoveRecord extends MoveInput {
  san: string;
  color: Color;
  piece: PieceType;
  captured?: PieceType;
  /** chess.js flags: n normal, b pawn double push, e en passant, c capture, p promotion, k/q castle. */
  flags: string;
  /** Position after the move. */
  fen: string;
}

export type DrawReason = 'stalemate' | 'insufficient' | 'threefold' | 'fifty' | 'agreement';

export type GameResult =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'timeout'; winner: Color }
  | { kind: 'resign'; winner: Color }
  | { kind: 'draw'; reason: DrawReason }
  | { kind: 'disconnected'; winner: Color };

export type Level = 'easy' | 'medium' | 'hard';
export type PlayerKind = { type: 'human' } | { type: 'engine'; level: Level } | { type: 'remote' };

/** minutes === 0 means untimed. */
export interface TimeControl {
  name: string;
  minutes: number;
  incrementSec: number;
}

export const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');
