import { useTranslation } from 'react-i18next';
import { usePuzzleProgressStore } from '@/features/puzzle/puzzleProgressStore';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';
import { overallProgress, STAGE_COUNT, totalStagePuzzleCount } from '@/features/puzzle/puzzles';
import { useBlunderVaultStore } from '@/features/vault/blunderVaultStore';
import styles from './PuzzleMapScreen.module.css';

interface Props {
  /** Omitted when embedded as a tab (Learn) rather than opened as a standalone overlay — hides the
   *  "Menu" exit button, since there's nowhere to exit to. */
  onExit?: () => void;
}

export function PuzzleMapScreen({ onExit }: Props) {
  const { t } = useTranslation();
  const { furthestStage, furthestPuzzleIndex, currentStreak, longestStreak, solvedCount, rushBest } = usePuzzleProgressStore();
  const { start, startDaily, startRush, startVault } = usePuzzleStore();
  const vaultCount = useBlunderVaultStore((s) => s.entries.length);
  const overall = overallProgress(furthestStage, furthestPuzzleIndex);

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1>{t('puzzles:puzzleRoadmap')}</h1>
          <p>{t('puzzles:progressSummary', { percent: overall, stages: STAGE_COUNT, solved: solvedCount })}</p>
          <div className={styles.overallTrack}>
            <div className={styles.overallFill} style={{ width: `${overall}%` }} />
          </div>
          {currentStreak > 0 && (
            <p className={styles.streak}>
              {t('puzzles:streak', { count: currentStreak })}
              {longestStreak > currentStreak && t('puzzles:streakBest', { best: longestStreak })}
            </p>
          )}
          <button className={`btn btn-primary ${styles.dailyButton}`} onClick={startDaily}>
            {t('puzzles:dailyPuzzle')}
          </button>

          <div className={styles.rushRow}>
            <button className="btn" onClick={() => startRush('3')}>
              {t('puzzles:rush3')}
              {rushBest['3'] > 0 && t('puzzles:rushBestSuffix', { best: rushBest['3'] })}
            </button>
            <button className="btn" onClick={() => startRush('5')}>
              {t('puzzles:rush5')}
              {rushBest['5'] > 0 && t('puzzles:rushBestSuffix', { best: rushBest['5'] })}
            </button>
          </div>

          {vaultCount > 0 ? (
            <button className="btn" onClick={startVault}>
              {t('puzzles:myMistakes')}
            </button>
          ) : (
            <p className={styles.streak}>{t('puzzles:myMistakesEmpty')}</p>
          )}
        </header>

        <ol className={styles.stages}>
          {Array.from({ length: STAGE_COUNT }, (_, stage) => {
            const size = totalStagePuzzleCount(stage);
            const reached = stage < furthestStage ? size : stage === furthestStage ? furthestPuzzleIndex : 0;
            const percent = size > 0 ? Math.round((reached / size) * 100) : 0;
            const locked = stage > furthestStage;

            return (
              <li key={stage} className={`${styles.stage} ${locked ? styles.locked : ''}`}>
                <button
                  className={styles.stageButton}
                  disabled={locked}
                  onClick={() => start(stage, stage === furthestStage ? furthestPuzzleIndex : 0)}
                >
                  <span className={styles.stageNumber}>{stage + 1}</span>
                  <span className={styles.stageInfo}>
                    <span className={styles.stageName}>
                      {t(`puzzles:stage_${stage}`, { defaultValue: t('puzzles:stageFallback', { n: stage + 1 }) })}
                    </span>
                    <span className={styles.stageCount}>{t('puzzles:solvedOfSize', { reached, size })}</span>
                    <div className={styles.stageTrack}>
                      <div className={styles.stageFill} style={{ width: `${percent}%` }} />
                    </div>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {onExit && (
          <button className="btn" onClick={onExit}>
            {t('common:menu')}
          </button>
        )}
      </div>
    </div>
  );
}
