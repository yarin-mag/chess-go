import { useTranslation } from 'react-i18next';
import type { ExploredMove } from '@/features/review/exploreMove';
import tutorStyles from './TutorPanel.module.css';
import styles from './MoveExplorerPopover.module.css';

interface Props {
  move: ExploredMove | null;
  loading: boolean;
  onClose: () => void;
}

/** Shown when the player clicks a legal move (other than the one played) while reviewing a game. */
export function MoveExplorerPopover({ move, loading, onClose }: Props) {
  const { t } = useTranslation();
  if (!loading && !move) return null;

  return (
    <div className={styles.popover}>
      <button className={styles.close} onClick={onClose} aria-label={t('common:done')}>
        ✕
      </button>
      {loading || !move ? (
        <p className={styles.loading}>{t('tutor:analyzing', { done: 0, total: 1 })}</p>
      ) : (
        <>
          <div className={tutorStyles.header}>
            <strong>{move.san}</strong>
            <span className={`${tutorStyles.tier} ${tutorStyles[move.tier]}`}>{t(`stats:tier_${move.tier}`)}</span>
          </div>
          <p className={styles.phrase}>{move.phrase}</p>
          {move.reason && move.reason !== move.phrase && <p className={styles.reason}>{move.reason}</p>}
        </>
      )}
    </div>
  );
}
