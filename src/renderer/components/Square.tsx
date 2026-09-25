import { memo } from 'react';
import type { Square as SquareName } from '@/core/types';
import styles from './Square.module.css';

interface Props {
  square: SquareName;
  light: boolean;
  selected: boolean;
  lastMove: boolean;
  check: boolean;
  fileLabel?: string;
  rankLabel?: string;
  onClick?: (square: SquareName) => void;
}

const cx = (...classes: (string | false)[]) => classes.filter(Boolean).join(' ');

export const Square = memo(function Square(p: Props) {
  return (
    <div
      className={cx(
        styles.square,
        p.light ? styles.light : styles.dark,
        p.lastMove && styles.lastMove,
        p.selected && styles.selected,
        p.check && styles.check,
      )}
      onClick={() => p.onClick?.(p.square)}
      data-square={p.square}
    >
      {p.rankLabel && <span className={cx(styles.label, styles.rank)}>{p.rankLabel}</span>}
      {p.fileLabel && <span className={cx(styles.label, styles.file)}>{p.fileLabel}</span>}
    </div>
  );
});
