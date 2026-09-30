import { useTranslation } from 'react-i18next';
import styles from './AuthGateScreen.module.css';

/** Shown for a previously-authenticated device that's signed out and offline — deliberately does
 *  NOT fall back to local-only play (see authGate.ts's 'offlineBlocked' case). */
export function OfflineBlockedScreen() {
  const { t } = useTranslation();
  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1>{t('common:appTitle')}</h1>
        <p>{t('auth:offlineBlocked')}</p>
      </div>
    </div>
  );
}
