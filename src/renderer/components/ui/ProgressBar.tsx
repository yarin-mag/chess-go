import styles from './ProgressBar.module.css';

interface Props {
  size: number;
  current: number;
  /** Tints the current segment to flag a wrong answer instead of normal progress. */
  variant?: 'default' | 'wrong';
}

/** Thin segmented progress bar — done/current/locked — shared by any screen that steps through a fixed
 *  sequence (puzzle ladder position, opening-quiz move number, …), so the look stays identical instead
 *  of each screen reimplementing its own three-state bar. */
export function ProgressBar({ size, current, variant = 'default' }: Props) {
  if (size <= 0) return null;
  return (
    <div className={styles.bar}>
      {Array.from({ length: size }, (_, i) => (
        <span
          key={i}
          className={[
            styles.seg,
            i < current ? styles.done : i === current ? (variant === 'wrong' ? styles.currentWrong : styles.current) : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </div>
  );
}
