import type { Square } from './types';

export const FILES = 'abcdefgh';

export const squareName = (fileIndex: number, rank: number): Square => `${FILES[fileIndex]}${rank}`;

/** file 0-7 (a-h), rank 1-8. */
export function parseSquare(sq: Square): { file: number; rank: number } {
  return { file: FILES.indexOf(sq[0]), rank: Number(sq[1]) };
}

/** Grid cell (0-7 from top-left) a square occupies on screen, given the board orientation. */
export function squareToCell(sq: Square, flipped: boolean): { col: number; row: number } {
  const { file, rank } = parseSquare(sq);
  return flipped ? { col: 7 - file, row: rank - 1 } : { col: file, row: 8 - rank };
}

export const isLightSquare = (sq: Square): boolean => {
  const { file, rank } = parseSquare(sq);
  return (file + rank) % 2 === 1;
};
