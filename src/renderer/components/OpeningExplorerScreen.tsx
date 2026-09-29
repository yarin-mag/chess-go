import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          <h1>{t('puzzles:openingExplorerTitle')}</h1>
          <p>{t('puzzles:openingExplorerSubtitle')}</p>
        </header>

        <div className={styles.practiceSettings}>
          <div>
            <p className={styles.settingLabel}>{t('puzzles:practiceAs')}</p>
            <Segmented
              value={side}
              onChange={setSide}
              options={[
                { value: 'w', label: t('common:white') },
                { value: 'b', label: t('common:black') },
              ]}
            />
          </div>
          <div>
            <p className={styles.settingLabel}>{t('puzzles:computerLevel')}</p>
            <Segmented
              value={level}
              onChange={setLevel}
              options={[
                { value: 'easy', label: t('common:easy') },
                { value: 'medium', label: t('common:medium') },
                { value: 'hard', label: t('common:hard') },
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
                  {t('puzzles:watch')}
                </button>
                <button className="btn btn-primary" onClick={() => practice(opening)}>
                  {t('puzzles:practice')}
                </button>
              </div>
            </li>
          ))}
        </ol>

        <button className="btn" onClick={onExit}>
          {t('common:menu')}
        </button>
      </div>
    </div>
  );
}
