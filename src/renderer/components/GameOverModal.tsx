import { useState } from 'react';
import { useGameStore } from '@/features/game/gameStore';
import { describeResult } from '@/features/game/labels';
import { useReviewStore } from '@/features/review/reviewStore';
import { Modal } from './ui/Modal';
import styles from './GameOverModal.module.css';

/** Result announcement with rematch / new game / review options. Remount (via key) for each game. */
export function GameOverModal() {
  const { status, result, config, history, startGame, backToMenu } = useGameStore();
  const startReview = useReviewStore((s) => s.start);
  const [dismissed, setDismissed] = useState(false);
  const close = () => setDismissed(true);

  const summary = result ? describeResult(result) : null;

  return (
    <Modal open={status === 'over' && !dismissed} onClose={close}>
      {summary && (
        <div className={styles.content}>
          <h2 className={styles.title}>{summary.title}</h2>
          <p className={styles.detail}>{summary.detail}</p>
          <div className={styles.actions}>
            <button className="btn btn-primary" onClick={() => startGame(config)}>
              Rematch
            </button>
            <button className="btn" onClick={() => startReview(config, history)}>
              Review game
            </button>
            <button className="btn" onClick={backToMenu}>
              New game
            </button>
            <button className="btn" onClick={close}>
              View board
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
