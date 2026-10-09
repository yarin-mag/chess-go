import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '@/features/game/gameStore';
import { useNavStore, type NavTab } from '@/features/nav/navStore';
import { useSettingsPanelStore } from '@/features/settings/settingsPanelStore';
import styles from './TabBar.module.css';

const ICON_PROPS = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const ICONS: Record<NavTab, ReactNode> = {
  home: (
    <svg {...ICON_PROPS}>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  learn: (
    <svg {...ICON_PROPS}>
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </svg>
  ),
  friends: (
    <svg {...ICON_PROPS}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  shop: (
    <svg {...ICON_PROPS}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  me: (
    <svg {...ICON_PROPS}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
};

const TABS: NavTab[] = ['home', 'learn', 'friends', 'shop', 'me'];

const SETTINGS_ICON = (
  <svg {...ICON_PROPS}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

interface Props {
  /** Desktop-only nav rail with no bottom-bar fallback — used inside `GameScreen`, which hides the
   *  ordinary tab bar entirely on narrower widths (a game shouldn't lose screen space to it on a phone). */
  railOnly?: boolean;
}

/** Tab bar, data-driven from `TABS`/`ICONS` rather than one hardcoded `<div>` per tab. Below the desktop
 *  breakpoint it's the bottom bar (hidden by the caller — App.tsx — whenever a game, review or other
 *  full-screen overlay owns the screen); at desktop widths it becomes a left-edge icon rail instead (3y),
 *  which is why `GameScreen` can render it too even though the bottom bar never applied there. Clicking a
 *  tab while a game is in progress pauses it first (`backToMenu`, the same pause `ControlBar`'s own "Menu"
 *  action already uses) rather than abandoning it — `resumeGame` is how the player gets back to it. */
export function TabBar({ railOnly = false }: Props) {
  const { t, i18n } = useTranslation();
  const { tab, setTab } = useNavStore();
  const gameStatus = useGameStore((s) => s.status);
  const backToMenu = useGameStore((s) => s.backToMenu);
  const showSettings = useSettingsPanelStore((s) => s.show);

  const goTo = (key: NavTab) => {
    if (gameStatus !== 'menu') backToMenu();
    setTab(key);
  };

  return (
    <nav className={`${styles.bar} ${railOnly ? styles.railOnly : ''}`} dir={i18n.dir()}>
      {TABS.map((key) => {
        const active = key === tab;
        return (
          <button key={key} className={styles.item} aria-current={active ? 'page' : undefined} onClick={() => goTo(key)}>
            <span className={`${styles.topBar} ${active ? styles.topBarActive : ''}`} />
            <span className={`${styles.iconPill} ${active ? styles.iconPillActive : ''}`}>{ICONS[key]}</span>
            <span className={`${styles.label} ${active ? styles.labelActive : ''}`}>{t(`nav:tab_${key}`)}</span>
          </button>
        );
      })}
      <button className={styles.settingsItem} aria-label={t('common:settingsTitle')} onClick={showSettings}>
        {SETTINGS_ICON}
        <span className={styles.label}>{t('common:settings')}</span>
      </button>
    </nav>
  );
}
