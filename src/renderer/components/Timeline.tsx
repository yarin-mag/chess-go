import { useTranslation } from 'react-i18next';
import type { MoveAnalysis } from '@/features/review/analyzeGame';
import styles from './Timeline.module.css';

interface Props {
  analysis: MoveAnalysis[];
  /** -1 = start position, otherwise an index into `analysis` — reviewStore's own convention. */
  index: number;
  onChange: (index: number) => void;
}

/** One bar per played move, colored by its tier (3g) — a faster-to-scan, clickable alternative to
 *  scrolling the move list for a long game. Each bar is a real `<button>`, so it's keyboard-reachable
 *  via Tab the same as any other control (ReviewScreen's own arrow-key handler covers Prev/Next). */
export function Timeline({ analysis, index, onChange }: Props) {
  const { t } = useTranslation();
  if (analysis.length === 0) return null;

  return (
    <div className={styles.row} role="group" aria-label={t('tutor:timelineLabel')}>
      {analysis.map((a, i) => (
        <button
          key={a.ply}
          className={`${styles.bar} ${styles[a.tier]} ${i === index ? styles.current : ''}`}
          aria-label={t('tutor:moveNumber', { n: i + 1 })}
          aria-current={i === index}
          onClick={() => onChange(i)}
        />
      ))}
    </div>
  );
}
