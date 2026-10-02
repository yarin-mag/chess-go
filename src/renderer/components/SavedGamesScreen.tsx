import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
function opponentLabel(config: GameConfig, t: TFunction): string {
  const engineColor: Color | null = config.white.type === 'engine' ? 'w' : config.black.type === 'engine' ? 'b' : null;
  return engineColor ? playerLabel(config, engineColor) : t('online:localTwoPlayers');
}

export function SavedGamesScreen({ onExit }: Props) {
  const { t } = useTranslation();
  const games = useSavedGamesStore((s) => s.games);
  const deleteGame = useSavedGamesStore((s) => s.deleteGame);
  const clearSaved = useSavedGamesStore((s) => s.clearSaved);
  const startReview = useReviewStore((s) => s.start);

  if (games.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <h1>{t('online:savedGamesTitle')}</h1>
          <p>{t('online:savedGamesEmpty')}</p>
          <button className="btn" onClick={onExit}>
            {t('common:menu')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1>{t('online:savedGamesTitle')}</h1>
          <p>{t('online:savedGamesCount', { count: games.length })}</p>
        </header>

        <ul className={styles.list}>
          {games.map((g) => (
            <li key={g.id} className={styles.row}>
              <button
                className={styles.rowMain}
                onClick={() => startReview(g.config, g.history, { recordStats: false, sourceGameId: g.id })}
              >
                <span className={styles.rowDate}>{new Date(g.playedAt).toLocaleString()}</span>
                <span className={styles.rowDetail}>
                  {t('online:savedGameRow', {
                    result: describeResult(g.result).title,
                    opponent: opponentLabel(g.config, t),
                    moves: g.history.length,
                  })}
                </span>
              </button>
              <button className={styles.rowDelete} onClick={() => deleteGame(g.id)} aria-label={t('online:deleteSavedGame')}>
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <button className="btn" onClick={clearSaved}>
            {t('online:clearAll')}
          </button>
          <button className="btn" onClick={onExit}>
            {t('common:menu')}
          </button>
        </div>
      </div>
    </div>
  );
}
