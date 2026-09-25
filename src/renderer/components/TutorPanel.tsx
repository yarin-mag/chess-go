import { useState } from 'react';
import { describeMove, describePotentialMove } from '@/core/describeMove';
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

/** A move name with a toggle that reveals its plain-English meaning ("The knight on b8 moves to c6."). */
function ExpandableMove({ label, san, detail }: { label: string; san: string; detail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.moveRow}>
      <p className={styles.moveLine}>
        {label} <strong>{san}</strong>
        <button className={styles.expandBtn} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Collapse ▲' : 'Expand ▾'}
        </button>
      </p>
      {open && <p className={styles.moveDetail}>{detail}</p>}
    </div>
  );
}

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
            <>
              <ExpandableMove key={`played-${current.ply}`} label="Played:" san={current.move.san} detail={describeMove(current.move)} />
              <p>{current.tags.map((tag, i) => phraseFor(tag, current.tier, current.move.san, current.ply + i)).join(' ')}</p>
              {current.tier !== 'best' && current.tier !== 'brilliant' && (
                <ExpandableMove
                  key={`best-${current.ply}`}
                  label="Best was"
                  san={current.bestSan}
                  detail={describePotentialMove(current.fenBefore, current.bestMove)}
                />
              )}
            </>
          ) : (
            <p>Starting position. Swipe or use the arrow keys to step through the game.</p>
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
