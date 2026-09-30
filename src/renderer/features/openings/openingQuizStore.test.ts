import { describe, expect, it, beforeEach } from 'vitest';
import { playerTurnCount, useOpeningQuizStore } from './openingQuizStore';
import type { CuratedOpening } from './curatedOpenings';

const opening: CuratedOpening = { name: 'Italian Game', eco: 'C50', sequence: ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4'] };

beforeEach(() => {
  useOpeningQuizStore.getState().exit();
});

describe('playerTurnCount', () => {
  it('rounds up for White, who moves first in every pair', () => {
    expect(playerTurnCount(5, 'w')).toBe(3); // e4 Nf3 Bc4 — White's 3 of 5 plies
  });

  it('rounds down for Black, whose turn is always the second of each pair', () => {
    expect(playerTurnCount(5, 'b')).toBe(2); // e5 Nc6 — Black's 2 of 5 plies
  });

  it('is zero for Black on a 1-ply line — nothing is ever asked of the player', () => {
    expect(playerTurnCount(1, 'b')).toBe(0);
  });
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

  it('does not count a step correct if it was only found after a wrong guess', () => {
    useOpeningQuizStore.getState().start(opening, 'w');
    useOpeningQuizStore.getState().submitMove({ from: 'd2', to: 'd4' }); // wrong guess at step 0
    useOpeningQuizStore.getState().submitMove({ from: 'e2', to: 'e4' }); // then the actual book move
    expect(useOpeningQuizStore.getState().correctCount).toBe(0);
    expect(useOpeningQuizStore.getState().step).toBe(2); // still advances the line...
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
