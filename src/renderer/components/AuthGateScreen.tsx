import { SignIn, useAuth } from '@clerk/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/features/auth/authStore';
import styles from './AuthGateScreen.module.css';

/** Shown whenever decideGate() says 'showSignIn'. Once Clerk reports a signed-in session, fetches
 *  /me to get this account's server-side id and populate authStore — the one place that ever calls
 *  setSignedIn, so every other screen can trust useAuthStore.accountId is real. */
export function AuthGateScreen() {
  const { t } = useTranslation();
  const { isSignedIn, getToken } = useAuth();
  const setSignedIn = useAuthStore((s) => s.setSignedIn);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      const token = await getToken();
      const base = import.meta.env.VITE_API_BASE_URL as string;
      const res = await fetch(`${base}/me`, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok || cancelled) return;
      const { accountId, clerkUserId } = await res.json();
      setSignedIn(accountId, clerkUserId);
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getToken, setSignedIn]);

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1>{t('common:appTitle')}</h1>
        <SignIn routing="hash" />
      </div>
    </div>
  );
}
