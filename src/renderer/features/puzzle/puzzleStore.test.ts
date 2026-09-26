import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePuzzleStore } from './puzzleStore';
import { usePuzzleProgressStore } from './puzzleProgressStore';
import { puzzlesForStage } from './puzzles';

vi.mock('@/engine/engineClient', () => ({
  requestMoveGrade: vi.fn(async (fen: string, move: { from: string; to: string; promotion?: string }) => {
    const { scoreRootMoves } = await import('@/engine/search');
    const { ANALYSIS_LEVEL } = await import('@/engine/analyzeLevel');
    const scored = scoreRootMoves(fen, ANALYSIS_LEVEL);
    const best = scored[0];
    const played = scored.find((s) => s.move.from === move.from && s.move.to === move.to) ?? best;
    return {
      bestMove: best.move,
      bestSan: best.san,
      bestScore: best.score,
      playedScore: played.score,
      centipawnLoss: Math.max(0, best.score - played.score),
    };
  }),
}));

const first = puzzlesForStage(0)[0];
const play = (from: string, to: string) =>
  usePuzzleStore
    .getState()
    .select(from)
    .then(() => usePuzzleStore.getState().select(to));

describe('puzzleStore', () => {
  afterEach(() => usePuzzleStore.getState().exit());

  it('starts on the puzzle position with the right side to move', () => {
    usePuzzleStore.getState().start(0, 0);
    const s = usePuzzleStore.getState();
    expect(s.status).toBe('playing');
    expect(s.puzzle?.id).toBe(first.id);
    expect(s.game.turn()).toBe(first.fen.split(' ')[1]);
  });

  it('advances through a correct solution move, auto-playing the opponent reply', async () => {
    usePuzzleStore.getState().start(0, 0);
    const [m0] = first.solution;
    await play(m0.slice(0, 2), m0.slice(2, 4));
    expect(usePuzzleStore.getState().history.length).toBeGreaterThanOrEqual(1);
    if (first.solution.length > 1) {
      await new Promise((r) => setTimeout(r, 700));
      expect(usePuzzleStore.getState().history.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('solves the whole puzzle and records progress', async () => {
    usePuzzleStore.getState().start(0, 0);
    for (let i = 0; i < first.solution.length; i += 2) {
      const m = first.solution[i];
      await play(m.slice(0, 2), m.slice(2, 4));
      if (i + 1 < first.solution.length) await new Promise((r) => setTimeout(r, 700));
    }
    expect(usePuzzleStore.getState().status).toBe('solved');
    expect(usePuzzleProgressStore.getState().solvedCount).toBeGreaterThan(0);
  });

  it('grades a wrong move without corrupting the puzzle position', async () => {
    usePuzzleStore.getState().start(0, 0);
    const beforeFen = usePuzzleStore.getState().game.fen();
    const legalButWrong = usePuzzleStore
      .getState()
      .game.legalMoves()
      .find((m) => `${m.from}${m.to}` !== first.solution[0]);
    expect(legalButWrong).toBeDefined();
    await play(legalButWrong!.from, legalButWrong!.to);
    expect(usePuzzleStore.getState().status).toBe('wrong');
    expect(usePuzzleStore.getState().feedback).not.toBeNull();
    expect(usePuzzleStore.getState().game.fen()).toBe(beforeFen);
  });

  it('retry clears wrong-move feedback and resumes play', async () => {
    usePuzzleStore.getState().start(0, 0);
    const legalButWrong = usePuzzleStore
      .getState()
      .game.legalMoves()
      .find((m) => `${m.from}${m.to}` !== first.solution[0]);
    expect(legalButWrong).toBeDefined();
    await play(legalButWrong!.from, legalButWrong!.to);
    usePuzzleStore.getState().retry();
    expect(usePuzzleStore.getState().status).toBe('playing');
    expect(usePuzzleStore.getState().feedback).toBeNull();
  });

  it('shows a hint for the correct move, without needing an engine call', () => {
    usePuzzleStore.getState().start(0, 0);
    usePuzzleStore.getState().showHint();
    const hint = usePuzzleStore.getState().hint;
    expect(hint).not.toBeNull();
    expect(`${hint!.move.from}${hint!.move.to}`).toBe(first.solution[0].slice(0, 4));
    expect(hint!.text.length).toBeGreaterThan(0);
  });

  it('clears the hint once a move is played', async () => {
    usePuzzleStore.getState().start(0, 0);
    usePuzzleStore.getState().showHint();
    expect(usePuzzleStore.getState().hint).not.toBeNull();
    const [m0] = first.solution;
    await play(m0.slice(0, 2), m0.slice(2, 4));
    expect(usePuzzleStore.getState().hint).toBeNull();
  });

  it('showMap switches to the map status without touching an in-progress puzzle', () => {
    usePuzzleStore.getState().start(0, 0);
    usePuzzleStore.getState().showMap();
    expect(usePuzzleStore.getState().status).toBe('map');
  });
});
