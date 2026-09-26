import { useMemo, type CSSProperties } from 'react';
import { trackPieces } from '@/core/pieceTracking';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { BoardView } from './BoardView';
import styles from './Board.module.css';

/** Interactive puzzle board, driven by puzzleStore instead of the live-play gameStore. */
export function PuzzleBoard() {
  const { game, puzzle, history, selected, targets, lastMove, flipped, select } = usePuzzleStore();
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const theme = BOARD_THEMES[useSettingsStore((s) => s.boardTheme)];

  const pieces = useMemo(() => trackPieces(puzzle?.fen, history), [puzzle?.fen, history]);
  const checkSquare = useMemo(() => (game.inCheck() ? game.kingSquare(game.turn()) : null), [game, history]);

  const style = { '--sq-light': theme.light, '--sq-dark': theme.dark } as CSSProperties;

  return (
    <div className={styles.board} style={style}>
      <BoardView
        pieces={pieces}
        flipped={flipped}
        selected={selected}
        targets={targets}
        lastMove={lastMove}
        checkSquare={checkSquare}
        showLegalMoves={showLegalMoves}
        isCaptureTarget={(sq) => game.pieceAt(sq) !== null}
        onSquareClick={(sq) => void select(sq)}
      />
    </div>
  );
}
