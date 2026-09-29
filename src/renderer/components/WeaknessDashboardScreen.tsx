import { useTranslation } from 'react-i18next';
import { useGameHistoryStore } from '@/features/history/gameHistoryStore';
import { biggestWeakness, phaseBreakdown, tagFrequency, tierCounts } from '@/features/history/weaknessStats';
import styles from './WeaknessDashboardScreen.module.css';

const MIN_GAMES_FOR_TAGS = 3;

interface Props {
  onExit: () => void;
}

export function WeaknessDashboardScreen({ onExit }: Props) {
  const { t } = useTranslation();
  const games = useGameHistoryStore((s) => s.games);
  const clearHistory = useGameHistoryStore((s) => s.clearHistory);

  if (games.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <h1>{t('stats:title')}</h1>
          <p>{t('stats:emptyBody')}</p>
          <button className="btn" onClick={onExit}>
            {t('common:menu')}
          </button>
        </div>
      </div>
    );
  }

  const tiers = tierCounts(games);
  const totalMoves = Object.values(tiers).reduce((a, b) => a + b, 0);
  const phases = phaseBreakdown(games);
  const tags = tagFrequency(games).slice(0, 5);
  const summary = biggestWeakness(games);

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1>{t('stats:title')}</h1>
          <p>{t('stats:gamesReviewed', { count: games.length, moves: totalMoves })}</p>
        </header>

        {summary && <p className={styles.insight}>💡 {summary}</p>}

        <section>
          <h2 className={styles.sectionTitle}>{t('stats:moveQuality')}</h2>
          <div className={styles.tierBars}>
            {(Object.keys(tiers) as (keyof typeof tiers)[]).map((tier) => (
              <div key={tier} className={styles.tierRow}>
                <span className={styles.tierName}>{t(`stats:tier_${tier}`)}</span>
                <div className={styles.barTrack}>
                  <div
                    className={`${styles.barFill} ${styles[tier]}`}
                    style={{ width: totalMoves > 0 ? `${(tiers[tier] / totalMoves) * 100}%` : '0%' }}
                  />
                </div>
                <span className={styles.tierCount}>{tiers[tier]}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>{t('stats:mistakeRateByPhase')}</h2>
          <div className={styles.tierBars}>
            {phases.map((p) => (
              <div key={p.phase} className={styles.tierRow}>
                <span className={styles.tierName}>{t(`stats:phase_${p.phase}`)}</span>
                <div className={styles.barTrack}>
                  <div className={`${styles.barFill} ${styles.blunder}`} style={{ width: `${p.mistakeRate * 100}%` }} />
                </div>
                <span className={styles.tierCount}>{p.totalMoves > 0 ? `${Math.round(p.mistakeRate * 100)}%` : '—'}</span>
              </div>
            ))}
          </div>
        </section>

        {games.length >= MIN_GAMES_FOR_TAGS && tags.length > 0 && (
          <section>
            <h2 className={styles.sectionTitle}>{t('stats:recurringMistakes')}</h2>
            <ul className={styles.tagList}>
              {tags.map((tagFreq) => (
                <li key={tagFreq.tag} className={styles.tagRow}>
                  <span>{t(`stats:tag_${tagFreq.tag}`)}</span>
                  <span className={styles.tagCount}>{tagFreq.count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className={styles.actions}>
          <button className="btn" onClick={clearHistory}>
            {t('stats:clearHistory')}
          </button>
          <button className="btn" onClick={onExit}>
            {t('common:menu')}
          </button>
        </div>
      </div>
    </div>
  );
}
