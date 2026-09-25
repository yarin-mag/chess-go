import { useEffect, useState } from 'react';
import { useGameStore } from '@/features/game/gameStore';
import { useReviewStore } from '@/features/review/reviewStore';
import { MoveList } from './MoveList';
import { ReviewBoard } from './ReviewBoard';
import { TutorPanel } from './TutorPanel';
import styles from './ReviewScreen.module.css';

export function ReviewScreen() {
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
        <TutorPanel />
        <MoveList history={history} onSelectPly={goTo} activePly={index} />
        <div className={styles.actions}>
          <button className="btn" onClick={() => setFlipped((f) => !f)}>
            ⇅ Flip
          </button>
          <button className="btn" onClick={leaveToMenu}>
            ☰ Menu
          </button>
        </div>
      </aside>
    </div>
  );
}
