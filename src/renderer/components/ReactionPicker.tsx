import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REACTION_KEYS, type ReactionKey } from '@/features/online/protocol';
import { useOnlineStore } from '@/features/online/onlineStore';
import styles from './ReactionPicker.module.css';

const COOLDOWN_MS = 1500;

/** A small "React" button (shown only in online games) opening a popover of preset emoji/phrases. */
export function ReactionPicker() {
  const { t } = useTranslation();
  const sendReaction = useOnlineStore((s) => s.sendReaction);
  const [open, setOpen] = useState(false);
  const [cooling, setCooling] = useState(false); // blocks rapid re-sends from a fast double-tap

  const send = (key: ReactionKey) => {
    if (cooling) return;
    sendReaction(key);
    setOpen(false);
    setCooling(true);
    setTimeout(() => setCooling(false), COOLDOWN_MS);
  };

  return (
    <div className={styles.wrap}>
      <button className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {t('online:reactBtn')}
      </button>
      {open && (
        <div className={styles.popover}>
          {REACTION_KEYS.map((key) => (
            <button key={key} className={styles.item} disabled={cooling} onClick={() => send(key)}>
              {t(`online:reaction_${key}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
