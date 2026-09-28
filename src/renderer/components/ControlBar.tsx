import { useEffect, useState } from 'react';
import { opposite } from '@/core/types';
import { useGameStore } from '@/features/game/gameStore';
import { useOnlineStore } from '@/features/online/onlineStore';
import { useReviewStore } from '@/features/review/reviewStore';
import { ReactionPicker } from './ReactionPicker';
import styles from './ControlBar.module.css';

type Armed = 'resign' | 'draw' | null;
const CONFIRM_MS = 3000;

interface Props {
  onOpenSettings: () => void;
}

/** In-game actions. Destructive ones (resign / draw) need a second click to confirm. */
export function ControlBar({ onOpenSettings }: Props) {
  const { status, game, players, history, config, flipped, hintLoading, undo, setFlipped, resign, agreeDraw, requestHint, backToMenu } =
    useGameStore();
  const startReview = useReviewStore((s) => s.start);
  const onlineConnection = useOnlineStore((s) => s.connection);
  const incomingDrawOffer = useOnlineStore((s) => s.incomingDrawOffer);
  const clearDrawOffer = useOnlineStore((s) => s.clearDrawOffer);
  const [armed, setArmed] = useState<Armed>(null);

  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(null), CONFIRM_MS);
    return () => clearTimeout(id);
  }, [armed]);

  const playing = status === 'playing';
  const isOnline = players.w.kind === 'remote' || players.b.kind === 'remote';
  const vsComputer = !isOnline && (players.w.kind !== 'human' || players.b.kind !== 'human');
  const turn = game.turn();
  const canAskForHelp = playing && players[turn].kind === 'human';
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
      <button className="btn" disabled={!playing || history.length === 0 || isOnline} onClick={() => undo()}>
        ↶ Undo
      </button>
      <button className="btn" onClick={() => setFlipped(!flipped)}>
        ⇅ Flip
      </button>
      <button className="btn" disabled={!canAskForHelp || hintLoading} onClick={() => void requestHint()}>
        {hintLoading ? '…' : '💡 Get Help'}
      </button>
      <button className="btn" onClick={onOpenSettings}>
        ⚙ Settings
      </button>
      <button
        className={`btn btn-danger ${armed === 'resign' ? 'armed' : ''}`}
        disabled={!playing}
        onClick={confirm('resign', () => {
          resign(resigningColor);
          if (isOnline) onlineConnection?.send({ type: 'resign' });
        })}
      >
        {armed === 'resign' ? 'Sure?' : '⚑ Resign'}
      </button>
      {!vsComputer && !isOnline && (
        <button
          className={`btn btn-danger ${armed === 'draw' ? 'armed' : ''}`}
          disabled={!playing}
          onClick={confirm('draw', agreeDraw)}
        >
          {armed === 'draw' ? 'Agree?' : '½ Draw'}
        </button>
      )}
      {isOnline && !incomingDrawOffer && (
        <button
          className={`btn ${armed === 'draw' ? 'btn-danger armed' : ''}`}
          disabled={!playing}
          onClick={confirm('draw', () => onlineConnection?.send({ type: 'drawOffer' }))}
        >
          {armed === 'draw' ? 'Send offer?' : '🤝 Offer Draw'}
        </button>
      )}
      {isOnline && incomingDrawOffer && (
        <>
          <button
            className="btn btn-primary"
            onClick={() => {
              onlineConnection?.send({ type: 'drawResponse', accepted: true });
              clearDrawOffer();
              agreeDraw();
            }}
          >
            Accept draw
          </button>
          <button
            className="btn"
            onClick={() => {
              onlineConnection?.send({ type: 'drawResponse', accepted: false });
              clearDrawOffer();
            }}
          >
            Decline
          </button>
        </>
      )}
      {isOnline && <ReactionPicker />}
      {status === 'over' && (
        <button className="btn btn-primary" onClick={() => startReview(config, history)}>
          🎓 Review
        </button>
      )}
      <button className="btn" onClick={backToMenu}>
        ☰ Menu
      </button>
    </div>
  );
}
