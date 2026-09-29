import { useTranslation } from 'react-i18next';
import { useSettingsStore, type BoardTheme, type Locale } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { Modal } from './ui/Modal';
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

export function SettingsPanel({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { showLegalMoves, soundOn, autoFlip, boardTheme, locale, update } = useSettingsStore();
  // i18next's active language and the document's text direction sync from settingsStore.locale in
  // src/renderer/i18n/index.ts (a store subscription there), not here — that way it also applies at
  // boot, before this panel ever mounts.

  return (
    <Modal open={open} onClose={onClose}>
      <div className={styles.content}>
        <h2>{t('common:settingsTitle')}</h2>
        <Toggle
          label={t('common:showLegalMoves')}
          description={t('common:showLegalMovesDesc')}
          checked={showLegalMoves}
          onChange={(v) => update({ showLegalMoves: v })}
        />
        <Toggle label={t('common:soundEffects')} checked={soundOn} onChange={(v) => update({ soundOn: v })} />
        <Toggle
          label={t('common:autoFlip')}
          description={t('common:autoFlipDesc')}
          checked={autoFlip}
          onChange={(v) => update({ autoFlip: v })}
        />
        <div>
          <p className={styles.heading}>{t('common:boardTheme')}</p>
          <div className={styles.themes}>
            {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((key) => {
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
        <div>
          <p className={styles.heading}>{t('common:language')}</p>
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
        </div>
        <button className="btn btn-primary" onClick={onClose}>
          {t('common:done')}
        </button>
      </div>
    </Modal>
  );
}
