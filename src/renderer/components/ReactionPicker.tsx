import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnlineStore } from '@/features/online/onlineStore';
import { emojiSceneForReaction, SCENE_REACTION_KEYS, type ReactionKey } from '@/features/online/protocol';
import { Emoji } from './ui/Emoji';
import styles from './ReactionPicker.module.css';

const COOLDOWN_MS = 1500;

/** The "favourites" row of one-tap emoji reactions shown during an online game (3b) — real illustrated
 *  Emoji scenes (see emojiScenes.ts), always visible, unlike the fuller phrase/emoji set in ChatSheet.
 *  Both send through the same onlineStore.sendReaction. */
export function ReactionPicker() {
  const { t } = useTranslation();
  const sendReaction = useOnlineStore((s) => s.sendReaction);
  const [cooling, setCooling] = useState(false); // blocks rapid re-sends from a fast double-tap

  const send = (key: ReactionKey) => {
    if (cooling) return;
    sendReaction(key);
    setCooling(true);
    setTimeout(() => setCooling(false), COOLDOWN_MS);
  };

  return (
    <div className={styles.row}>
      {SCENE_REACTION_KEYS.map((key) => (
        <button key={key} className={styles.tile} disabled={cooling} onClick={() => send(key)} aria-label={t(`online:reaction_${key}`)}>
          <Emoji kind={emojiSceneForReaction(key)!} size={40} />
        </button>
      ))}
    </div>
  );
}
