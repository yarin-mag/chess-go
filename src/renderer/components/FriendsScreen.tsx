import { useTranslation } from 'react-i18next';
import { OnlineLobbyScreen } from './OnlineLobbyScreen';
import styles from './FriendsScreen.module.css';

/** Friends tab: the design handoff specs this tab's presence in the nav bar but not its content (no
 *  social/friends-list feature exists anywhere in this app yet). Placeholder for now: reuses the
 *  existing "play online by room code" flow, the closest existing feature, rather than inventing a
 *  social feature unasked. Needs its own design pass before this is more than a placeholder. */
export function FriendsScreen() {
  const { t } = useTranslation();
  return (
    <div className={styles.screen}>
      <p className={styles.note}>{t('nav:friendsPlaceholder')}</p>
      <OnlineLobbyScreen />
    </div>
  );
}
