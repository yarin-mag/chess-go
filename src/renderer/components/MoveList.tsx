import { useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '@/features/game/gameStore';
import styles from './MoveList.module.css';

/** Move history in SAN, two plies per row; scrolls to the latest move. */
export function MoveList() {
  const history = useGameStore((s) => s.history);
  const endRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const out: { number: number; white: string; black?: string }[] = [];
    for (let i = 0; i < history.length; i += 2) {
      out.push({ number: i / 2 + 1, white: history[i].san, black: history[i + 1]?.san });
    }
    return out;
  }, [history]);

  useEffect(() => endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), [history]);

  return (
    <div className={styles.list}>
      {rows.length === 0 && <p className={styles.empty}>Moves will appear here</p>}
      {rows.map((r) => (
        <div key={r.number} className={styles.row}>
          <span className={styles.number}>{r.number}.</span>
          <span className={styles.move}>{r.white}</span>
          <span className={styles.move}>{r.black}</span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
