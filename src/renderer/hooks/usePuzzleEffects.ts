import { useEffect, useRef } from 'react';
import { playSound } from '@/audio/sounds';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';

const RUSH_TICK_MS = 200;

/** Sound feedback for the puzzle trainer, and the Puzzle Rush countdown. Mount once, in PuzzleScreen. */
export function usePuzzleEffects(): void {
  const history = usePuzzleStore((s) => s.history);
  const status = usePuzzleStore((s) => s.status);
  const rushResult = usePuzzleStore((s) => s.rushResult);

  const previousLength = useRef(0);
  useEffect(() => {
    const grew = history.length > previousLength.current;
    previousLength.current = history.length;
    if (!grew) return;
    const last = history[history.length - 1];
    playSound(last.captured ? 'capture' : 'move');
  }, [history]);

  useEffect(() => {
    if (status === 'wrong') playSound('wrong');
    else if (status === 'solved') playSound('end');
    else if (status === 'rushOver') playSound(rushResult?.reason === 'wrong' ? 'wrong' : 'end');
  }, [status, rushResult]);

  useEffect(() => {
    const id = setInterval(() => usePuzzleStore.getState().tickRush(Date.now()), RUSH_TICK_MS);
    return () => clearInterval(id);
  }, []);
}
