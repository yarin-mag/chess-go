import type { Color } from '@/core/types';
import { describeResult, playerLabel } from '@/features/game/labels';
import type { GameConfig } from '@/features/game/gameStore';
import { useSavedGamesStore } from '@/features/history/savedGamesStore';
import { useReviewStore } from '@/features/review/reviewStore';
import styles from './SavedGamesScreen.module.css';

interface Props {
  onExit: () => void;
}

/** "Computer · Medium" when either side is the engine, otherwise a local two-player game. */
function opponentLabel(config: GameConfig): string {
  const engineColor: Color | null = config.white.type === 'engine' ? 'w' : config.black.type === 'engine' ? 'b' : null;
  return engineColor ? playerLabel(config, engineColor) : 'Local · 2 players';
}

export function SavedGamesScreen({ onExit }: Props) {
  const games = useSavedGamesStore((s) => s.games);
  const deleteGame = useSavedGamesStore((s) => s.deleteGame);
  const clearSaved = useSavedGamesStore((s) => s.clearSaved);
  const startReview = useReviewStore((s) => s.start);

  if (games.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <h1>Saved games</h1>
          <p>Finish a game and it will show up here, ready to open and step through again any time.</p>
          <button className="btn" onClick={onExit}>
            ☰ Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1>Saved games</h1>
          <p>
            {games.length} game{games.length === 1 ? '' : 's'} saved on this device
          </p>
        </header>

        <ul className={styles.list}>
          {games.map((g) => (
            <li key={g.id} className={styles.row}>
              <button
                className={styles.rowMain}
                onClick={() => startReview(g.config, g.history, { recordStats: false })}
              >
                <span className={styles.rowDate}>{new Date(g.playedAt).toLocaleString()}</span>
                <span className={styles.rowDetail}>
                  {describeResult(g.result).title} · {opponentLabel(g.config)} · {g.history.length} moves
                </span>
              </button>
              <button className={styles.rowDelete} onClick={() => deleteGame(g.id)} aria-label="Delete saved game">
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <button className="btn" onClick={clearSaved}>
            Clear all
          </button>
          <button className="btn" onClick={onExit}>
            ☰ Menu
          </button>
        </div>
      </div>
    </div>
  );
}
