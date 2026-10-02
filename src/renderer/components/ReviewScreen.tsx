import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/features/game/gameStore';
import { useReviewStore } from '@/features/review/reviewStore';
import { MoveList } from './MoveList';
import { MoveScrubber } from './MoveScrubber';
import { ReviewBoard } from './ReviewBoard';
import { TutorPanel } from './TutorPanel';
import styles from './ReviewScreen.module.css';

export function ReviewScreen() {
  const { t } = useTranslation();
  const { index, history, next, prev, goTo, exit } = useReviewStore();
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
    <div className={styles.screen}>
      <ReviewBoard flipped={flipped} />
      <aside className={styles.sidebar}>
        <MoveScrubber index={index} max={history.length - 1} onChange={goTo} />
        <TutorPanel />
        <MoveList history={history} onSelectPly={goTo} activePly={index} />
        <div className={styles.actions}>
          <button className="btn" onClick={() => setFlipped((f) => !f)}>
            {t('common:flip')}
          </button>
          <button className="btn" onClick={leaveToMenu}>
            {t('common:menu')}
          </button>
        </div>
      </aside>
    </div>
  );
}
