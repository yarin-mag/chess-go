import { useState } from 'react';
import { phraseFor } from '@/engine/explain';
import { useGameStore } from '@/features/game/gameStore';
import { useGameEffects } from '@/hooks/useGameEffects';
import { Board } from './Board';
import { ClockPanel } from './ClockPanel';
import { ControlBar } from './ControlBar';
import { GameOverModal } from './GameOverModal';
import { MoveList } from './MoveList';
import { SettingsPanel } from './SettingsPanel';
import styles from './GameScreen.module.css';

/** Board on the left; clocks, move list and controls in the sidebar. */
export function GameScreen() {
  useGameEffects();
  const flipped = useGameStore((s) => s.flipped);
  const gameId = useGameStore((s) => s.gameId);
  const hint = useGameStore((s) => s.hint);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // The side facing the player sits at the bottom of the board.
  const bottom = flipped ? 'b' : 'w';
  const top = flipped ? 'w' : 'b';

  return (
    <div className={styles.screen}>
      <Board />
      <aside className={styles.sidebar}>
        <ClockPanel color={top} />
        <MoveList />
        {hint && (
          <p className={styles.hintText}>
            💡 <strong>{hint.san}</strong> — {hint.tags.map((tag, i) => phraseFor(tag, 'best', hint.san, i)).join(' ')}
          </p>
        )}
        <ClockPanel color={bottom} />
        <ControlBar onOpenSettings={() => setSettingsOpen(true)} />
      </aside>
      <GameOverModal key={gameId} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
