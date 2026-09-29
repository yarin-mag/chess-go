import { useTranslation } from 'react-i18next';
import { colorName } from '@/features/game/labels';
import { phraseFor } from '@/engine/explain';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';
import { STAGE_COUNT, totalStagePuzzleCount } from '@/features/puzzle/puzzles';
import { usePuzzleEffects } from '@/hooks/usePuzzleEffects';
import { PuzzleBoard } from './PuzzleBoard';
import styles from './PuzzleScreen.module.css';

const formatRushTime = (ms: number): string => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

interface Props {
  onExit: () => void;
}

export function PuzzleScreen({ onExit }: Props) {
  const { t } = useTranslation();
  usePuzzleEffects();
  const {
    status,
    mode,
    stage,
    puzzleIndex,
    puzzle,
    feedback,
    hint,
    rushRemainingMs,
    rushSolvedCount,
    rushResult,
    retry,
    next,
    showHint,
    showMap,
    startRush,
  } = usePuzzleStore();
  const stageSize = totalStagePuzzleCount(stage);
  const solverColor = puzzle ? (puzzle.fen.split(' ')[1] as 'w' | 'b') : 'w';

  return (
    <div className={styles.screen}>
      <PuzzleBoard />
      <aside className={styles.sidebar}>
        <div className={styles.panel}>
          <p className={styles.stage}>
            {mode === 'daily' && t('puzzles:dailyPuzzle')}
            {mode === 'vault' && t('puzzles:vaultLabel')}
            {mode === 'ladder' &&
              t('puzzles:stageProgress', { stage: stage + 1, total: STAGE_COUNT, puzzle: puzzleIndex + 1, size: stageSize })}
            {mode === 'rush' && status !== 'rushOver' && (
              <span className={styles.rushBar}>
                <span>{t('puzzles:rushTimer', { time: formatRushTime(rushRemainingMs) })}</span>
                <span>{t('puzzles:rushSolvedCount', { count: rushSolvedCount })}</span>
              </span>
            )}
          </p>
          {status !== 'rushOver' && (
            <p className={styles.instruction}>{t('puzzles:findBestMove', { color: colorName(solverColor) })}</p>
          )}

          {status === 'playing' && mode !== 'rush' && (
            <div className={styles.hintRow}>
              {hint ? (
                <p className={styles.hintText}>💡 {hint.text}</p>
              ) : (
                <button className="btn" onClick={showHint}>
                  {t('puzzles:askForHelp')}
                </button>
              )}
            </div>
          )}

          {status === 'wrong' && feedback && (
            <div className={styles.feedback}>
              <span className={`${styles.tier} ${styles[feedback.tier]}`}>{t(`stats:tier_${feedback.tier}`)}</span>
              <p>{feedback.tags.map((tag, i) => phraseFor(tag, feedback.tier, feedback.move.san, i)).join(' ')}</p>
              <button className="btn btn-primary" onClick={retry}>
                {t('puzzles:tryAgain')}
              </button>
            </div>
          )}

          {status === 'solved' && (
            <div className={styles.feedback}>
              <p className={styles.solved}>{t('puzzles:solved')}</p>
              <button className="btn btn-primary" onClick={next}>
                {mode === 'daily' ? t('puzzles:backToMapArrow') : t('puzzles:nextPuzzleArrow')}
              </button>
            </div>
          )}

          {status === 'rushOver' && rushResult && (
            <div className={styles.feedback}>
              <p className={styles.solved}>{rushResult.reason === 'timeUp' ? t('puzzles:timeUp') : t('puzzles:runOver')}</p>
              {feedback && rushResult.reason === 'wrong' && (
                <p>{feedback.tags.map((tag, i) => phraseFor(tag, feedback.tier, feedback.move.san, i)).join(' ')}</p>
              )}
              <p className={styles.rushScore}>
                {t('puzzles:scoreLine', {
                  score: rushResult.score,
                  newBest: rushResult.isNewBest ? t('puzzles:newBestSuffix') : '',
                })}
              </p>
              <div className={styles.actions}>
                <button className="btn btn-primary" onClick={() => startRush(usePuzzleStore.getState().rushDuration!)}>
                  {t('puzzles:playAgain')}
                </button>
                <button className="btn" onClick={showMap}>
                  {t('puzzles:backToMap')}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button className="btn" onClick={showMap}>
            {t('common:map')}
          </button>
          <button className="btn" onClick={onExit}>
            {t('common:menu')}
          </button>
        </div>
      </aside>
    </div>
  );
}
