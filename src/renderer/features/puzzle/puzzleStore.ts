import { create } from 'zustand';
import { ChessGame } from '@/core/chessGame';
import type { MoveInput, MoveRecord, PromotionPiece, Square } from '@/core/types';
import { describePotentialMove } from '@/core/describeMove';
import { requestMoveGrade } from '@/engine/engineClient';
import { classify, type Tier } from '@/engine/classify';
import { explainTags, type ExplanationTag } from '@/engine/explain';
import { usePuzzleProgressStore } from './puzzleProgressStore';
import { puzzlesForStage, totalStagePuzzleCount, type PuzzleData } from './puzzles';

type PuzzleStatus = 'idle' | 'map' | 'playing' | 'wrong' | 'solved';

export interface WrongMoveFeedback {
  tier: Tier;
  tags: ExplanationTag[];
  move: MoveRecord;
}

export interface PuzzleHint {
  move: MoveInput;
  text: string;
}

interface PuzzleState {
  status: PuzzleStatus;
  stage: number;
  puzzleIndex: number;
  puzzle: PuzzleData | null;
  game: ChessGame;
  history: MoveRecord[];
  solutionStep: number;
  selected: Square | null;
  targets: Square[];
  lastMove: MoveInput | null;
  flipped: boolean;
  feedback: WrongMoveFeedback | null;
  hint: PuzzleHint | null;

  start(stage: number, puzzleIndex: number): void;
  select(sq: Square): Promise<void>;
  showHint(): void;
  showMap(): void;
  retry(): void;
  next(): void;
  exit(): void;
}

const parseUci = (uci: string): MoveInput => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  promotion: uci.length > 4 ? (uci[4] as PromotionPiece) : undefined,
});

const OPPONENT_REPLY_DELAY_MS = 600;

const noSelection: Pick<PuzzleState, 'selected' | 'targets'> = { selected: null, targets: [] };

export const usePuzzleStore = create<PuzzleState>((set, get) => ({
  status: 'idle',
  stage: 0,
  puzzleIndex: 0,
  puzzle: null,
  game: new ChessGame(),
  history: [],
  solutionStep: 0,
  lastMove: null,
  flipped: false,
  feedback: null,
  hint: null,
  ...noSelection,

  start(stage, puzzleIndex) {
    const puzzle = puzzlesForStage(stage)[puzzleIndex];
    if (!puzzle) return;
    const game = new ChessGame(puzzle.fen);
    set({
      status: 'playing',
      stage,
      puzzleIndex,
      puzzle,
      game,
      history: [],
      solutionStep: 0,
      lastMove: null,
      flipped: game.turn() === 'b',
      feedback: null,
      hint: null,
      ...noSelection,
    });
  },

  async select(sq) {
    const { status, game, selected, targets, puzzle, solutionStep } = get();
    if (status !== 'playing' || !puzzle) return;

    if (selected && targets.includes(sq)) {
      const expectedUci = puzzle.solution[solutionStep];
      const expected = parseUci(expectedUci);
      set({ hint: null, ...noSelection });

      if (expected.from === selected && expected.to === sq) {
        playCorrect(selected, sq, expected.promotion);
      } else {
        await gradeWrongAttempt(selected, sq);
      }
      return;
    }

    const piece = game.pieceAt(sq);
    if (piece?.color === game.turn() && sq !== selected) set({ selected: sq, targets: game.legalMovesFrom(sq) });
    else set(noSelection);

    function playCorrect(from: Square, to: Square, promotion: PromotionPiece | undefined): void {
      const record = game.move({ from, to, promotion })!;
      const nextStep = get().solutionStep + 1;
      set({ history: [...get().history, record], lastMove: { from, to }, solutionStep: nextStep });

      if (nextStep >= puzzle!.solution.length) {
        set({ status: 'solved' });
        const size = totalStagePuzzleCount(get().stage);
        const solvedAt = get().puzzleIndex;
        const [nextStage, nextIndex] = solvedAt + 1 >= size ? [get().stage + 1, 0] : [get().stage, solvedAt + 1];
        usePuzzleProgressStore.getState().markSolved(nextStage, nextIndex);
        return;
      }

      // Opponent's scripted reply, played after a short pause so it doesn't feel instantaneous.
      setTimeout(() => {
        if (get().puzzle !== puzzle || get().status !== 'playing') return; // puzzle changed/left meanwhile
        const replyUci = puzzle!.solution[get().solutionStep];
        const reply = parseUci(replyUci);
        const replyRecord = get().game.move(reply)!;
        set({
          history: [...get().history, replyRecord],
          lastMove: { from: reply.from, to: reply.to },
          solutionStep: get().solutionStep + 1,
        });
      }, OPPONENT_REPLY_DELAY_MS);
    }

    async function gradeWrongAttempt(from: Square, to: Square): Promise<void> {
      const fenBefore = game.fen();
      const before = new ChessGame(fenBefore);
      const promotion = game.isPromotion(from, to) ? 'q' : undefined;
      const grade = await requestMoveGrade(fenBefore, { from, to, promotion });
      const after = new ChessGame(fenBefore);
      const move = after.move({ from, to, promotion })!;
      const tier = classify(grade.centipawnLoss, false, false);
      const tags = explainTags({ before, after, move, grade, tier, ply: 0 });
      if (get().puzzle !== puzzle) return; // user moved on before grading finished
      set({ status: 'wrong', feedback: { tier, tags, move } });
    }
  },

  showHint() {
    const { status, game, puzzle, solutionStep } = get();
    if (status !== 'playing' || !puzzle) return;
    const move = parseUci(puzzle.solution[solutionStep]);
    const text = describePotentialMove(game.fen(), move);
    set({ hint: { move, text } });
  },

  showMap() {
    set({ status: 'map' });
  },

  retry() {
    if (get().status === 'wrong') set({ status: 'playing', feedback: null, ...noSelection });
  },

  next() {
    const { stage, puzzleIndex } = get();
    const size = totalStagePuzzleCount(stage);
    const [nextStage, nextIndex] = puzzleIndex + 1 >= size ? [stage + 1, 0] : [stage, puzzleIndex + 1];
    get().start(nextStage, nextIndex);
  },

  exit() {
    set({ status: 'idle', puzzle: null, ...noSelection });
  },
}));
