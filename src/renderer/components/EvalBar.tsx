import styles from './EvalBar.module.css';

const CLAMP_CP = 800;

/** Vertical eval indicator: `scoreForWhite` in centipawns, positive favors White. */
export function EvalBar({ scoreForWhite }: { scoreForWhite: number }) {
  const clamped = Math.max(-CLAMP_CP, Math.min(CLAMP_CP, scoreForWhite));
  const whiteShare = 50 + (clamped / CLAMP_CP) * 50;
  return (
    <div className={styles.bar} title={`${(scoreForWhite / 100).toFixed(1)} for ${scoreForWhite >= 0 ? 'White' : 'Black'}`}>
      <div className={styles.white} style={{ height: `${whiteShare}%` }} />
    </div>
  );
}
