import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Color, Level, PlayerKind } from '@/core/types';
import { TIME_PRESETS, customTimeControl } from '@/features/clock/presets';
import { useGameStore } from '@/features/game/gameStore';
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

interface Props {
  /** Called right after a game is started (e.g. to close the sheet this form was opened in). */
  onStarted?: () => void;
}

/** Just the "set up a game" form (mode, difficulty, side, time control, Start) — the other entry
 *  points this screen used to also hold (puzzles, openings, stats, saved games, online, glossary,
 *  settings) now live on their own Home/Learn/Friends/Me tabs; this is reused as the "Something
 *  else…" sheet opened from Home. */
export function NewGameMenu({ onStarted }: Props) {
  const { t } = useTranslation();
  const startGame = useGameStore((s) => s.startGame);
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
      onStarted?.();
      return;
    }
    const humanColor: Color = side === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : side;
    const engine: PlayerKind = { type: 'engine', level };
    startGame({
      white: humanColor === 'w' ? HUMAN : engine,
      black: humanColor === 'w' ? engine : HUMAN,
      timeControl,
    });
    onStarted?.();
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
      </motion.div>
    </div>
  );
}
