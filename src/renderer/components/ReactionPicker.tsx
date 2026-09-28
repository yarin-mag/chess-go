import { useState } from 'react';
import { REACTIONS } from '@/features/online/protocol';
import { useOnlineStore } from '@/features/online/onlineStore';
import styles from './ReactionPicker.module.css';

const COOLDOWN_MS = 1500;

/** A small "React" button (shown only in online games) opening a popover of preset emoji/phrases. */
export function ReactionPicker() {
  const sendReaction = useOnlineStore((s) => s.sendReaction);
  const [open, setOpen] = useState(false);
  const [cooling, setCooling] = useState(false); // blocks rapid re-sends from a fast double-tap

  const send = (text: string) => {
    if (cooling) return;
    sendReaction(text);
    setOpen(false);
    setCooling(true);
    setTimeout(() => setCooling(false), COOLDOWN_MS);
  };

  return (
    <div className={styles.wrap}>
      <button className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        😊 React
      </button>
      {open && (
        <div className={styles.popover}>
          {REACTIONS.map((r) => (
            <button key={r} className={styles.item} disabled={cooling} onClick={() => send(r)}>
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
