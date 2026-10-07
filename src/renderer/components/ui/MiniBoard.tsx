import type { CSSProperties } from 'react';
import { ChessGame } from '@/core/chessGame';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { pieceImage } from '../pieceImages';
import styles from './MiniBoard.module.css';

interface Props {
  fen: string;
  /** Pixel size of the whole board (it's always square). */
  size: number;
  flipped?: boolean;
}

/** Small, read-only board preview rendered straight from a FEN — no selection, animation or legal-move
 *  state, unlike `Board`/`BoardView` (which are for the live game). Used wherever the design calls for a
 *  board thumbnail: Home's "resume game" bubble, and (Phase 2+) the chat sheet's shrunk board and the Me
 *  screen's loadout preview — one renderer instead of a bespoke grid per screen. */
export function MiniBoard({ fen, size, flipped = false }: Props) {
  const theme = BOARD_THEMES[useSettingsStore((s) => s.boardTheme)];
  const game = new ChessGame(fen);
  const rows = game.board();

  const cells = rows.flatMap((row, rowIndex) =>
    row.map((piece, colIndex) => {
      const displayRow = flipped ? 7 - rowIndex : rowIndex;
      const displayCol = flipped ? 7 - colIndex : colIndex;
      const light = (displayRow + displayCol) % 2 === 0;
      return (
        <div
          key={`${rowIndex}-${colIndex}`}
          className={styles.cell}
          style={{ background: light ? theme.light : theme.dark }}
        >
          {piece && <img src={pieceImage(piece.color, piece.type)} alt="" className={styles.piece} />}
        </div>
      );
    }),
  );

  return (
    <div className={styles.board} style={{ '--size': `${size}px` } as CSSProperties}>
      {cells}
    </div>
  );
}
