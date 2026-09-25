import { ChessGame } from './chessGame';
import { parseSquare, squareName } from './squares';
import type { Color, Square } from './types';

const KNIGHT_OFFSETS: [number, number][] = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING_OFFSETS: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];
const BISHOP_DIRS: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Squares of `byColor`'s pieces that attack `square` on the position encoded by `fen`, found by scanning
 * board geometry (knight/king offsets, pawn diagonals, sliding rays) directly, rather than through chess.js
 * move generation. Move generation can't express "defends this square" when the square is occupied by a
 * friendly piece — a capture move requires an enemy occupant, so chess.js never lists it. This ignores
 * pins, an acceptable approximation for tutoring heuristics.
 */
export function attackersOf(fen: string, square: Square, byColor: Color): Square[] {
  const board = new ChessGame(fen).board(); // row 0 = rank 8
  const { file, rank } = parseSquare(square);
  const row = 8 - rank;
  const col = file;
  const attackers: Square[] = [];

  const at = (r: number, c: number) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? board[r][c] : null);
  const check = (r: number, c: number, types: string[]) => {
    const p = at(r, c);
    if (p && p.color === byColor && types.includes(p.type)) attackers.push(squareName(c, 8 - r));
  };

  for (const [dr, dc] of KNIGHT_OFFSETS) check(row + dr, col + dc, ['n']);
  for (const [dr, dc] of KING_OFFSETS) check(row + dr, col + dc, ['k']);
  // A white pawn attacks the squares one rank ahead of it, i.e. its own row is the target row + 1; black mirrors.
  const pawnRow = byColor === 'w' ? row + 1 : row - 1;
  check(pawnRow, col - 1, ['p']);
  check(pawnRow, col + 1, ['p']);

  for (const [dr, dc] of BISHOP_DIRS) {
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = at(r, c);
      if (p) {
        if (p.color === byColor && (p.type === 'b' || p.type === 'q')) attackers.push(squareName(c, 8 - r));
        break;
      }
      r += dr;
      c += dc;
    }
  }
  for (const [dr, dc] of ROOK_DIRS) {
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = at(r, c);
      if (p) {
        if (p.color === byColor && (p.type === 'r' || p.type === 'q')) attackers.push(squareName(c, 8 - r));
        break;
      }
      r += dr;
      c += dc;
    }
  }

  return attackers;
}
