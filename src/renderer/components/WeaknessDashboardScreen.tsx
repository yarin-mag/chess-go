import { useGameHistoryStore } from '@/features/history/gameHistoryStore';
import { biggestWeakness, phaseBreakdown, tagFrequency, tierCounts, type GamePhase } from '@/features/history/weaknessStats';
import styles from './WeaknessDashboardScreen.module.css';

const TIER_LABEL: Record<string, string> = {
  brilliant: 'Brilliant',
  best: 'Best',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

const PHASE_LABEL: Record<GamePhase, string> = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' };

const TAG_LABEL: Record<string, string> = {
  hangsPiece: 'Hanging a piece',
  missedMate: 'Missing a forced mate',
  walksIntoMate: 'Walking into a forced mate',
  goodTrade: 'Good trades',
  developsPiece: 'Developing pieces',
  ignoresCenter: 'Ignoring the center',
  keepsAdvantage: 'Keeping an advantage',
  throwsAwayAdvantage: 'Throwing away an advantage',
  solid: 'Solid play',
};

const MIN_GAMES_FOR_TAGS = 3;

interface Props {
  onExit: () => void;
}

export function WeaknessDashboardScreen({ onExit }: Props) {
  const games = useGameHistoryStore((s) => s.games);
  const clearHistory = useGameHistoryStore((s) => s.clearHistory);

  if (games.length === 0) {
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <h1>My Stats</h1>
          <p>Play a game and review it (or the daily puzzle / a ladder puzzle) to start building your stats here.</p>
          <button className="btn" onClick={onExit}>
            ☰ Menu
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
          <h1>My Stats</h1>
          <p>
            {games.length} game{games.length === 1 ? '' : 's'} reviewed · {totalMoves} moves graded
          </p>
        </header>

        {summary && <p className={styles.insight}>💡 {summary}</p>}

        <section>
          <h2 className={styles.sectionTitle}>Move quality</h2>
          <div className={styles.tierBars}>
            {(Object.keys(tiers) as (keyof typeof tiers)[]).map((tier) => (
              <div key={tier} className={styles.tierRow}>
                <span className={styles.tierName}>{TIER_LABEL[tier]}</span>
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
          <h2 className={styles.sectionTitle}>Mistake rate by phase</h2>
          <div className={styles.tierBars}>
            {phases.map((p) => (
              <div key={p.phase} className={styles.tierRow}>
                <span className={styles.tierName}>{PHASE_LABEL[p.phase]}</span>
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
            <h2 className={styles.sectionTitle}>Recurring mistakes</h2>
            <ul className={styles.tagList}>
              {tags.map((t) => (
                <li key={t.tag} className={styles.tagRow}>
                  <span>{TAG_LABEL[t.tag] ?? t.tag}</span>
                  <span className={styles.tagCount}>{t.count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className={styles.actions}>
          <button className="btn" onClick={clearHistory}>
            Clear history
          </button>
          <button className="btn" onClick={onExit}>
            ☰ Menu
          </button>
        </div>
      </div>
    </div>
  );
}
