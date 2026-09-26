import { useEffect, useRef } from 'react';
import { playSound } from '@/audio/sounds';
import { usePuzzleStore } from '@/features/puzzle/puzzleStore';

/** Sound feedback for the puzzle trainer: a move click per ply, a buzz on a wrong attempt, a chime on solve. */
export function usePuzzleEffects(): void {
  const history = usePuzzleStore((s) => s.history);
  const status = usePuzzleStore((s) => s.status);

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
  }, [status]);
}
