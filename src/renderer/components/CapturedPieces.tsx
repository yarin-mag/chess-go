import { useMemo } from 'react';
import type { Color, PieceType } from '@/core/types';
import { useGameStore } from '@/features/game/gameStore';
import { PIECE_VALUE } from '@/engine/evaluate';
import { pieceImage } from './pieceImages';
import styles from './CapturedPieces.module.css';

const materialOf = (types: PieceType[]) => types.reduce((sum, t) => sum + PIECE_VALUE[t], 0);

/** Pieces this color has captured (most valuable first), plus its material lead in pawns. */
export function CapturedPieces({ color }: { color: Color }) {
  const history = useGameStore((s) => s.history);

  const { mine, lead } = useMemo(() => {
    const capturedBy = (by: Color) => history.filter((m) => m.color === by && m.captured).map((m) => m.captured!);
    const mine = capturedBy(color).sort((a, b) => PIECE_VALUE[b] - PIECE_VALUE[a]);
    const theirs = capturedBy(color === 'w' ? 'b' : 'w');
    return { mine, lead: Math.round((materialOf(mine) - materialOf(theirs)) / 100) };
  }, [history, color]);

  const victim: Color = color === 'w' ? 'b' : 'w';
  return (
    <div className={styles.row}>
      {mine.map((type, i) => (
        <img key={i} src={pieceImage(victim, type)} alt={type} className={styles.piece} draggable={false} />
      ))}
      {lead > 0 && <span className={styles.lead}>+{lead}</span>}
    </div>
  );
}
