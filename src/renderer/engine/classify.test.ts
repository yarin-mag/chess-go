import { describe, expect, it } from 'vitest';
import { classify } from './classify';

describe('classify', () => {
  it('grades the best move as best, or brilliant when it sacrifices material', () => {
    expect(classify(0, true, false)).toBe('best');
    expect(classify(0, true, true)).toBe('brilliant');
  });

  it('grades by centipawn loss thresholds', () => {
    expect(classify(10, false, false)).toBe('good');
    expect(classify(49, false, false)).toBe('good');
    expect(classify(50, false, false)).toBe('inaccuracy');
    expect(classify(99, false, false)).toBe('inaccuracy');
    expect(classify(100, false, false)).toBe('mistake');
    expect(classify(299, false, false)).toBe('mistake');
    expect(classify(300, false, false)).toBe('blunder');
    expect(classify(1000, false, false)).toBe('blunder');
  });

  it('a non-best move is never brilliant even if it sacrifices material', () => {
    expect(classify(20, false, true)).toBe('good');
  });
});
