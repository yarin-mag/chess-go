import { useEffect, useState } from 'react';
import { opposite } from '@/core/types';
import { useGameStore } from '@/features/game/gameStore';
import styles from './ControlBar.module.css';

type Armed = 'resign' | 'draw' | null;
const CONFIRM_MS = 3000;

interface Props {
  onOpenSettings: () => void;
}

/** In-game actions. Destructive ones (resign / draw) need a second click to confirm. */
export function ControlBar({ onOpenSettings }: Props) {
  const { status, game, players, history, flipped, undo, setFlipped, resign, agreeDraw, backToMenu } = useGameStore();
  const [armed, setArmed] = useState<Armed>(null);

  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(null), CONFIRM_MS);
    return () => clearTimeout(id);
  }, [armed]);

  const playing = status === 'playing';
  const vsComputer = players.w.kind !== 'human' || players.b.kind !== 'human';
  const turn = game.turn();
  // The human resigns, never the computer.
  const resigningColor = players[turn].kind === 'human' ? turn : opposite(turn);

  const confirm = (action: Exclude<Armed, null>, run: () => void) => () => {
    if (armed === action) {
      setArmed(null);
      run();
    } else setArmed(action);
  };

  return (
    <div className={styles.bar}>
      <button className="btn" disabled={!playing || history.length === 0} onClick={() => undo()}>
        ↶ Undo
      </button>
      <button className="btn" onClick={() => setFlipped(!flipped)}>
        ⇅ Flip
      </button>
      <button className="btn" onClick={onOpenSettings}>
        ⚙ Settings
      </button>
      <button
        className={`btn btn-danger ${armed === 'resign' ? 'armed' : ''}`}
        disabled={!playing}
        onClick={confirm('resign', () => resign(resigningColor))}
      >
        {armed === 'resign' ? 'Sure?' : '⚑ Resign'}
      </button>
      {!vsComputer && (
        <button
          className={`btn btn-danger ${armed === 'draw' ? 'armed' : ''}`}
          disabled={!playing}
          onClick={confirm('draw', agreeDraw)}
        >
          {armed === 'draw' ? 'Agree?' : '½ Draw'}
        </button>
      )}
      <button className="btn" onClick={backToMenu}>
        ☰ Menu
      </button>
    </div>
  );
}
