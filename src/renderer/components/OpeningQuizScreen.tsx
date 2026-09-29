import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { trackPieces } from '@/core/pieceTracking';
import type { Square as SquareName } from '@/core/types';
import { useOpeningQuizStore } from '@/features/openings/openingQuizStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { BoardView } from './BoardView';
import boardStyles from './Board.module.css';
import styles from './OpeningQuizScreen.module.css';

interface Props {
  onExit: () => void;
}

export function OpeningQuizScreen({ onExit }: Props) {
  const { t } = useTranslation();
  const { opening, game, step, side, correctCount, status, lastWrong, submitMove, exit } = useOpeningQuizStore();
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const theme = BOARD_THEMES[useSettingsStore((s) => s.boardTheme)];
  const [selected, setSelected] = useState<SquareName | null>(null);

  // `game` is a mutable ChessGame instance mutated in place by each move (never replaced), so its own
  // object identity never changes across a quiz's moves — recompute whenever `step` changes instead,
  // since that's exactly when the position actually does.
  const pieces = useMemo(() => trackPieces(undefined, game.history()), [game, step]);
  const isPlayerTurn = status === 'playing' && step % 2 === (side === 'w' ? 0 : 1);
  const targets = selected ? game.legalMovesFrom(selected) : [];
  const style = { '--sq-light': theme.light, '--sq-dark': theme.dark } as CSSProperties;

  const onSquareClick = (sq: SquareName) => {
    if (!isPlayerTurn) return;
    if (selected && targets.includes(sq)) {
      submitMove({ from: selected, to: sq });
      setSelected(null);
      return;
    }
    const piece = game.pieceAt(sq);
    if (piece?.color === game.turn() && sq !== selected) setSelected(sq);
    else setSelected(null);
  };

  const leave = () => {
    exit();
    onExit();
  };

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={boardStyles.board} style={style}>
          <BoardView
            pieces={pieces}
            flipped={side === 'b'}
            selected={selected}
            targets={isPlayerTurn ? targets : []}
            lastMove={null}
            checkSquare={game.inCheck() ? game.kingSquare(game.turn()) : null}
            showLegalMoves={showLegalMoves}
            isCaptureTarget={(sq) => game.pieceAt(sq) !== null}
            onSquareClick={onSquareClick}
          />
        </div>

        {status === 'done' ? (
          <p className={styles.progress}>
            {t('puzzles:quizComplete', { correct: correctCount, total: Math.ceil((opening?.sequence.length ?? 0) / 2) })}
          </p>
        ) : (
          <p className={styles.feedback}>
            {lastWrong ? t('puzzles:notQuiteMove', { san: lastWrong.bookSan }) : t('puzzles:whatsTheMove')}
          </p>
        )}

        <button className="btn" onClick={leave}>
          {t('puzzles:quizExit')}
        </button>
      </div>
    </div>
  );
}
