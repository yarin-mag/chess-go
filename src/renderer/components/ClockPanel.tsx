import { useTranslation } from 'react-i18next';
import type { Color } from '@/core/types';
import { useGameStore } from '@/features/game/gameStore';
import { playerLabel } from '@/features/game/labels';
import { useClockTime } from '@/hooks/useClockTime';
import { formatTime } from '@/utils/format';
import { CapturedPieces } from './CapturedPieces';
import styles from './ClockPanel.module.css';

const LOW_TIME_MS = 10_000;

/** One player's card: name, captured material and clock. */
export function ClockPanel({ color }: { color: Color }) {
  const { t } = useTranslation();
  const config = useGameStore((s) => s.config);
  const untimed = useGameStore((s) => s.clock.untimed);
  const status = useGameStore((s) => s.status);
  const turn = useGameStore((s) => s.game.turn());
  const thinking = useGameStore((s) => s.engineThinking);
  const ms = useClockTime(color);

  const active = status === 'playing' && turn === color;
  const low = !untimed && ms < LOW_TIME_MS && status === 'playing';
  const cls = [styles.panel, active && styles.active, low && styles.low].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <div className={styles.info}>
        <span className={styles.name}>
          <span className={`${styles.dot} ${color === 'w' ? styles.white : styles.black}`} />
          {playerLabel(config, color)}
          {active && thinking && <span className={styles.thinking}>{t('game:thinking')}</span>}
        </span>
        <CapturedPieces color={color} />
      </div>
      <span className={styles.time}>{untimed ? '∞' : formatTime(ms)}</span>
    </div>
  );
}
