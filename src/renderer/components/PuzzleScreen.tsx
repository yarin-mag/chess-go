import { colorName } from '@/features/game/labels';
import { phraseFor } from '@/engine/explain';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';
import { STAGE_COUNT, totalStagePuzzleCount } from '@/features/puzzle/puzzles';
import { usePuzzleEffects } from '@/hooks/usePuzzleEffects';
import { PuzzleBoard } from './PuzzleBoard';
import styles from './PuzzleScreen.module.css';

const TIER_LABEL: Record<string, string> = {
  brilliant: 'Brilliant',
  best: 'Best move',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

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
            {mode === 'daily' && '⭐ Daily Puzzle'}
            {mode === 'ladder' && `Stage ${stage + 1} of ${STAGE_COUNT} · Puzzle ${puzzleIndex + 1} of ${stageSize}`}
            {mode === 'rush' && status !== 'rushOver' && (
              <span className={styles.rushBar}>
                <span>⚡ {formatRushTime(rushRemainingMs)}</span>
                <span>{rushSolvedCount} solved</span>
              </span>
            )}
          </p>
          {status !== 'rushOver' && (
            <p className={styles.instruction}>Find the best move for {colorName(solverColor)}.</p>
          )}

          {status === 'playing' && mode !== 'rush' && (
            <div className={styles.hintRow}>
              {hint ? (
                <p className={styles.hintText}>💡 {hint.text}</p>
              ) : (
                <button className="btn" onClick={showHint}>
                  💡 Ask for help
                </button>
              )}
            </div>
          )}

          {status === 'wrong' && feedback && (
            <div className={styles.feedback}>
              <span className={`${styles.tier} ${styles[feedback.tier]}`}>{TIER_LABEL[feedback.tier]}</span>
              <p>{feedback.tags.map((tag, i) => phraseFor(tag, feedback.tier, feedback.move.san, i)).join(' ')}</p>
              <button className="btn btn-primary" onClick={retry}>
                Try again
              </button>
            </div>
          )}

          {status === 'solved' && (
            <div className={styles.feedback}>
              <p className={styles.solved}>Solved!</p>
              <button className="btn btn-primary" onClick={next}>
                {mode === 'daily' ? 'Back to map →' : 'Next puzzle →'}
              </button>
            </div>
          )}

          {status === 'rushOver' && rushResult && (
            <div className={styles.feedback}>
              <p className={styles.solved}>{rushResult.reason === 'timeUp' ? "Time's up!" : 'Run over'}</p>
              {feedback && rushResult.reason === 'wrong' && (
                <p>{feedback.tags.map((tag, i) => phraseFor(tag, feedback.tier, feedback.move.san, i)).join(' ')}</p>
              )}
              <p className={styles.rushScore}>
                {rushResult.score} solved{rushResult.isNewBest && ' — New best!'}
              </p>
              <div className={styles.actions}>
                <button className="btn btn-primary" onClick={() => startRush(usePuzzleStore.getState().rushDuration!)}>
                  Play again
                </button>
                <button className="btn" onClick={showMap}>
                  Back to map
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button className="btn" onClick={showMap}>
            🗺 Map
          </button>
          <button className="btn" onClick={onExit}>
            ☰ Menu
          </button>
        </div>
      </aside>
    </div>
  );
}
