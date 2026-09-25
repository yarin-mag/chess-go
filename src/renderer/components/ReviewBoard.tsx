import { useMemo, useRef, type CSSProperties, type PointerEvent } from 'react';
import { ChessGame } from '@/core/chessGame';
import { trackPieces } from '@/core/pieceTracking';
import { useReviewStore } from '@/features/review/reviewStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { BoardView } from './BoardView';
import styles from './Board.module.css';

const SWIPE_THRESHOLD_PX = 60;

interface Props {
  flipped: boolean;
}

/** Read-only board driven by the review store's current move index; supports swipe navigation. */
export function ReviewBoard({ flipped }: Props) {
  const { config, history, index, next, prev } = useReviewStore();
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const theme = BOARD_THEMES[useSettingsStore((s) => s.boardTheme)];
  const dragStartX = useRef<number | null>(null);

  const visibleHistory = useMemo(() => history.slice(0, index + 1), [history, index]);
  const pieces = useMemo(() => trackPieces(config?.fen, visibleHistory), [config?.fen, visibleHistory]);
  const currentFen = index >= 0 ? visibleHistory[index].fen : (config?.fen ?? new ChessGame().fen());
  const checkSquare = useMemo(() => {
    const g = new ChessGame(currentFen);
    return g.inCheck() ? g.kingSquare(g.turn()) : null;
  }, [currentFen]);
  const lastMove = index >= 0 ? { from: visibleHistory[index].from, to: visibleHistory[index].to } : null;

  const style = { '--sq-light': theme.light, '--sq-dark': theme.dark } as CSSProperties;

  const onPointerDown = (e: PointerEvent) => {
    dragStartX.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (dragStartX.current === null) return;
    const delta = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (delta <= -SWIPE_THRESHOLD_PX) next();
    else if (delta >= SWIPE_THRESHOLD_PX) prev();
  };

  return (
    <div
      className={styles.board}
      style={{ ...style, touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <BoardView
        pieces={pieces}
        flipped={flipped}
        selected={null}
        targets={[]}
        lastMove={lastMove}
        checkSquare={checkSquare}
        showLegalMoves={showLegalMoves}
        isCaptureTarget={() => false}
      />
    </div>
  );
}
