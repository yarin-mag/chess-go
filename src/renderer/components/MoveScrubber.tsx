import { useTranslation } from 'react-i18next';
import styles from './MoveScrubber.module.css';

interface Props {
  /** -1 means the start position, before any move — same range reviewStore's own `index` uses. */
  index: number;
  /** Highest valid index (history.length - 1). */
  max: number;
  onChange: (index: number) => void;
}

/**
 * One-drag jump to any ply in a long game — clicking a move in MoveList already jumps there, but
 * finding the right row by scrolling a 132px-tall list on a phone is slow for a 60+ move game.
 */
export function MoveScrubber({ index, max, onChange }: Props) {
  const { t } = useTranslation();
  if (max < 0) return null; // no moves played — nothing to scrub through

  return (
    <div className={styles.scrubber}>
      <input
        type="range"
        className={styles.input}
        min={-1}
        max={max}
        step={1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={t('game:scrubberLabel')}
        aria-valuetext={t('game:scrubberPosition', { current: index + 1, total: max + 1 })}
      />
      <span className={styles.position}>{t('game:scrubberPosition', { current: index + 1, total: max + 1 })}</span>
    </div>
  );
}
