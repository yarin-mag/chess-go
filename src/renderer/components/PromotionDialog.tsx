import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/features/game/gameStore';
import type { PromotionPiece } from '@/core/types';
import { pieceImage } from './pieceImages';
import styles from './PromotionDialog.module.css';

const CHOICES: PromotionPiece[] = ['q', 'r', 'b', 'n'];

/** Lets the player pick the piece a pawn promotes to. Click outside (or Esc) to cancel. */
export function PromotionDialog() {
  const pending = useGameStore((s) => s.pendingPromotion);
  const color = useGameStore((s) => s.game.turn());
  const choosePromotion = useGameStore((s) => s.choosePromotion);
  const cancelPromotion = useGameStore((s) => s.cancelPromotion);

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          className={styles.backdrop}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={cancelPromotion}
          onKeyDown={(e) => e.key === 'Escape' && cancelPromotion()}
          role="dialog"
          aria-label="Choose promotion piece"
        >
          <motion.div
            className={styles.card}
            initial={{ scale: 0.85, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {CHOICES.map((piece) => (
              <button key={piece} className={styles.choice} onClick={() => choosePromotion(piece)} autoFocus={piece === 'q'}>
                <img src={pieceImage(color, piece)} alt={piece} draggable={false} />
              </button>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
