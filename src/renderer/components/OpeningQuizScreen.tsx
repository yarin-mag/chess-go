import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { trackPieces } from '@/core/pieceTracking';
import type { Square as SquareName } from '@/core/types';
import { colorName } from '@/features/game/labels';
import { playerTurnCount, QUIZ_REWARD, useOpeningQuizStore } from '@/features/openings/openingQuizStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { BoardView } from './BoardView';
import boardStyles from './Board.module.css';
import { CoachBubble } from './ui/CoachBubble';
import { CoinBadge } from './ui/CoinBadge';
import { MiniBoard } from './ui/MiniBoard';
import { Pill } from './ui/Pill';
import { ProgressBar } from './ui/ProgressBar';
import styles from './OpeningQuizScreen.module.css';

interface Props {
  onExit: () => void;
}

export function OpeningQuizScreen({ onExit }: Props) {
  const { t } = useTranslation();
  const { opening, game, step, side, correctCount, status, lastWrong, submitMove, clearWrong, bookMoveSan, exit, start } = useOpeningQuizStore();
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const theme = BOARD_THEMES[useSettingsStore((s) => s.boardTheme)];
  const [selected, setSelected] = useState<SquareName | null>(null);
  const [revealed, setRevealed] = useState(false);

  // `game` is a mutable ChessGame instance mutated in place by each move (never replaced), so its own
  // object identity never changes across a quiz's moves — recompute whenever `step` changes instead,
  // since that's exactly when the position actually does.
  const pieces = useMemo(() => trackPieces(undefined, game.history()), [game, step]);
  const isPlayerTurn = status === 'playing' && step % 2 === (side === 'w' ? 0 : 1);
  const targets = selected ? game.legalMovesFrom(selected) : [];
  const style = { '--sq-light': theme.light, '--sq-dark': theme.dark } as CSSProperties;

  if (!opening) return null;

  const total = playerTurnCount(opening.sequence.length, side);
  const completed = playerTurnCount(step, side);
  const currentMoveNumber = Math.min(completed + 1, total);

  const onSquareClick = (sq: SquareName) => {
    if (!isPlayerTurn) return;
    if (selected && targets.includes(sq)) {
      submitMove({ from: selected, to: sq });
      setSelected(null);
      setRevealed(false);
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

  const retrySameStep = () => {
    clearWrong();
    setSelected(null);
  };

  const neededRetry = status === 'done' && correctCount < total;

  return (
    <div className={`round3 ${styles.screen}`}>
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

      <aside className={styles.sidebar}>
        <div className={styles.header}>
          <button className={styles.back} aria-label={t('common:menu')} onClick={leave}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className={styles.headerText}>
            <span className={styles.headerTitle}>{t('puzzles:quizTitle')}</span>
            <span className={styles.headerSubtitle}>{t('puzzles:quizSubtitle', { opening: opening.name, side: colorName(side) })}</span>
          </div>
        </div>

        {status === 'playing' && (
          <>
            <div className={styles.moveRow}>
              <span>{t('puzzles:quizMoveOf', { n: currentMoveNumber, total })}</span>
              <span>{t('puzzles:quizCorrectCount', { count: correctCount })}</span>
            </div>
            <ProgressBar size={total} current={completed} variant={lastWrong ? 'wrong' : 'default'} />
          </>
        )}

        <div className={styles.body}>
          {status === 'playing' && !lastWrong && (
            <CoachBubble>{revealed && bookMoveSan() ? t('puzzles:notQuiteMove', { san: bookMoveSan() }) : t('puzzles:whatsTheMove')}</CoachBubble>
          )}

          {status === 'playing' && lastWrong && <CoachBubble>{t('puzzles:notQuiteMove', { san: lastWrong.bookSan })}</CoachBubble>}

          {status === 'done' && (
            <>
              <div className={styles.score}>
                <span className={styles.scoreKicker}>{t('puzzles:quizScoreKicker')}</span>
                <span className={styles.scoreValue}>
                  {correctCount}
                  <span className={styles.scoreTotal}>/{total}</span>
                </span>
                <div className={styles.scoreCoins}>
                  <span>{t('game:coinsEarned')}</span>
                  <CoinBadge amount={QUIZ_REWARD} size={16} />
                </div>
              </div>
              <CoachBubble>{neededRetry ? t('puzzles:quizDoneSomeWrong', { count: total - correctCount }) : t('puzzles:quizDoneAllCorrect')}</CoachBubble>
              <div className={styles.endBoard}>
                <MiniBoard fen={game.fen()} size={120} flipped={side === 'b'} />
              </div>
            </>
          )}
        </div>

        <div className={styles.actions}>
          {status === 'playing' && !lastWrong && (
            <Pill variant="secondary" className={styles.primaryAction} onClick={() => setRevealed(true)}>
              {t('puzzles:quizShowBookMove')}
            </Pill>
          )}

          {status === 'playing' && lastWrong && (
            <div className={styles.actionRow}>
              <Pill variant="secondary" className={styles.halfAction} onClick={leave}>
                {t('puzzles:quizExit')}
              </Pill>
              <Pill variant="primary" className={styles.halfAction} onClick={retrySameStep}>
                {t('puzzles:tryAgain')}
              </Pill>
            </div>
          )}

          {status === 'done' && (
            <div className={styles.actionRow}>
              <Pill variant="secondary" className={styles.halfAction} onClick={() => start(opening, side === 'w' ? 'b' : 'w')}>
                {t('puzzles:quizPlayAsOther', { side: colorName(side === 'w' ? 'b' : 'w') })}
              </Pill>
              <Pill variant="primary" className={styles.halfAction} onClick={() => start(opening, side)}>
                {t('puzzles:tryAgain')}
              </Pill>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
