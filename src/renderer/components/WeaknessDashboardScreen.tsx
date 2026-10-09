import { useTranslation } from 'react-i18next';
import { useBlunderVaultStore } from '@/features/vault/blunderVaultStore';
import { useGameHistoryStore } from '@/features/history/gameHistoryStore';
import { biggestWeakness, phaseBreakdown, tagFrequency } from '@/features/history/weaknessStats';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';
import { CoachBubble } from './ui/CoachBubble';
import { Pill } from './ui/Pill';
import { SectionKicker } from './ui/SectionKicker';
import styles from './WeaknessDashboardScreen.module.css';

const MIN_GAMES_FOR_TAGS = 3;

interface Props {
  onExit: () => void;
}

export function WeaknessDashboardScreen({ onExit }: Props) {
  const { t } = useTranslation();
  const games = useGameHistoryStore((s) => s.games);
  const clearHistory = useGameHistoryStore((s) => s.clearHistory);
  const vaultCount = useBlunderVaultStore((s) => s.entries.length);
  const startVault = usePuzzleStore((s) => s.startVault);

  if (games.length === 0) {
    return (
      <div className={`round3 ${styles.screen}`}>
        <div className={styles.empty}>
          <h1 className={styles.title}>{t('nav:meWeakSpots')}</h1>
          <p className={styles.emptyBody}>{t('stats:emptyBody')}</p>
          <Pill variant="secondary" onClick={onExit}>
            {t('common:menu')}
          </Pill>
        </div>
      </div>
    );
  }

  const phases = phaseBreakdown(games);
  const maxPhaseRate = Math.max(...phases.map((p) => p.mistakeRate), 0.01);
  const tags = tagFrequency(games).slice(0, 5);
  const maxTagCount = Math.max(...tags.map((tg) => tg.count), 1);
  const insight = biggestWeakness(games);

  return (
    <div className={`round3 ${styles.screen}`}>
      <div className={styles.body}>
        <button className={styles.back} onClick={onExit}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {t('nav:tab_me')}
        </button>
        <h1 className={styles.title}>{t('nav:meWeakSpots')}</h1>
        <p className={styles.subtitle}>{t('stats:gamesReviewed', { count: games.length, moves: phases.reduce((sum, p) => sum + p.totalMoves, 0) })}</p>

        {insight && <CoachBubble>{insight}</CoachBubble>}

        {vaultCount > 0 && (
          <Pill
            variant="primary"
            className={styles.practiseButton}
            onClick={() => {
              startVault();
              onExit();
            }}
          >
            {t('nav:practiseBlunders', { count: vaultCount })}
          </Pill>
        )}

        <div className={styles.section}>
          <SectionKicker>{t('stats:mistakeRateByPhase')}</SectionKicker>
          <div className={styles.phaseGrid}>
            {phases.map((p) => (
              <div key={p.phase} className={styles.phaseCol}>
                <span className={styles.phaseLabel}>{t(`stats:phase_${p.phase}`)}</span>
                <span className={styles.phasePct}>{p.totalMoves > 0 ? `${Math.round(p.mistakeRate * 100)}%` : '—'}</span>
                <div className={styles.track}>
                  <div className={styles.trackFill} style={{ width: `${(p.mistakeRate / maxPhaseRate) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {games.length >= MIN_GAMES_FOR_TAGS && tags.length > 0 && (
          <div className={styles.section}>
            <SectionKicker>{t('stats:recurringMistakes')}</SectionKicker>
            <div className={styles.tagList}>
              {tags.map((tg) => (
                <div key={tg.tag} className={styles.tagRow}>
                  <div className={styles.tagInfo}>
                    <span className={styles.tagName}>{t(`stats:tag_${tg.tag}`)}</span>
                    <div className={styles.track}>
                      <div className={styles.trackFill} style={{ width: `${(tg.count / maxTagCount) * 100}%` }} />
                    </div>
                  </div>
                  <span className={styles.tagCount}>{tg.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Pill variant="secondary" onClick={clearHistory}>
          {t('stats:clearHistory')}
        </Pill>
      </div>
    </div>
  );
}
