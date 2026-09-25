import { Chess } from 'chess.js';
import { PIECE_VALUE } from '@/engine/evaluate';
import type { Color, Square } from './types';

const withTurn = (fen: string, color: Color): string => {
  const parts = fen.split(' ');
  parts[1] = color;
  return parts.join(' ');
};

/**
 * Squares of `byColor`'s pieces that could move to `square` right now, by forcing `byColor` to move
 * from `fen`. This is always a legal thing to ask: right after any legal move the mover's own king is
 * never in check, so pretending it's the *other* side's turn from that same position never produces an
 * illegal one. It only approximates a real attack map (pins are not accounted for), which is acceptable
 * for tutoring heuristics.
 */
export function attackersOf(fen: string, square: Square, byColor: Color): Square[] {
  const chess = new Chess(withTurn(fen, byColor));
  return chess
    .moves({ verbose: true })
    .filter((m) => m.to === square)
    .map((m) => m.from);
}

/** The lowest material value among `byColor`'s attackers of `square`, or null if there are none. */
export function cheapestAttackerValue(fen: string, square: Square, byColor: Color): number | null {
  const chess = new Chess(withTurn(fen, byColor));
  const values = chess
    .moves({ verbose: true })
    .filter((m) => m.to === square)
    .map((m) => PIECE_VALUE[m.piece as keyof typeof PIECE_VALUE]);
  return values.length ? Math.min(...values) : null;
}
