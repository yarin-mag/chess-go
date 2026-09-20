import { useEffect, useState } from 'react';
import type { Color } from '@/core/types';
import { useGameStore } from '@/features/game/gameStore';

const REFRESH_MS = 100;

/** Remaining milliseconds for one side, refreshed ten times a second. */
export function useClockTime(color: Color): number {
  const clock = useGameStore((s) => s.clock);
  const [ms, setMs] = useState(() => clock.remaining(color, Date.now()));

  useEffect(() => {
    const update = () => setMs(clock.remaining(color, Date.now()));
    update();
    const id = setInterval(update, REFRESH_MS);
    return () => clearInterval(id);
  }, [clock, color]);

  return ms;
}
