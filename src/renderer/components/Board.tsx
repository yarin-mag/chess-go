import { useMemo, type CSSProperties } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChessGame } from '@/core/chessGame';
import { trackPieces } from '@/core/pieceTracking';
import { FILES, isLightSquare, squareName, squareToCell } from '@/core/squares';
import { useGameStore } from '@/features/game/gameStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { Piece } from './Piece';
import { PromotionDialog } from './PromotionDialog';
import { Square } from './Square';
import styles from './Board.module.css';

const INDICES = [0, 1, 2, 3, 4, 5, 6, 7];

export function Board() {
  const { game, config, gameId, fen, history, selected, targets, lastMove, flipped, select } = useGameStore();
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const theme = BOARD_THEMES[useSettingsStore((s) => s.boardTheme)];

  // Recomputed only when the move list changes; keeps piece identities stable so they animate.
  const pieces = useMemo(() => trackPieces(config.fen, history), [config.fen, history, gameId]);
  const checkSquare = useMemo(() => (game.inCheck() ? game.kingSquare(game.turn()) : null), [game, fen]);

  const style = { '--sq-light': theme.light, '--sq-dark': theme.dark } as CSSProperties;
  const isCapture = (sq: string) => game.pieceAt(sq) !== null;

  return (
    <div className={styles.board} style={style}>
      <div className={styles.grid}>
        {INDICES.flatMap((row) =>
          INDICES.map((col) => {
            const file = flipped ? 7 - col : col;
            const rank = flipped ? row + 1 : 8 - row;
            const sq = squareName(file, rank);
            return (
              <Square
                key={sq}
                square={sq}
                light={isLightSquare(sq)}
                selected={sq === selected}
                lastMove={sq === lastMove?.from || sq === lastMove?.to}
                check={sq === checkSquare}
                fileLabel={row === 7 ? FILES[file] : undefined}
                rankLabel={col === 0 ? String(rank) : undefined}
                onClick={select}
              />
            );
          }),
        )}
      </div>

      <div className={styles.layer}>
        <AnimatePresence>
          {pieces.map((piece) => (
            <Piece
              key={piece.id}
              piece={piece}
              flipped={flipped}
              selected={piece.square === selected}
              raised={piece.square === lastMove?.to}
            />
          ))}
        </AnimatePresence>
      </div>

      {showLegalMoves && (
        <div className={styles.layer}>
          {targets.map((sq) => {
            const { col, row } = squareToCell(sq, flipped);
            return (
              <span
                key={sq}
                className={`${styles.hint} ${isCapture(sq) ? styles.capture : ''}`}
                style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%` }}
              />
            );
          })}
        </div>
      )}

      <PromotionDialog />
    </div>
  );
}
