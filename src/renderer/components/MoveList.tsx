import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { MoveRecord } from '@/core/types';
import { useGameStore } from '@/features/game/gameStore';
import styles from './MoveList.module.css';

interface Props {
  /** When provided, moves become clickable and jump the caller to that ply (used by the review screen). */
  onSelectPly?: (ply: number) => void;
  activePly?: number;
  /** Overrides the live game store's history (used by the review screen, which has its own snapshot). */
  history?: MoveRecord[];
  /**
   * Controlled collapse state. Only the live game screen passes this — it turns the list into a toggle
   * header + list, collapsed by default so it never grows tall enough to cover the board. Left unset
   * (review/puzzle screens), the list is always fully shown with no header, as before.
   */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

/** "14. Qd2" for White's move, "14...Qd2" for Black's — the standard way to name a lone move. */
function lastMoveLabel(history: MoveRecord[], t: TFunction): string {
  if (history.length === 0) return t('game:noMovesYet');
  const ply = history.length - 1;
  const number = Math.floor(ply / 2) + 1;
  const san = history[ply].san;
  return ply % 2 === 0 ? t('game:movePairWhite', { number, san }) : t('game:movePairBlack', { number, san });
}

/** Move history in SAN, two plies per row; scrolls to the latest move. */
export function MoveList({ onSelectPly, activePly, history: historyOverride, collapsed, onToggleCollapsed }: Props = {}) {
  const { t } = useTranslation();
  const liveHistory = useGameStore((s) => s.history);
  const history = historyOverride ?? liveHistory;
  const listRef = useRef<HTMLDivElement>(null);
  const collapsible = collapsed !== undefined;
  const showList = !collapsible || !collapsed;

  const rows = useMemo(() => {
    const out: { number: number; white: string; black?: string }[] = [];
    for (let i = 0; i < history.length; i += 2) {
      out.push({ number: i / 2 + 1, white: history[i].san, black: history[i + 1]?.san });
    }
    return out;
  }, [history]);

  useEffect(() => {
    if (!showList) return;
    // Scroll only the list itself; scrollIntoView would also scroll the page in the stacked mobile layout.
    const el = listRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [history, showList]);

  const list = showList && (
    <div ref={listRef} className={styles.list}>
      {rows.length === 0 && <p className={styles.empty}>{t('game:movesEmpty')}</p>}
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
    </div>
  );

  if (!collapsible) return list || null;

  return (
    <div className={styles.wrap}>
      <button className={styles.toggle} onClick={onToggleCollapsed} aria-expanded={!collapsed}>
        <span>
          {t('game:movesLabel')}
          {history.length > 0 && ` (${history.length})`}
        </span>
        <span className={styles.toggleMove}>{lastMoveLabel(history, t)}</span>
        <span className={styles.chevron}>{collapsed ? '▾' : '▴'}</span>
      </button>
      {list}
    </div>
  );
}
