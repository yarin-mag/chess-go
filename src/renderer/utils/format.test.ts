import { describe, expect, it } from 'vitest';
import { formatTime } from './format';

describe('formatTime', () => {
  it('formats minutes and seconds', () => {
    expect(formatTime(65_000)).toBe('1:05');
    expect(formatTime(600_000)).toBe('10:00');
  });

  it('shows tenths under ten seconds', () => {
    expect(formatTime(7_300)).toBe('0:07.3');
    expect(formatTime(0)).toBe('0:00.0');
  });
});
