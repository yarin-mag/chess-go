import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePuzzleStore } from './puzzleStore';
import { usePuzzleProgressStore } from './puzzleProgressStore';
import { puzzlesForStage } from './puzzles';
import { useBlunderVaultStore } from '@/features/vault/blunderVaultStore';

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

  it('startDaily loads a real puzzle marked as daily', () => {
    usePuzzleStore.getState().startDaily();
    const s = usePuzzleStore.getState();
    expect(s.status).toBe('playing');
    expect(s.mode).toBe('daily');
    expect(s.puzzle).not.toBeNull();
  });

  it('solving the daily puzzle records a solve without moving ladder progress', async () => {
    const before = usePuzzleProgressStore.getState();
    usePuzzleStore.getState().startDaily();
    const solution = usePuzzleStore.getState().puzzle!.solution;
    for (let i = 0; i < solution.length; i += 2) {
      const m = solution[i];
      await play(m.slice(0, 2), m.slice(2, 4));
      if (i + 1 < solution.length) await new Promise((r) => setTimeout(r, 700));
    }
    expect(usePuzzleStore.getState().status).toBe('solved');
    expect(usePuzzleProgressStore.getState().solvedCount).toBe(before.solvedCount + 1);
    expect(usePuzzleProgressStore.getState().furthestStage).toBe(before.furthestStage);
    expect(usePuzzleProgressStore.getState().furthestPuzzleIndex).toBe(before.furthestPuzzleIndex);
  });

  it("next() after the daily puzzle goes to the map, not a ladder puzzle", () => {
    usePuzzleStore.getState().startDaily();
    usePuzzleStore.getState().next();
    expect(usePuzzleStore.getState().status).toBe('map');
  });

  describe('Puzzle Rush', () => {
    it('starts with a shuffled puzzle, a deadline, and a zero score', () => {
      const startedAt = Date.now();
      usePuzzleStore.getState().startRush('3');
      const s = usePuzzleStore.getState();
      expect(s.status).toBe('playing');
      expect(s.mode).toBe('rush');
      expect(s.puzzle).not.toBeNull();
      expect(s.rushSolvedCount).toBe(0);
      expect(s.rushDeadline).toBeGreaterThanOrEqual(startedAt + 3 * 60_000);
    });

    it('chains straight to the next puzzle on a correct solve, without a solved pause', async () => {
      usePuzzleStore.getState().startRush('3');
      const puzzle = usePuzzleStore.getState().puzzle!;
      for (let i = 0; i < puzzle.solution.length; i += 2) {
        const m = puzzle.solution[i];
        await play(m.slice(0, 2), m.slice(2, 4));
        if (i + 1 < puzzle.solution.length) await new Promise((r) => setTimeout(r, 700));
      }
      expect(usePuzzleStore.getState().status).toBe('playing'); // never 'solved' in rush
      expect(usePuzzleStore.getState().rushSolvedCount).toBe(1);
      expect(usePuzzleStore.getState().puzzle!.id).not.toBe(puzzle.id);
    });

    it('a wrong move ends the run immediately (no retry) and records the score', async () => {
      usePuzzleStore.getState().startRush('3');
      const puzzle = usePuzzleStore.getState().puzzle!;
      const legalButWrong = usePuzzleStore
        .getState()
        .game.legalMoves()
        .find((m) => `${m.from}${m.to}` !== puzzle.solution[0]);
      expect(legalButWrong).toBeDefined();
      await play(legalButWrong!.from, legalButWrong!.to);
      const s = usePuzzleStore.getState();
      expect(s.status).toBe('rushOver');
      expect(s.rushResult?.reason).toBe('wrong');
      expect(s.feedback).not.toBeNull();
    });

    it('ticking past the deadline ends the run for running out of time', () => {
      usePuzzleStore.getState().startRush('3');
      usePuzzleStore.getState().tickRush(Date.now());
      expect(usePuzzleStore.getState().status).toBe('playing');
      usePuzzleStore.getState().tickRush(usePuzzleStore.getState().rushDeadline! + 1);
      const s = usePuzzleStore.getState();
      expect(s.status).toBe('rushOver');
      expect(s.rushResult?.reason).toBe('timeUp');
    });

    it('records a new best score with the progress store once at least one puzzle is solved', async () => {
      usePuzzleProgressStore.setState({ rushBest: { '3': 0, '5': 0 } });
      usePuzzleStore.getState().startRush('3');
      const puzzle = usePuzzleStore.getState().puzzle!;
      for (let i = 0; i < puzzle.solution.length; i += 2) {
        const m = puzzle.solution[i];
        await play(m.slice(0, 2), m.slice(2, 4));
        if (i + 1 < puzzle.solution.length) await new Promise((r) => setTimeout(r, 700));
      }
      expect(usePuzzleStore.getState().rushSolvedCount).toBe(1);

      usePuzzleStore.getState().tickRush(usePuzzleStore.getState().rushDeadline! + 1);
      expect(usePuzzleStore.getState().rushResult?.isNewBest).toBe(true);
      expect(usePuzzleProgressStore.getState().rushBest['3']).toBe(1);
    });

    it('disables hints during a rush', () => {
      usePuzzleStore.getState().startRush('3');
      usePuzzleStore.getState().showHint();
      expect(usePuzzleStore.getState().hint).toBeNull();
    });
  });
});

describe('startVault', () => {
  it('loads a vault entry as a single-move puzzle', () => {
    useBlunderVaultStore.setState({
      entries: [{
        id: 'g1-4', sourceGameId: 'g1', ply: 4,
        fenBefore: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
        bestMove: { from: 'a1', to: 'a8' }, bestSan: 'Ra8#', playedSan: 'Kd2',
        tier: 'blunder', tags: ['missedMate'], capturedAt: '2026-09-30T00:00:00.000Z',
      }],
      solvedIds: [],
    });
    usePuzzleStore.getState().startVault();
    const state = usePuzzleStore.getState();
    expect(state.status).toBe('playing');
    expect(state.mode).toBe('vault');
    expect(state.puzzle?.id).toBe('g1-4');
  });

  it('marks the vault entry solved on a correct guess and does not chain to another vault puzzle', async () => {
    useBlunderVaultStore.setState({
      entries: [{
        id: 'g1-4', sourceGameId: 'g1', ply: 4,
        fenBefore: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
        bestMove: { from: 'a1', to: 'a8' }, bestSan: 'Ra8#', playedSan: 'Kd2',
        tier: 'blunder', tags: ['missedMate'], capturedAt: '2026-09-30T00:00:00.000Z',
      }],
      solvedIds: [],
    });
    usePuzzleStore.getState().startVault();
    await usePuzzleStore.getState().select('a1');
    await usePuzzleStore.getState().select('a8');
    expect(usePuzzleStore.getState().status).toBe('solved');
    expect(useBlunderVaultStore.getState().solvedIds).toContain('g1-4');
    usePuzzleStore.getState().next();
    expect(usePuzzleStore.getState().status).toBe('map'); // showMap(), same as daily/rush today
  });
});
