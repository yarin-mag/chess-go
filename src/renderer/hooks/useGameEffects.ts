import { useEffect, useRef } from 'react';
import { playSound } from '@/audio/sounds';
import { useGameStore } from '@/features/game/gameStore';
import { useSettingsStore } from '@/features/settings/settingsStore';

const CLOCK_TICK_MS = 200;

/** Side effects that follow the game: clock flagging, move sounds and optional auto-flip. Mount once. */
export function useGameEffects(): void {
  const history = useGameStore((s) => s.history);
  const status = useGameStore((s) => s.status);
  const fen = useGameStore((s) => s.fen);
  const autoFlip = useSettingsStore((s) => s.autoFlip);

  // Flag a player whose time ran out.
  useEffect(() => {
    const id = setInterval(() => useGameStore.getState().tickClock(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Sound per move. The ref stops undo (shorter history) or a new game from beeping.
  const previousLength = useRef(0);
  useEffect(() => {
    const grew = history.length > previousLength.current;
    previousLength.current = history.length;
    if (!grew || status === 'over') return; // the game-over sound below covers the final move
    const last = history[history.length - 1];
    if (last.san.endsWith('+')) playSound('check');
    else playSound(last.captured ? 'capture' : 'move');
  }, [history, status]);

  useEffect(() => {
    if (status === 'over') playSound('end');
  }, [status]);

  // Local two-player: turn the board toward whoever moves next.
  useEffect(() => {
    const { status: s, config, game, setFlipped } = useGameStore.getState();
    const local = config.white.type === 'human' && config.black.type === 'human';
    if (autoFlip && local && s === 'playing') setFlipped(game.turn() === 'b');
  }, [autoFlip, fen]);
}
