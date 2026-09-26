import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Color, Level, PlayerKind } from '@/core/types';
import { TIME_PRESETS, customTimeControl } from '@/features/clock/presets';
import { useGameStore } from '@/features/game/gameStore';
import { usePuzzleProgressStore } from '@/features/puzzle/puzzleProgressStore';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';
import { overallProgress } from '@/features/puzzle/puzzles';
import { useOpeningExplorerStore } from '@/features/openings/openingExplorerStore';
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
  const startGame = useGameStore((s) => s.startGame);
  const showPuzzleMap = usePuzzleStore((s) => s.showMap);
  const { furthestStage, furthestPuzzleIndex } = usePuzzleProgressStore();
  const puzzleProgress = overallProgress(furthestStage, furthestPuzzleIndex);
  const showOpeningExplorer = useOpeningExplorerStore((s) => s.show);
  const [mode, setMode] = useState<Mode>('computer');
  const [level, setLevel] = useState<Level>('medium');
  const [side, setSide] = useState<Side>('w');
  const [preset, setPreset] = useState<string>('Blitz 5+0');
  const [customMinutes, setCustomMinutes] = useState(5);
  const [customIncrement, setCustomIncrement] = useState(0);

  const timeOptions = [...TIME_PRESETS.map((t) => ({ value: t.name, label: t.name })), { value: CUSTOM, label: 'Custom' }];

  const start = () => {
    const timeControl =
      preset === CUSTOM
        ? customTimeControl(clamp(customMinutes, 1, 180), clamp(customIncrement, 0, 60))
        : TIME_PRESETS.find((t) => t.name === preset)!;

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
          <h1>B-Chess</h1>
          <p>Choose how you want to play</p>
        </header>

        <Field label="Game mode">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'computer', label: 'vs Computer' },
              { value: 'local', label: '2 Players (same PC)' },
            ]}
          />
        </Field>

        {mode === 'computer' && (
          <>
            <Field label="Difficulty">
              <Segmented
                value={level}
                onChange={setLevel}
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
              />
            </Field>
            <Field label="Play as">
              <Segmented
                value={side}
                onChange={setSide}
                options={[
                  { value: 'w', label: 'White' },
                  { value: 'b', label: 'Black' },
                  { value: 'random', label: 'Random' },
                ]}
              />
            </Field>
          </>
        )}

        <Field label="Time control">
          <Segmented value={preset} onChange={setPreset} options={timeOptions} />
          {preset === CUSTOM && (
            <div className={styles.custom}>
              <label>
                Minutes per side
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(Number(e.target.value))}
                />
              </label>
              <label>
                Increment (sec)
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
          Start game
        </button>

        <button className="btn" onClick={showPuzzleMap}>
          🧩 Puzzles {puzzleProgress > 0 && `· ${puzzleProgress}%`}
        </button>

        <button className="btn" onClick={showOpeningExplorer}>
          📖 Openings
        </button>
      </motion.div>
    </div>
  );
}
