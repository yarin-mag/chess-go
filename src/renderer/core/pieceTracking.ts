import { ChessGame } from './chessGame';
import { FILES } from './squares';
import type { Color, MoveRecord, PieceType, Square } from './types';

/** A piece with a stable identity, so the UI can animate it from square to square. */
export interface TrackedPiece {
  id: string;
  type: PieceType;
  color: Color;
  square: Square;
}

function castlingRookMove(m: MoveRecord): { from: Square; to: Square } | null {
  const rank = m.from[1];
  if (m.flags.includes('k')) return { from: `h${rank}`, to: `f${rank}` };
  if (m.flags.includes('q')) return { from: `a${rank}`, to: `d${rank}` };
  return null;
}

function applyMove(pieces: TrackedPiece[], m: MoveRecord): TrackedPiece[] {
  // En passant captures the pawn beside the destination, not on it.
  const capturedSquare = m.flags.includes('e') ? m.to[0] + m.from[1] : m.to;
  const rook = castlingRookMove(m);

  return pieces
    .filter((p) => !(m.captured && p.square === capturedSquare))
    .map((p) => {
      if (p.square === m.from) return { ...p, square: m.to, type: m.promotion ?? p.type };
      if (rook && p.square === rook.from) return { ...p, square: rook.to };
      return p;
    });
}

/** Replays `history` from the starting position, keeping each piece's identity across moves. */
export function trackPieces(initialFen: string | undefined, history: MoveRecord[]): TrackedPiece[] {
  const pieces: TrackedPiece[] = [];
  new ChessGame(initialFen).board().forEach((rank, r) =>
    rank.forEach((p, f) => {
      if (p) pieces.push({ id: `${p.color}${p.type}${pieces.length}`, ...p, square: `${FILES[f]}${8 - r}` });
    }),
  );
  return history.reduce(applyMove, pieces);
}
