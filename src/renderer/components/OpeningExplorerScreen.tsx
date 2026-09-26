import { useState } from 'react';
import { replayUci } from '@/core/replay';
import type { Color, Level, PlayerKind } from '@/core/types';
import { UNTIMED } from '@/features/clock/presets';
import { useGameStore } from '@/features/game/gameStore';
import { CURATED_OPENINGS, type CuratedOpening } from '@/features/openings/curatedOpenings';
import { useOpeningExplorerStore } from '@/features/openings/openingExplorerStore';
import { useReviewStore } from '@/features/review/reviewStore';
import { Segmented } from './ui/Segmented';
import styles from './OpeningExplorerScreen.module.css';

const HUMAN: PlayerKind = { type: 'human' };

interface Props {
  onExit: () => void;
}

export function OpeningExplorerScreen({ onExit }: Props) {
  const startReview = useReviewStore((s) => s.start);
  const startGame = useGameStore((s) => s.startGame);
  const hideExplorer = useOpeningExplorerStore((s) => s.hide);
  const [side, setSide] = useState<Color>('w');
  const [level, setLevel] = useState<Level>('medium');

  const watch = (opening: CuratedOpening) => {
    const history = replayUci(undefined, opening.sequence);
    startReview({ white: HUMAN, black: HUMAN, timeControl: UNTIMED }, history, { recordStats: false });
    hideExplorer();
  };

  const practice = (opening: CuratedOpening) => {
    const history = replayUci(undefined, opening.sequence);
    const startFen = history.length > 0 ? history[history.length - 1].fen : undefined;
    const engine: PlayerKind = { type: 'engine', level };
    startGame({
      white: side === 'w' ? HUMAN : engine,
      black: side === 'w' ? engine : HUMAN,
      timeControl: UNTIMED,
      fen: startFen,
    });
    hideExplorer();
  };

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <header className={styles.header}>
          <h1>Opening Explorer</h1>
          <p>Watch how a named opening unfolds, move by move, with real engine commentary — or jump into practicing it yourself.</p>
        </header>

        <div className={styles.practiceSettings}>
          <div>
            <p className={styles.settingLabel}>Practice as</p>
            <Segmented
              value={side}
              onChange={setSide}
              options={[
                { value: 'w', label: 'White' },
                { value: 'b', label: 'Black' },
              ]}
            />
          </div>
          <div>
            <p className={styles.settingLabel}>Computer level</p>
            <Segmented
              value={level}
              onChange={setLevel}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' },
              ]}
            />
          </div>
        </div>

        <ol className={styles.list}>
          {CURATED_OPENINGS.map((opening) => (
            <li key={opening.name} className={styles.row}>
              <span className={styles.name}>
                <span className={styles.eco}>{opening.eco}</span> {opening.name}
              </span>
              <div className={styles.rowActions}>
                <button className="btn" onClick={() => watch(opening)}>
                  ▶ Watch
                </button>
                <button className="btn btn-primary" onClick={() => practice(opening)}>
                  ⚔ Practice
                </button>
              </div>
            </li>
          ))}
        </ol>

        <button className="btn" onClick={onExit}>
          ☰ Menu
        </button>
      </div>
    </div>
  );
}
