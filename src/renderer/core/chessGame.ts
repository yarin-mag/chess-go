import { Chess, type Move } from 'chess.js';
import {
  opposite,
  type Color,
  type GameResult,
  type MoveInput,
  type MoveRecord,
  type Piece,
  type PieceType,
  type PromotionPiece,
  type Square,
} from './types';

const toRecord = (m: Move): MoveRecord => ({
  from: m.from,
  to: m.to,
  promotion: m.promotion as PromotionPiece | undefined,
  san: m.san,
  color: m.color,
  piece: m.piece as PieceType,
  captured: m.captured as PieceType | undefined,
  flags: m.flags,
  fen: m.after,
});

/** Thin, typed adapter over chess.js so the rest of the app never touches the library directly. */
export class ChessGame {
  private readonly chess: Chess;

  constructor(fen?: string) {
    this.chess = fen ? new Chess(fen) : new Chess();
  }

  fen(): string {
    return this.chess.fen();
  }

  turn(): Color {
    return this.chess.turn();
  }

  /** 8x8 grid, rank 8 first. */
  board(): (Piece | null)[][] {
    return this.chess.board().map((rank) =>
      rank.map((p) => (p ? { type: p.type as PieceType, color: p.color } : null)),
    );
  }

  pieceAt(sq: Square): Piece | null {
    const p = this.chess.get(sq as never);
    return p ? { type: p.type as PieceType, color: p.color } : null;
  }

  legalMovesFrom(sq: Square): Square[] {
    const moves = this.chess.moves({ square: sq as never, verbose: true });
    return [...new Set(moves.map((m) => m.to))];
  }

  /** Every legal move; promotions are expanded into one move per promotion piece. */
  legalMoves(): MoveInput[] {
    return this.chess.moves({ verbose: true }).map((m) => ({
      from: m.from,
      to: m.to,
      promotion: m.promotion as PromotionPiece | undefined,
    }));
  }

  isPromotion(from: Square, to: Square): boolean {
    return this.chess
      .moves({ square: from as never, verbose: true })
      .some((m) => m.to === to && m.promotion !== undefined);
  }

  /** Plays a move; returns null (leaving the position untouched) when illegal. */
  move(m: MoveInput): MoveRecord | null {
    try {
      return toRecord(this.chess.move({ from: m.from, to: m.to, promotion: m.promotion }));
    } catch {
      return null;
    }
  }

  undo(): MoveRecord | null {
    const m = this.chess.undo();
    return m ? toRecord(m) : null;
  }

  history(): MoveRecord[] {
    return this.chess.history({ verbose: true }).map(toRecord);
  }

  inCheck(): boolean {
    return this.chess.isCheck();
  }

  kingSquare(color: Color): Square {
    for (const [r, rank] of this.chess.board().entries()) {
      for (const [f, p] of rank.entries()) {
        if (p?.type === 'k' && p.color === color) return `${'abcdefgh'[f]}${8 - r}`;
      }
    }
    throw new Error(`No ${color} king on board`);
  }

  result(): GameResult | null {
    if (this.chess.isCheckmate()) return { kind: 'checkmate', winner: opposite(this.turn()) };
    if (this.chess.isStalemate()) return { kind: 'draw', reason: 'stalemate' };
    if (this.chess.isInsufficientMaterial()) return { kind: 'draw', reason: 'insufficient' };
    if (this.chess.isThreefoldRepetition()) return { kind: 'draw', reason: 'threefold' };
    if (this.chess.isDraw()) return { kind: 'draw', reason: 'fifty' };
    return null;
  }
}
