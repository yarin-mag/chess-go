import { memo } from 'react';
import { motion } from 'framer-motion';
import { squareToCell } from '@/core/squares';
import type { TrackedPiece } from '@/core/pieceTracking';
import { pieceImage } from './pieceImages';
import styles from './Piece.module.css';

interface Props {
  piece: TrackedPiece;
  flipped: boolean;
  selected: boolean;
  /** Draw above other pieces (the piece that just moved, so a capture slides over its victim). */
  raised: boolean;
}

const SLIDE = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } as const;

/** A chess piece that glides between squares whenever its `square` (or the board orientation) changes. */
export const Piece = memo(function Piece({ piece, flipped, selected, raised }: Props) {
  const { col, row } = squareToCell(piece.square, flipped);
  const position = { left: `${col * 12.5}%`, top: `${row * 12.5}%` };

  return (
    <motion.img
      className={styles.piece}
      src={pieceImage(piece.color, piece.type)}
      alt=""
      draggable={false}
      style={{ zIndex: selected ? 4 : raised ? 3 : 1 }}
      initial={{ ...position, opacity: 0, scale: 0.6 }}
      animate={{ ...position, opacity: 1, scale: selected ? 1.1 : 1, y: selected ? '-6%' : '0%' }}
      exit={{ opacity: 0, scale: 0.35, transition: { duration: 0.22 } }}
      transition={SLIDE}
    />
  );
});
