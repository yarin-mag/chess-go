import { describe, expect, it } from 'vitest';
import { replayMoves, replayUci } from './replay';

describe('replayMoves', () => {
  it('replays a sequence into a full move history', () => {
    const history = replayMoves(undefined, [
      { from: 'e2', to: 'e4' },
      { from: 'e7', to: 'e5' },
    ]);
    expect(history).toHaveLength(2);
    expect(history[0].san).toBe('e4');
    expect(history[1].san).toBe('e5');
  });

  it('stops early on an illegal move rather than throwing', () => {
    const history = replayMoves(undefined, [
      { from: 'e2', to: 'e4' },
      { from: 'a1', to: 'a8' }, // rook boxed in behind its own pawn — illegal
      { from: 'e7', to: 'e5' },
    ]);
    expect(history).toHaveLength(1);
  });

  it('replays from a custom starting position', () => {
    const history = replayMoves('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', [{ from: 'a1', to: 'a8' }]);
    expect(history).toHaveLength(1);
    expect(history[0].san).toBe('Ra8+');
  });
});

describe('replayUci', () => {
  it('parses UCI strings including promotions', () => {
    const history = replayUci('8/P6k/8/8/8/8/8/6K1 w - - 0 1', ['a7a8q']);
    expect(history).toHaveLength(1);
    expect(history[0].san).toBe('a8=Q');
  });
});
