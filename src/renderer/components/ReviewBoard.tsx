import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ChessGame } from '@/core/chessGame';
import { trackPieces } from '@/core/pieceTracking';
import type { Square as SquareName } from '@/core/types';
import { exploreMove, type ExploredMove } from '@/features/review/exploreMove';
import { useReviewStore } from '@/features/review/reviewStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { BoardView } from './BoardView';
import { MoveExplorerPopover } from './MoveExplorerPopover';
import styles from './Board.module.css';

const SWIPE_THRESHOLD_PX = 60;

interface Props {
  flipped: boolean;
}

/**
 * Read-only board driven by the review store's current move index; supports swipe navigation and, while
 * a review is fully analyzed, clicking any legal move other than the one played to explore it ("why not
 * X?") without ever mutating the reviewed game's own position or move list.
 */
export function ReviewBoard({ flipped }: Props) {
  const { config, history, index, next, prev, status } = useReviewStore();
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const theme = BOARD_THEMES[useSettingsStore((s) => s.boardTheme)];
  const dragStartX = useRef<number | null>(null);
  const [explorerSelected, setExplorerSelected] = useState<SquareName | null>(null);
  const [explored, setExplored] = useState<ExploredMove | null>(null);
  const [exploring, setExploring] = useState(false);

  const visibleHistory = useMemo(() => history.slice(0, index + 1), [history, index]);
  const pieces = useMemo(() => trackPieces(config?.fen, visibleHistory), [config?.fen, visibleHistory]);
  const currentFen = index >= 0 ? visibleHistory[index].fen : (config?.fen ?? new ChessGame().fen());
  const currentGame = useMemo(() => new ChessGame(currentFen), [currentFen]);
  const checkSquare = useMemo(() => (currentGame.inCheck() ? currentGame.kingSquare(currentGame.turn()) : null), [currentGame]);
  const lastMove = index >= 0 ? { from: visibleHistory[index].from, to: visibleHistory[index].to } : null;
  const explorerTargets = explorerSelected ? currentGame.legalMovesFrom(explorerSelected) : [];
  const canExplore = status === 'ready';

  const style = { '--sq-light': theme.light, '--sq-dark': theme.dark } as CSSProperties;

  const closeExplorer = () => {
    setExplorerSelected(null);
    setExplored(null);
  };

  const onSquareClick = (sq: SquareName) => {
    if (!canExplore) return;
    if (explorerSelected && explorerTargets.includes(sq)) {
      const from = explorerSelected;
      setExplorerSelected(null);
      setExploring(true);
      exploreMove(currentFen, { from, to: sq }).then((result) => {
        setExplored(result);
        setExploring(false);
      });
      return;
    }
    const piece = currentGame.pieceAt(sq);
    if (piece?.color === currentGame.turn() && sq !== explorerSelected) setExplorerSelected(sq);
    else setExplorerSelected(null);
  };

  const onPointerDown = (e: PointerEvent) => {
    dragStartX.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (dragStartX.current === null) return;
    const delta = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return; // a tap, not a swipe — let onSquareClick handle it
    if (delta <= -SWIPE_THRESHOLD_PX) next();
    else if (delta >= SWIPE_THRESHOLD_PX) prev();
  };

  return (
    <div
      className={styles.board}
      style={{ ...style, touchAction: 'pan-y', position: 'relative' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <BoardView
        pieces={pieces}
        flipped={flipped}
        selected={explorerSelected}
        targets={canExplore ? explorerTargets : []}
        lastMove={lastMove}
        checkSquare={checkSquare}
        showLegalMoves={showLegalMoves}
        isCaptureTarget={(sq) => currentGame.pieceAt(sq) !== null}
        onSquareClick={canExplore ? onSquareClick : undefined}
      />
      {(exploring || explored) && <MoveExplorerPopover move={explored} loading={exploring} onClose={closeExplorer} />}
    </div>
  );
}
