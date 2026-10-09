import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Color } from '@/core/types';
import { playerLabel, resultLetter } from '@/features/game/labels';
import type { GameConfig } from '@/features/game/gameStore';
import { useSavedGamesStore, type SavedGame } from '@/features/history/savedGamesStore';
import { useReviewStore } from '@/features/review/reviewStore';
import { Pill } from './ui/Pill';
import { SegmentedTabs } from './ui/SegmentedTabs';
import styles from './SavedGamesScreen.module.css';

interface Props {
  onExit: () => void;
}

type Filter = 'all' | 'W' | 'L' | 'D';

/** "Computer · Medium" when either side is the engine, otherwise a local two-player game. */
function opponentLabel(config: GameConfig, t: TFunction): string {
  const engineColor: Color | null = config.white.type === 'engine' ? 'w' : config.black.type === 'engine' ? 'b' : null;
  return engineColor ? playerLabel(config, engineColor) : t('online:localTwoPlayers');
}

export function SavedGamesScreen({ onExit }: Props) {
  const { t } = useTranslation();
  const games = useSavedGamesStore((s) => s.games);
  const clearSaved = useSavedGamesStore((s) => s.clearSaved);
  const startReview = useReviewStore((s) => s.start);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(
    () => (filter === 'all' ? games : games.filter((g) => resultLetter(g.config, g.result) === filter)),
    [games, filter],
  );

  if (games.length === 0) {
    return (
      <div className={`round3 ${styles.screen}`}>
        <div className={styles.empty}>
          <h1 className={styles.title}>{t('online:savedGamesTitle')}</h1>
          <p className={styles.emptyBody}>{t('online:savedGamesEmpty')}</p>
          <Pill variant="secondary" onClick={onExit}>
            {t('common:menu')}
          </Pill>
        </div>
      </div>
    );
  }

  return (
    <div className={`round3 ${styles.screen}`}>
      <div className={styles.body}>
        <button className={styles.back} onClick={onExit}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {t('nav:tab_me')}
        </button>
        <h1 className={styles.title}>{t('online:savedGamesTitle')}</h1>
        <p className={styles.subtitle}>{t('online:savedGamesSubtitle', { count: games.length })}</p>

        <SegmentedTabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('online:savedGamesFilterAll') },
            { value: 'W', label: t('online:savedGamesFilterWins') },
            { value: 'L', label: t('online:savedGamesFilterLosses') },
            { value: 'D', label: t('online:savedGamesFilterDraws') },
          ]}
        />

        <ul className={styles.list}>
          {filtered.map((g: SavedGame) => {
            const letter = resultLetter(g.config, g.result);
            return (
              <li key={g.id} className={styles.row}>
                <button className={styles.rowMain} onClick={() => startReview(g.config, g.history, { recordStats: false, sourceGameId: g.id })}>
                  <span className={`${styles.rowLetter} ${styles[`letter${letter}`]}`}>{letter}</span>
                  <span className={styles.rowInfo}>
                    <span className={styles.rowOpponent}>{opponentLabel(g.config, t)}</span>
                    <span className={styles.rowMeta}>{t('online:savedGameMeta', { moves: g.history.length })}</span>
                  </span>
                  <span className={styles.rowDate}>{new Date(g.playedAt).toLocaleDateString()}</span>
                </button>
                <button className={styles.rowDelete} onClick={() => useSavedGamesStore.getState().deleteGame(g.id)} aria-label={t('online:deleteSavedGame')}>
                  ✕
                </button>
              </li>
            );
          })}
        </ul>

        <Pill variant="secondary" onClick={clearSaved}>
          {t('online:clearAll')}
        </Pill>
      </div>
    </div>
  );
}
