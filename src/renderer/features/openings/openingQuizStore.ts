import { create } from 'zustand';
import { ChessGame } from '@/core/chessGame';
import type { Color, MoveInput } from '@/core/types';
import { useWalletStore } from '@/features/shop/walletStore';
import type { CuratedOpening } from './curatedOpenings';

/** Flat reward for finishing a quiz run, win or not — unlike puzzles/games, completion itself is the
 *  goal here, so the coins aren't gated on a perfect score. */
export const QUIZ_REWARD = 30;

const uciToMove = (uci: string): MoveInput => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  promotion: uci.length > 4 ? (uci[4] as MoveInput['promotion']) : undefined,
});

const sameMove = (a: MoveInput, b: MoveInput) => a.from === b.from && a.to === b.to;

/** How many of a curated line's plies are actually the player's to answer. White moves first in every
 *  pair (rounds up on an odd-length line); Black's turn is always the second of a pair (rounds down) — a
 *  1-ply line as Black asks the player nothing at all, so this correctly returns 0 for it. */
export function playerTurnCount(sequenceLength: number, side: Color): number {
  return side === 'w' ? Math.ceil(sequenceLength / 2) : Math.floor(sequenceLength / 2);
}

interface OpeningQuizState {
  opening: CuratedOpening | null;
  side: Color;
  game: ChessGame;
  step: number;
  correctCount: number;
  status: 'idle' | 'playing' | 'done';
  lastWrong: { san: string; bookSan: string } | null;
  /** Steps the player has already gotten wrong at least once — a step found this way never counts toward
   *  `correctCount`, even once the player eventually plays the book move. */
  wrongSteps: Set<number>;
  start(opening: CuratedOpening, side: Color): void;
  submitMove(move: MoveInput): void;
  /** Dismisses the current wrong-move feedback without changing the position — lets the player retry
   *  the same step from a clean prompt. */
  clearWrong(): void;
  /** SAN of the book move for the current step, without playing it — backs the "Show the book move"
   *  reveal. Null once the quiz is done or it isn't the player's turn to answer. */
  bookMoveSan(): string | null;
  exit(): void;
}

export const useOpeningQuizStore = create<OpeningQuizState>((set, get) => {
  /** Plays step `i` of the sequence (assumed legal — it's the curated line) and advances `step`. */
  const playStep = (i: number) => {
    const { game, opening } = get();
    game.move(uciToMove(opening!.sequence[i]));
    set({ step: i + 1 });
  };

  /** After the player's turn resolves, auto-play the opponent's scripted reply if the line continues,
   *  or the very next step immediately if it's the opponent's turn to open (player chose Black). */
  const advanceOpponentIfNeeded = () => {
    const { opening, step } = get();
    if (!opening) return;
    if (step >= opening.sequence.length) {
      useWalletStore.getState().earn(QUIZ_REWARD);
      set({ status: 'done' });
      return;
    }
    const isPlayerTurn = step % 2 === (get().side === 'w' ? 0 : 1);
    if (!isPlayerTurn) {
      playStep(step);
      advanceOpponentIfNeeded();
    }
  };

  return {
    opening: null,
    side: 'w',
    game: new ChessGame(),
    step: 0,
    correctCount: 0,
    status: 'idle',
    lastWrong: null,
    wrongSteps: new Set(),

    start(opening, side) {
      set({ opening, side, game: new ChessGame(), step: 0, correctCount: 0, status: 'playing', lastWrong: null, wrongSteps: new Set() });
      advanceOpponentIfNeeded();
    },

    submitMove(move) {
      const { status, opening, step, side, game, wrongSteps } = get();
      if (status !== 'playing' || !opening) return;
      const isPlayerTurn = step % 2 === (side === 'w' ? 0 : 1);
      if (!isPlayerTurn) return;

      const book = uciToMove(opening.sequence[step]);
      if (!sameMove(move, book)) {
        const bookSan = new ChessGame(game.fen()).move(book)?.san ?? opening.sequence[step];
        const attemptedSan = new ChessGame(game.fen()).move(move)?.san ?? `${move.from}${move.to}`;
        set({ lastWrong: { san: attemptedSan, bookSan }, wrongSteps: new Set(wrongSteps).add(step) });
        return;
      }

      // A step only counts toward the score if the player found it without a prior wrong guess at this
      // same step — otherwise every quiz would eventually finish "N/N" regardless of how many attempts it
      // took, since a wrong guess never advances the line on its own.
      const wasWrongBefore = wrongSteps.has(step);
      set({ lastWrong: null });
      playStep(step);
      if (!wasWrongBefore) set({ correctCount: get().correctCount + 1 });
      advanceOpponentIfNeeded();
    },

    clearWrong() {
      set({ lastWrong: null });
    },

    bookMoveSan() {
      const { status, opening, step, side, game } = get();
      if (status !== 'playing' || !opening || step >= opening.sequence.length) return null;
      const isPlayerTurn = step % 2 === (side === 'w' ? 0 : 1);
      if (!isPlayerTurn) return null;
      return new ChessGame(game.fen()).move(uciToMove(opening.sequence[step]))?.san ?? null;
    },

    exit() {
      set({ opening: null, game: new ChessGame(), step: 0, correctCount: 0, status: 'idle', lastWrong: null, wrongSteps: new Set() });
    },
  };
});
