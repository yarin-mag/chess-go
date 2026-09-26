import { describe, expect, it } from 'vitest';
import { nextStreak, todayString } from './streak';

describe('todayString', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(todayString(new Date(2026, 8, 26))).toBe('2026-09-26'); // month is 0-indexed
  });

  it('pads single-digit months and days', () => {
    expect(todayString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('nextStreak', () => {
  it('starts a streak of 1 on the very first solve', () => {
    expect(nextStreak(null, '2026-09-26', 0)).toBe(1);
  });

  it('does not double-count solving twice in the same day', () => {
    expect(nextStreak('2026-09-26', '2026-09-26', 3)).toBe(3);
  });

  it('extends the streak when solved the day right after', () => {
    expect(nextStreak('2026-09-25', '2026-09-26', 3)).toBe(4);
  });

  it('resets to 1 after a gap of more than one day', () => {
    expect(nextStreak('2026-09-20', '2026-09-26', 5)).toBe(1);
  });

  it('handles a month boundary as a genuine one-day gap', () => {
    expect(nextStreak('2026-08-31', '2026-09-01', 2)).toBe(3);
  });
});
