import { describe, expect, it, beforeEach } from 'vitest';
import { useOpeningQuizStore } from './openingQuizStore';
import type { CuratedOpening } from './curatedOpenings';

const opening: CuratedOpening = { name: 'Italian Game', eco: 'C50', sequence: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'] };

beforeEach(() => {
  useOpeningQuizStore.getState().exit();
});

describe('start', () => {
  it('sets up the quiz at the opening position, waiting on the player at their first turn', () => {
    useOpeningQuizStore.getState().start(opening, 'w');
    const state = useOpeningQuizStore.getState();
    expect(state.status).toBe('playing');
    expect(state.step).toBe(0);
    expect(state.game.turn()).toBe('w');
  });

  it('auto-plays the opponent immediately when the player is Black', () => {
    useOpeningQuizStore.getState().start(opening, 'b');
    // step 0 (e2e4) is White's — auto-played instantly since the player is Black
    expect(useOpeningQuizStore.getState().step).toBe(1);
    expect(useOpeningQuizStore.getState().game.turn()).toBe('b');
  });
});

describe('submitMove', () => {
  it('advances and counts correct on a move matching the book line', () => {
    useOpeningQuizStore.getState().start(opening, 'w');
    useOpeningQuizStore.getState().submitMove({ from: 'e2', to: 'e4' });
    const state = useOpeningQuizStore.getState();
    expect(state.correctCount).toBe(1);
    // opponent's reply (e7e5) auto-plays, landing back on the player's second turn (g1f3, step 2)
    expect(state.step).toBe(2);
  });

  it('does not advance on a move that is not the book move, and does not count it correct', () => {
    useOpeningQuizStore.getState().start(opening, 'w');
    useOpeningQuizStore.getState().submitMove({ from: 'd2', to: 'd4' }); // legal, but not the curated line
    const state = useOpeningQuizStore.getState();
    expect(state.correctCount).toBe(0);
    expect(state.step).toBe(0); // stays put — line is not advanced by a wrong guess
    expect(state.lastWrong).toEqual({ san: expect.any(String), bookSan: expect.any(String) });
  });

  it('is a no-op when called on the opponent\'s turn or once the quiz is done', () => {
    useOpeningQuizStore.getState().start(opening, 'w');
    useOpeningQuizStore.getState().submitMove({ from: 'e2', to: 'e4' }); // now step 2, White's turn again
    useOpeningQuizStore.getState().submitMove({ from: 'g1', to: 'f3' });
    // sequence has 5 plies (indices 0-4); after 2 correct player moves we're at step 4 (Bc4, White's turn)
    useOpeningQuizStore.getState().submitMove({ from: 'f1', to: 'c4' });
    expect(useOpeningQuizStore.getState().status).toBe('done');
    expect(useOpeningQuizStore.getState().correctCount).toBe(3);
  });
});

describe('exit', () => {
  it('resets to idle', () => {
    useOpeningQuizStore.getState().start(opening, 'w');
    useOpeningQuizStore.getState().exit();
    expect(useOpeningQuizStore.getState().status).toBe('idle');
  });
});
