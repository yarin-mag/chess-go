import { colorName } from '@/features/game/labels';
import { phraseFor } from '@/engine/explain';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';
import { STAGE_COUNT, totalStagePuzzleCount } from '@/features/puzzle/puzzles';
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

interface Props {
  onExit: () => void;
}

export function PuzzleScreen({ onExit }: Props) {
  const { status, stage, puzzleIndex, puzzle, feedback, retry, next } = usePuzzleStore();
  const stageSize = totalStagePuzzleCount(stage);
  const solverColor = puzzle ? (puzzle.fen.split(' ')[1] as 'w' | 'b') : 'w';

  return (
    <div className={styles.screen}>
      <PuzzleBoard />
      <aside className={styles.sidebar}>
        <div className={styles.panel}>
          <p className={styles.stage}>
            Stage {stage + 1} of {STAGE_COUNT} · Puzzle {puzzleIndex + 1} of {stageSize}
          </p>
          <p className={styles.instruction}>Find the best move for {colorName(solverColor)}.</p>

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
                Next puzzle →
              </button>
            </div>
          )}
        </div>

        <button className="btn" onClick={onExit}>
          ☰ Menu
        </button>
      </aside>
    </div>
  );
}
