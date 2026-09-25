import { useReviewStore } from '@/features/review/reviewStore';
import { phraseFor } from '@/engine/explain';
import { EvalBar } from './EvalBar';
import styles from './TutorPanel.module.css';

const TIER_LABEL: Record<string, string> = {
  brilliant: 'Brilliant',
  best: 'Best move',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

export function TutorPanel() {
  const { analysis, index, status, progress, goTo, history } = useReviewStore();
  const current = index >= 0 ? analysis[index] : null;

  if (status === 'analyzing') {
    const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    return (
      <div className={styles.panel}>
        <div className={styles.analyzing}>
          <p className={styles.analyzingLabel}>
            Grading move {progress.done} of {progress.total}…
          </p>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${percent}%` }} />
          </div>
          <p className={styles.analyzingHint}>
            Comparing every move you played against the engine's own best move. The board already shows
            where the game ended — feel free to look around while this finishes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.moveNumber}>{index >= 0 ? `Move ${index + 1}` : 'Start position'}</span>
        {current && <span className={`${styles.tier} ${styles[current.tier]}`}>{TIER_LABEL[current.tier]}</span>}
      </div>

      <div className={styles.body}>
        <EvalBar scoreForWhite={current ? (current.move.color === 'w' ? current.playedScore : -current.playedScore) : 0} />
        <div className={styles.text}>
          {current?.opening && (
            <p className={styles.opening}>
              {current.opening.eco} · {current.opening.name}
            </p>
          )}
          {current ? (
            <p>{current.tags.map((tag, i) => phraseFor(tag, current.tier, current.move.san, current.ply + i)).join(' ')}</p>
          ) : (
            <p>Starting position. Swipe or use the arrow keys to step through the game.</p>
          )}
          {current && current.tier !== 'best' && current.tier !== 'brilliant' && (
            <p className={styles.suggestion}>Best was {current.bestSan}.</p>
          )}
        </div>
      </div>

      <div className={styles.nav}>
        <button className="btn" disabled={index <= -1} onClick={() => goTo(index - 1)}>
          ← Prev
        </button>
        <button className="btn" disabled={index >= history.length - 1} onClick={() => goTo(index + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}
