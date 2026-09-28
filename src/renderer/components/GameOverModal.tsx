import { useState } from 'react';
import { isOnlineGame, useGameStore } from '@/features/game/gameStore';
import { describeResult } from '@/features/game/labels';
import { useOnlineStore } from '@/features/online/onlineStore';
import { useReviewStore } from '@/features/review/reviewStore';
import { Modal } from './ui/Modal';
import styles from './GameOverModal.module.css';

/** Result announcement with rematch / new game / review options. Remount (via key) for each game. */
export function GameOverModal() {
  const { status, result, config, history, players, startGame, backToMenu } = useGameStore();
  const startReview = useReviewStore((s) => s.start);
  const [dismissed, setDismissed] = useState(false);
  const close = () => setDismissed(true);
  // Rematch just re-runs startGame with the same config, which for an online game still carries the old
  // remote seat — restarting the board on this side only, with no message to the opponent and no new
  // color flip. There's no rematch message in the protocol, so simply not offering it here is the fix.
  const online = isOnlineGame(players);

  const summary = result ? describeResult(result) : null;

  return (
    <Modal open={status === 'over' && !dismissed} onClose={close}>
      {summary && (
        <div className={styles.content}>
          <h2 className={styles.title}>{summary.title}</h2>
          <p className={styles.detail}>{summary.detail}</p>
          <div className={styles.actions}>
            {!online && (
              <button className="btn btn-primary" onClick={() => startGame(config)}>
                Rematch
              </button>
            )}
            <button className="btn" onClick={() => startReview(config, history)}>
              Review game
            </button>
            <button
              className="btn"
              onClick={() => {
                // See ControlBar's "☰ Menu" for why this always runs, not just when online.
                useOnlineStore.getState().leave();
                backToMenu();
              }}
            >
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
