import { useEffect, useMemo, useRef } from 'react';
import type { MoveRecord } from '@/core/types';
import { useGameStore } from '@/features/game/gameStore';
import styles from './MoveList.module.css';

interface Props {
  /** When provided, moves become clickable and jump the caller to that ply (used by the review screen). */
  onSelectPly?: (ply: number) => void;
  activePly?: number;
  /** Overrides the live game store's history (used by the review screen, which has its own snapshot). */
  history?: MoveRecord[];
}

/** Move history in SAN, two plies per row; scrolls to the latest move. */
export function MoveList({ onSelectPly, activePly, history: historyOverride }: Props = {}) {
  const liveHistory = useGameStore((s) => s.history);
  const history = historyOverride ?? liveHistory;
  const endRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const out: { number: number; white: string; black?: string }[] = [];
    for (let i = 0; i < history.length; i += 2) {
      out.push({ number: i / 2 + 1, white: history[i].san, black: history[i + 1]?.san });
    }
    return out;
  }, [history]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [history]);

  return (
    <div className={styles.list}>
      {rows.length === 0 && <p className={styles.empty}>Moves will appear here</p>}
      {rows.map((r) => {
        const whitePly = (r.number - 1) * 2;
        const blackPly = whitePly + 1;
        return (
          <div key={r.number} className={styles.row}>
            <span className={styles.number}>{r.number}.</span>
            <span
              className={`${styles.move} ${onSelectPly ? styles.clickable : ''} ${activePly === whitePly ? styles.active : ''}`}
              onClick={onSelectPly ? () => onSelectPly(whitePly) : undefined}
            >
              {r.white}
            </span>
            <span
              className={`${styles.move} ${onSelectPly && r.black ? styles.clickable : ''} ${activePly === blackPly ? styles.active : ''}`}
              onClick={onSelectPly && r.black ? () => onSelectPly(blackPly) : undefined}
            >
              {r.black}
            </span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
