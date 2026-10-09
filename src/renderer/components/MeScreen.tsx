import { useTranslation } from 'react-i18next';
import type { GameConfig } from '@/features/game/gameStore';
import { resultLetter } from '@/features/game/labels';
import { useSavedGamesStore, type SavedGame } from '@/features/history/savedGamesStore';
import { useSavedGamesVisibilityStore } from '@/features/history/savedGamesVisibilityStore';
import { useWeaknessDashboardStore } from '@/features/history/weaknessDashboardStore';
import { useSettingsPanelStore } from '@/features/settings/settingsPanelStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { useWalletStore } from '@/features/shop/walletStore';
import { BOARD_THEMES } from '@/styles/themes';
import { CoinBadge } from './ui/CoinBadge';
import { MiniBoard } from './ui/MiniBoard';
import { SectionKicker } from './ui/SectionKicker';
import styles from './MeScreen.module.css';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function opponentKey(config: GameConfig): string {
  if (config.remote) return 'meOpponentOnline';
  if (config.white.type === 'engine' || config.black.type === 'engine') return 'meOpponentComputer';
  return 'meOpponentLocal';
}

function RecentGameRow({ game }: { game: SavedGame }) {
  const { t } = useTranslation();
  const letter = resultLetter(game.config, game.result);
  return (
    <div className={styles.recentRow}>
      <span className={`${styles.recentLetter} ${styles[`letter${letter}`]}`}>{letter}</span>
      <span className={styles.recentOpponent}>{t(`nav:${opponentKey(game.config)}`)}</span>
      <span className={styles.recentMeta}>{t('nav:meMoveCount', { count: game.history.length })}</span>
    </div>
  );
}

/** Me tab: profile header, wallet + loadout (real now that Phase 3's walletStore/inventoryStore exist),
 *  recent games (from the existing saved-games log), and Settings. */
export function MeScreen() {
  const { t } = useTranslation();
  const showSettings = useSettingsPanelStore((s) => s.show);
  const games = useSavedGamesStore((s) => s.games);
  const coins = useWalletStore((s) => s.coins);
  const boardTheme = useSettingsStore((s) => s.boardTheme);
  const showWeakSpots = useWeaknessDashboardStore((s) => s.show);
  const showSavedGames = useSavedGamesVisibilityStore((s) => s.show);

  return (
    <div className={styles.screen}>
      <div className={styles.profileRow}>
        <span className={styles.avatar} aria-hidden>
          ♟
        </span>
        <div className={styles.profileInfo}>
          <span className={styles.name}>{t('nav:meDefaultName')}</span>
          <span className={styles.meta}>{t('nav:meGamesPlayed', { count: games.length })}</span>
        </div>
        <button className={styles.gearButton} aria-label={t('common:settingsTitle')} onClick={showSettings}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      <div className={styles.walletRow}>
        <CoinBadge amount={coins} size={28} />
      </div>

      <div className={styles.section}>
        <SectionKicker>{t('nav:meLoadout')}</SectionKicker>
        <div className={styles.loadoutRow}>
          <MiniBoard fen={START_FEN} size={132} />
          <div className={styles.loadoutInfo}>
            <span className={styles.loadoutSlot}>{t('nav:meLoadoutBoard')}</span>
            <span className={styles.loadoutItem}>{BOARD_THEMES[boardTheme].label}</span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.recentHeader}>
          <SectionKicker>{t('nav:meRecent')}</SectionKicker>
          {games.length > 0 && (
            <button className={styles.seeAll} onClick={showSavedGames}>
              {t('nav:meSeeAll')}
            </button>
          )}
        </div>
        {games.length === 0 ? (
          <p className={styles.empty}>{t('nav:meRecentEmpty')}</p>
        ) : (
          <div className={styles.recentList}>
            {games.slice(0, 10).map((g) => (
              <RecentGameRow key={g.id} game={g} />
            ))}
          </div>
        )}
      </div>

      <button className={styles.linkRow} onClick={showWeakSpots}>
        <span>{t('nav:meWeakSpots')}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
