import { usePuzzleProgressStore } from '@/features/puzzle/puzzleProgressStore';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';
import { overallProgress, STAGE_COUNT, totalStagePuzzleCount } from '@/features/puzzle/puzzles';
import styles from './PuzzleMapScreen.module.css';

interface Props {
  onExit: () => void;
}

const STAGE_THEME_LABEL = [
  'Mate in 1',
  'Hanging pieces',
  'Forks',
  'Pins & skewers',
  'Discovered attacks',
  'Trapped pieces',
  'Back-rank mates',
  'Mate in 2',
];

export function PuzzleMapScreen({ onExit }: Props) {
  const { furthestStage, furthestPuzzleIndex, currentStreak, longestStreak, solvedCount, rushBest } = usePuzzleProgressStore();
  const { start, startDaily, startRush } = usePuzzleStore();
  const overall = overallProgress(furthestStage, furthestPuzzleIndex);

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1>Puzzle Roadmap</h1>
          <p>
            {overall}% of the way through {STAGE_COUNT} stages · {solvedCount} solved
          </p>
          <div className={styles.overallTrack}>
            <div className={styles.overallFill} style={{ width: `${overall}%` }} />
          </div>
          {currentStreak > 0 && (
            <p className={styles.streak}>
              🔥 {currentStreak}-day streak{longestStreak > currentStreak && ` · best ${longestStreak}`}
            </p>
          )}
          <button className={`btn btn-primary ${styles.dailyButton}`} onClick={startDaily}>
            ⭐ Daily Puzzle
          </button>

          <div className={styles.rushRow}>
            <button className="btn" onClick={() => startRush('3')}>
              ⚡ Rush 3 min{rushBest['3'] > 0 && ` · best ${rushBest['3']}`}
            </button>
            <button className="btn" onClick={() => startRush('5')}>
              ⚡ Rush 5 min{rushBest['5'] > 0 && ` · best ${rushBest['5']}`}
            </button>
          </div>
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
                    <span className={styles.stageName}>{STAGE_THEME_LABEL[stage] ?? `Stage ${stage + 1}`}</span>
                    <span className={styles.stageCount}>
                      {reached} / {size} solved
                    </span>
                    <div className={styles.stageTrack}>
                      <div className={styles.stageFill} style={{ width: `${percent}%` }} />
                    </div>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <button className="btn" onClick={onExit}>
          ☰ Menu
        </button>
      </div>
    </div>
  );
}
