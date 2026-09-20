import { describe, it, expect } from 'vitest';
import { Clock } from './clock';

describe('Clock', () => {
  it('counts down only the active side', () => {
    const c = new Clock(60_000, 0);
    c.start('w', 0);
    expect(c.remaining('w', 10_000)).toBe(50_000);
    expect(c.remaining('b', 10_000)).toBe(60_000);
  });

  it('applies increment on press and switches side', () => {
    const c = new Clock(60_000, 2_000);
    c.start('w', 0);
    c.press('b', 5_000);
    expect(c.remaining('w', 5_000)).toBe(57_000);
    expect(c.remaining('b', 9_000)).toBe(56_000);
  });

  it('reports the flagged side when time hits zero', () => {
    const c = new Clock(1_000, 0);
    c.start('w', 0);
    expect(c.flagged(999)).toBeNull();
    expect(c.flagged(1_000)).toBe('w');
  });

  it('never flags when untimed', () => {
    const c = new Clock(0, 0);
    c.start('w', 0);
    expect(c.untimed).toBe(true);
    expect(c.flagged(1e9)).toBeNull();
  });

  it('stop freezes time', () => {
    const c = new Clock(60_000, 0);
    c.start('w', 0);
    c.stop(4_000);
    expect(c.remaining('w', 99_000)).toBe(56_000);
  });

  it('never reports negative time', () => {
    const c = new Clock(1_000, 0);
    c.start('b', 0);
    expect(c.remaining('b', 5_000)).toBe(0);
  });
});
