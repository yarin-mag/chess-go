import { useUser, useClerk } from '@clerk/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type Locale } from '@/features/settings/settingsStore';
import { BOARD_THEMES, DEFAULT_BOARD_THEMES } from '@/styles/themes';
import { Modal } from './ui/Modal';
import { SectionKicker } from './ui/SectionKicker';
import { Toggle } from './ui/Toggle';
import styles from './SettingsPanel.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

const LANGUAGES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'he', label: 'עברית' },
  { value: 'es', label: 'Español' },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <SectionKicker>{title}</SectionKicker>
      {children}
    </div>
  );
}

export function SettingsPanel({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { showLegalMoves, soundOn, autoFlip, boardTheme, locale, chatEmojisFromOpponent, quickPhrasesOnly, update } = useSettingsStore();
  const { isSignedIn, user } = useUser();
  const clerk = useClerk();
  // i18next's active language and the document's text direction sync from settingsStore.locale in
  // src/renderer/i18n/index.ts (a store subscription there), not here — that way it also applies at
  // boot, before this panel ever mounts.

  return (
    <Modal open={open} onClose={onClose}>
      <div className={styles.content}>
        <h2>{t('common:settingsTitle')}</h2>

        <Group title={t('nav:settingsBoard')}>
          <Toggle
            label={t('common:showLegalMoves')}
            description={t('common:showLegalMovesDesc')}
            checked={showLegalMoves}
            onChange={(v) => update({ showLegalMoves: v })}
          />
          <Toggle
            label={t('common:autoFlip')}
            description={t('common:autoFlipDesc')}
            checked={autoFlip}
            onChange={(v) => update({ autoFlip: v })}
          />
          <div className={styles.swatchRow}>
            <p className={styles.swatchLabel}>{t('common:boardTheme')}</p>
            <div className={styles.themes}>
              {DEFAULT_BOARD_THEMES.map((key) => {
                const th = BOARD_THEMES[key];
                return (
                  <button
                    key={key}
                    className={`${styles.swatch} ${key === boardTheme ? styles.selected : ''}`}
                    onClick={() => update({ boardTheme: key })}
                    aria-label={t('common:boardThemeAria', { theme: th.label })}
                    aria-pressed={key === boardTheme}
                  >
                    <span className={styles.preview} style={{ background: `linear-gradient(135deg, ${th.light} 50%, ${th.dark} 50%)` }} />
                    {th.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Group>

        <Group title={t('nav:settingsSound')}>
          <Toggle label={t('common:soundEffects')} checked={soundOn} onChange={(v) => update({ soundOn: v })} />
        </Group>

        <Group title={t('nav:settingsChat')}>
          <Toggle
            label={t('nav:settingsChatEmojis')}
            checked={chatEmojisFromOpponent}
            onChange={(v) => update({ chatEmojisFromOpponent: v })}
          />
          <Toggle
            label={t('nav:settingsQuickPhrasesOnly')}
            description={t('nav:settingsQuickPhrasesOnlyDesc')}
            checked={quickPhrasesOnly}
            onChange={(v) => update({ quickPhrasesOnly: v })}
          />
        </Group>

        <Group title={t('common:language')}>
          <div className={styles.themes}>
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                className={`${styles.swatch} ${l.value === locale ? styles.selected : ''}`}
                onClick={() => update({ locale: l.value })}
                aria-pressed={l.value === locale}
              >
                {l.label}
              </button>
            ))}
          </div>
        </Group>

        {isSignedIn && user && (
          <Group title={t('nav:settingsAccount')}>
            {user.primaryEmailAddress && <p className={styles.accountEmail}>{user.primaryEmailAddress.emailAddress}</p>}
            <button className={styles.signOut} onClick={() => void clerk.signOut()}>
              {t('nav:settingsSignOut')}
            </button>
          </Group>
        )}

        <button className="btn btn-primary" onClick={onClose}>
          {t('common:done')}
        </button>
      </div>
    </Modal>
  );
}
