import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Color, Level, PlayerKind } from '@/core/types';
import { TIME_PRESETS, customTimeControl } from '@/features/clock/presets';
import { useGameStore } from '@/features/game/gameStore';
import { usePuzzleProgressStore } from '@/features/puzzle/puzzleProgressStore';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';
import { overallProgress } from '@/features/puzzle/puzzles';
import { useOpeningExplorerStore } from '@/features/openings/openingExplorerStore';
import { useWeaknessDashboardStore } from '@/features/history/weaknessDashboardStore';
import { useSavedGamesVisibilityStore } from '@/features/history/savedGamesVisibilityStore';
import { useOnlineLobbyStore } from '@/features/online/onlineLobbyVisibilityStore';
import { Segmented } from './ui/Segmented';
import styles from './NewGameMenu.module.css';

type Mode = 'local' | 'computer';
type Side = Color | 'random';

const CUSTOM = 'custom';
const HUMAN: PlayerKind = { type: 'human' };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value) || min));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <p className={styles.label}>{label}</p>
      {children}
    </div>
  );
}

export function NewGameMenu() {
  const { t } = useTranslation();
  const startGame = useGameStore((s) => s.startGame);
  const showPuzzleMap = usePuzzleStore((s) => s.showMap);
  const { furthestStage, furthestPuzzleIndex } = usePuzzleProgressStore();
  const puzzleProgress = overallProgress(furthestStage, furthestPuzzleIndex);
  const showOpeningExplorer = useOpeningExplorerStore((s) => s.show);
  const showWeaknessDashboard = useWeaknessDashboardStore((s) => s.show);
  const showSavedGames = useSavedGamesVisibilityStore((s) => s.show);
  const showOnlineLobby = useOnlineLobbyStore((s) => s.show);
  const [mode, setMode] = useState<Mode>('computer');
  const [level, setLevel] = useState<Level>('medium');
  const [side, setSide] = useState<Side>('w');
  const [preset, setPreset] = useState<string>('Blitz 5+0');
  const [customMinutes, setCustomMinutes] = useState(5);
  const [customIncrement, setCustomIncrement] = useState(0);

  const timeOptions = [...TIME_PRESETS.map((tc) => ({ value: tc.name, label: tc.name })), { value: CUSTOM, label: t('common:custom') }];

  const start = () => {
    const timeControl =
      preset === CUSTOM
        ? customTimeControl(clamp(customMinutes, 1, 180), clamp(customIncrement, 0, 60))
        : TIME_PRESETS.find((tc) => tc.name === preset)!;

    if (mode === 'local') {
      startGame({ white: HUMAN, black: HUMAN, timeControl });
      return;
    }
    const humanColor: Color = side === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : side;
    const engine: PlayerKind = { type: 'engine', level };
    startGame({
      white: humanColor === 'w' ? HUMAN : engine,
      black: humanColor === 'w' ? engine : HUMAN,
      timeControl,
    });
  };

  return (
    <div className={styles.screen}>
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <header className={styles.header}>
          <span className={styles.logo}>♞</span>
          <h1>{t('common:appTitle')}</h1>
          <p>{t('common:chooseMode')}</p>
        </header>

        <Field label={t('common:gameMode')}>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'computer', label: t('common:vsComputer') },
              { value: 'local', label: t('common:twoPlayers') },
            ]}
          />
        </Field>

        {mode === 'computer' && (
          <>
            <Field label={t('common:difficulty')}>
              <Segmented
                value={level}
                onChange={setLevel}
                options={[
                  { value: 'easy', label: t('common:easy') },
                  { value: 'medium', label: t('common:medium') },
                  { value: 'hard', label: t('common:hard') },
                ]}
              />
            </Field>
            <Field label={t('common:playAs')}>
              <Segmented
                value={side}
                onChange={setSide}
                options={[
                  { value: 'w', label: t('common:white') },
                  { value: 'b', label: t('common:black') },
                  { value: 'random', label: t('common:random') },
                ]}
              />
            </Field>
          </>
        )}

        <Field label={t('common:timeControl')}>
          <Segmented value={preset} onChange={setPreset} options={timeOptions} />
          {preset === CUSTOM && (
            <div className={styles.custom}>
              <label>
                {t('common:minutesPerSide')}
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(Number(e.target.value))}
                />
              </label>
              <label>
                {t('common:incrementSec')}
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={customIncrement}
                  onChange={(e) => setCustomIncrement(Number(e.target.value))}
                />
              </label>
            </div>
          )}
        </Field>

        <button className={`btn btn-primary ${styles.start}`} onClick={start} autoFocus>
          {t('common:startGame')}
        </button>

        <button className="btn" onClick={showPuzzleMap}>
          {t('common:puzzles')} {puzzleProgress > 0 && `· ${puzzleProgress}%`}
        </button>

        <button className="btn" onClick={showOpeningExplorer}>
          {t('common:openings')}
        </button>

        <button className="btn" onClick={showWeaknessDashboard}>
          {t('common:myStats')}
        </button>

        <button className="btn" onClick={showSavedGames}>
          {t('common:savedGames')}
        </button>

        <button className="btn" onClick={showOnlineLobby}>
          {t('common:playOnline')}
        </button>
      </motion.div>
    </div>
  );
}
