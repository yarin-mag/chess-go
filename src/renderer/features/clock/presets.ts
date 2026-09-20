import type { TimeControl } from '@/core/types';
import { Clock } from './clock';

export const UNTIMED: TimeControl = { name: 'Untimed', minutes: 0, incrementSec: 0 };

export const TIME_PRESETS: TimeControl[] = [
  UNTIMED,
  { name: 'Bullet 1+0', minutes: 1, incrementSec: 0 },
  { name: 'Blitz 3+2', minutes: 3, incrementSec: 2 },
  { name: 'Blitz 5+0', minutes: 5, incrementSec: 0 },
  { name: 'Rapid 10+0', minutes: 10, incrementSec: 0 },
  { name: 'Rapid 15+10', minutes: 15, incrementSec: 10 },
];

export const customTimeControl = (minutes: number, incrementSec: number): TimeControl => ({
  name: `Custom ${minutes}+${incrementSec}`,
  minutes,
  incrementSec,
});

export const toClock = (tc: TimeControl): Clock => new Clock(tc.minutes * 60_000, tc.incrementSec * 1_000);
