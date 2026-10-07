import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/features/game/gameStore';
import { useReviewStore } from '@/features/review/reviewStore';
import { MoveList } from './MoveList';
import { ReviewBoard } from './ReviewBoard';
import { Timeline } from './Timeline';
import { TutorPanel } from './TutorPanel';
import { Pill } from './ui/Pill';
import styles from './ReviewScreen.module.css';

export function ReviewScreen() {
  const { t } = useTranslation();
  const { index, history, analysis, next, prev, goTo, exit } = useReviewStore();
  const backToMenu = useGameStore((s) => s.backToMenu);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const leaveToMenu = () => {
    exit();
    backToMenu();
  };

  return (
    <div className={`round3 ${styles.screen}`}>
      <ReviewBoard flipped={flipped} />
      <aside className={styles.sidebar}>
        {/* Always visible, never requires scrolling to reach — on mobile, anything placed after the
            tutor panel / move list can end up below the fold until the player scrolls the whole page
            down, and "how do I leave review" is exactly the question that shouldn't need that. */}
        <div className={styles.actions}>
          <Pill variant="secondary" onClick={() => setFlipped((f) => !f)}>
            {t('common:flip')}
          </Pill>
          <Pill variant="secondary" onClick={leaveToMenu}>
            {t('common:menu')}
          </Pill>
        </div>
        <Timeline analysis={analysis} index={index} onChange={goTo} />
        <TutorPanel />
        <MoveList history={history} onSelectPly={goTo} activePly={index} />
      </aside>
    </div>
  );
}
