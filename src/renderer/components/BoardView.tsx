import type { CSSProperties } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { TrackedPiece } from '@/core/pieceTracking';
import { FILES, isLightSquare, squareToCell } from '@/core/squares';
import type { MoveInput, Square as SquareName } from '@/core/types';
import { Piece } from './Piece';
import { Square } from './Square';
import styles from './Board.module.css';

const INDICES = [0, 1, 2, 3, 4, 5, 6, 7];

export interface BoardViewProps {
  pieces: TrackedPiece[];
  flipped: boolean;
  selected: SquareName | null;
  targets: SquareName[];
  lastMove: MoveInput | null;
  checkSquare: SquareName | null;
  showLegalMoves: boolean;
  isCaptureTarget: (sq: SquareName) => boolean;
  /** Absent = read-only board (used by the post-game review). */
  onSquareClick?: (sq: SquareName) => void;
}

/**
 * Pure board rendering: squares, animated pieces and legal-move hints. No store access, so it drives
 * both live play (`Board`) and the read-only replay board (`ReviewBoard`).
 */
export function BoardView(p: BoardViewProps) {
  return (
    <>
      <div className={styles.grid}>
        {INDICES.flatMap((row) =>
          INDICES.map((col) => {
            const file = p.flipped ? 7 - col : col;
            const rank = p.flipped ? row + 1 : 8 - row;
            const sq = `${FILES[file]}${rank}`;
            return (
              <Square
                key={sq}
                square={sq}
                light={isLightSquare(sq)}
                selected={sq === p.selected}
                lastMove={sq === p.lastMove?.from || sq === p.lastMove?.to}
                check={sq === p.checkSquare}
                fileLabel={row === 7 ? FILES[file] : undefined}
                rankLabel={col === 0 ? String(rank) : undefined}
                onClick={p.onSquareClick}
              />
            );
          }),
        )}
      </div>

      <div className={styles.layer}>
        <AnimatePresence>
          {p.pieces.map((piece) => (
            <Piece
              key={piece.id}
              piece={piece}
              flipped={p.flipped}
              selected={piece.square === p.selected}
              raised={piece.square === p.lastMove?.to}
            />
          ))}
        </AnimatePresence>
      </div>

      {p.showLegalMoves && (
        <div className={styles.layer}>
          {p.targets.map((sq) => {
            const { col, row } = squareToCell(sq, p.flipped);
            return (
              <span
                key={sq}
                className={`${styles.hint} ${p.isCaptureTarget(sq) ? styles.capture : ''}`}
                style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%` } as CSSProperties}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
