import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { emojiSceneForReaction } from '@/features/online/protocol';
import { useReactionStore } from '@/features/online/reactionStore';
import { playReactionSound } from '@/audio/sounds';
import { Emoji } from './ui/Emoji';
import styles from './ReactionBubble.module.css';

const DISPLAY_MS = 2500;

/** Transient bubble for the current reaction (yours or your opponent's) — real Emoji art + a sound sting
 *  for the illustrated-pack reactions (see emojiSceneForReaction), plain text for the rest. No log — just
 *  a pop and a fade; ChatSheet's message log is the persistent record of reactions sent in a chat. */
export function ReactionBubble() {
  const current = useReactionStore((s) => s.current);
  const clear = useReactionStore((s) => s.clear);
  const scene = current?.reactionKey ? emojiSceneForReaction(current.reactionKey) : undefined;

  useEffect(() => {
    if (!current) return;
    const id = setTimeout(clear, DISPLAY_MS);
    return () => clearTimeout(id);
  }, [current, clear]);

  useEffect(() => {
    if (current && scene) playReactionSound(scene); // playReactionSound itself checks the sound setting
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per new `current`, not re-trigger on every render
  }, [current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.key}
          className={styles.bubble}
          initial={{ opacity: 0, y: 8, scale: 0.5, rotate: -8 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, y: -8, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        >
          {scene ? <Emoji kind={scene} size={72} /> : current.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
