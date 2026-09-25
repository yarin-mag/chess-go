import { useMemo, type CSSProperties } from 'react';
import { trackPieces } from '@/core/pieceTracking';
import { useGameStore } from '@/features/game/gameStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { BoardView } from './BoardView';
import { PromotionDialog } from './PromotionDialog';
import styles from './Board.module.css';

export function Board() {
  const { game, config, history, selected, targets, lastMove, flipped, select } = useGameStore();
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const theme = BOARD_THEMES[useSettingsStore((s) => s.boardTheme)];

  const pieces = useMemo(() => trackPieces(config.fen, history), [config.fen, history]);
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
        onSquareClick={select}
      />
      <PromotionDialog />
    </div>
  );
}
