import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useReactionStore } from '@/features/online/reactionStore';
import styles from './ReactionBubble.module.css';

const DISPLAY_MS = 2500;

/** Transient bubble for the current reaction (yours or your opponent's). No log — just a pop and a fade. */
export function ReactionBubble() {
  const current = useReactionStore((s) => s.current);
  const clear = useReactionStore((s) => s.clear);

  useEffect(() => {
    if (!current) return;
    const id = setTimeout(clear, DISPLAY_MS);
    return () => clearTimeout(id);
  }, [current, clear]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.key}
          className={styles.bubble}
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        >
          {current.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
