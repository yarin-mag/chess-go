import { create } from 'zustand';
import { ChessGame } from '@/core/chessGame';
import type { MoveInput, MoveRecord, PromotionPiece, Square } from '@/core/types';
import { describePotentialMove } from '@/core/describeMove';
import { requestMoveGrade } from '@/engine/engineClient';
import { classify, type Tier } from '@/engine/classify';
import { explainTags, type ExplanationTag } from '@/engine/explain';
import { usePuzzleProgressStore, type RushDuration } from './puzzleProgressStore';
import { allPuzzles, dailyPuzzle, puzzlesForStage, shuffled, totalStagePuzzleCount, type PuzzleData } from './puzzles';
import { abortBackgroundAnalysis } from '@/features/vault/backgroundAnalysisQueue';
import { useBlunderVaultStore } from '@/features/vault/blunderVaultStore';
import { toPuzzleData } from '@/features/vault/vaultPuzzle';

type PuzzleMode = 'ladder' | 'daily' | 'rush' | 'vault';
type PuzzleStatus = 'idle' | 'map' | 'playing' | 'wrong' | 'solved' | 'rushOver';

export interface WrongMoveFeedback {
  tier: Tier;
  tags: ExplanationTag[];
  move: MoveRecord;
}

export interface PuzzleHint {
  move: MoveInput;
  text: string;
}

export interface RushResult {
  score: number;
  isNewBest: boolean;
  reason: 'wrong' | 'timeUp';
}

interface PuzzleState {
  status: PuzzleStatus;
  mode: PuzzleMode;
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

  // Puzzle Rush only.
  rushDuration: RushDuration | null;
  rushDeadline: number | null;
  rushRemainingMs: number;
  rushSolvedCount: number;
  rushResult: RushResult | null;
  rushQueue: PuzzleData[];
  rushQueueIndex: number;

  start(stage: number, puzzleIndex: number): void;
  startDaily(): void;
  startRush(duration: RushDuration): void;
  startVault(): void;
  select(sq: Square): Promise<void>;
  showHint(): void;
  showMap(): void;
  retry(): void;
  next(): void;
  tickRush(now: number): void;
  exit(): void;
}

const parseUci = (uci: string): MoveInput => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  promotion: uci.length > 4 ? (uci[4] as PromotionPiece) : undefined,
});

const OPPONENT_REPLY_DELAY_MS = 600;
const MINUTE_MS = 60_000;

const noSelection: Pick<PuzzleState, 'selected' | 'targets'> = { selected: null, targets: [] };

export const usePuzzleStore = create<PuzzleState>((set, get) => {
  /** Loads a single puzzle into the live position, resetting per-attempt state (not rush bookkeeping). */
  const load = (puzzle: PuzzleData, stage: number, puzzleIndex: number, mode: PuzzleMode) => {
    const game = new ChessGame(puzzle.fen);
    set({
      status: 'playing',
      mode,
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
  };

  /** Advances the rush queue, reshuffling once it's exhausted (855 puzzles is plenty for one run, but never assume). */
  const loadNextRushPuzzle = () => {
    let { rushQueue, rushQueueIndex } = get();
    if (rushQueueIndex >= rushQueue.length) {
      rushQueue = shuffled(allPuzzles());
      rushQueueIndex = 0;
    }
    set({ rushQueue, rushQueueIndex: rushQueueIndex + 1 });
    load(rushQueue[rushQueueIndex], -1, -1, 'rush');
  };

  const endRush = (reason: RushResult['reason']) => {
    const { rushDuration, rushSolvedCount } = get();
    const isNewBest = usePuzzleProgressStore.getState().recordRushScore(rushDuration!, rushSolvedCount);
    set({ status: 'rushOver', rushResult: { score: rushSolvedCount, isNewBest, reason }, ...noSelection });
  };

  return {
    status: 'idle',
    mode: 'ladder',
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
    rushDuration: null,
    rushDeadline: null,
    rushRemainingMs: 0,
    rushSolvedCount: 0,
    rushResult: null,
    rushQueue: [],
    rushQueueIndex: 0,
    ...noSelection,

    start(stage, puzzleIndex) {
      const puzzle = puzzlesForStage(stage)[puzzleIndex];
      if (puzzle) load(puzzle, stage, puzzleIndex, 'ladder');
    },

    startDaily() {
      load(dailyPuzzle(), -1, -1, 'daily');
    },

    startVault() {
      const entry = useBlunderVaultStore.getState().pickNext();
      if (!entry) return;
      // The boot-time backfill (see backfillVault.ts) can still be grinding through up to 20 games in the
      // background when the player jumps straight to "My Mistakes" — never let that compete with this
      // foreground puzzle's own engine use.
      abortBackgroundAnalysis();
      load(toPuzzleData(entry), -1, -1, 'vault');
    },

    startRush(duration) {
      const queue = shuffled(allPuzzles());
      set({
        rushDuration: duration,
        rushDeadline: Date.now() + Number(duration) * MINUTE_MS,
        rushRemainingMs: Number(duration) * MINUTE_MS,
        rushSolvedCount: 0,
        rushResult: null,
        rushQueue: queue,
        rushQueueIndex: 1,
      });
      load(queue[0], -1, -1, 'rush');
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
          const mode = get().mode;
          if (mode === 'rush') {
            set({ rushSolvedCount: get().rushSolvedCount + 1 });
            loadNextRushPuzzle();
            return;
          }
          set({ status: 'solved' });
          if (mode === 'daily') {
            usePuzzleProgressStore.getState().recordDailySolve();
          } else if (mode === 'vault') {
            useBlunderVaultStore.getState().markSolved(puzzle!.id);
          } else {
            const size = totalStagePuzzleCount(get().stage);
            const solvedAt = get().puzzleIndex;
            const [nextStage, nextIndex] = solvedAt + 1 >= size ? [get().stage + 1, 0] : [get().stage, solvedAt + 1];
            usePuzzleProgressStore.getState().markSolved(nextStage, nextIndex);
          }
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
        set({ feedback: { tier, tags, move } });
        if (get().mode === 'rush') endRush('wrong');
        else set({ status: 'wrong' });
      }
    },

    showHint() {
      const { status, mode, game, puzzle, solutionStep } = get();
      if (status !== 'playing' || mode === 'rush' || !puzzle) return; // no hints during a timed run
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
      if (get().mode !== 'ladder') {
        get().showMap();
        return;
      }
      const { stage, puzzleIndex } = get();
      const size = totalStagePuzzleCount(stage);
      const [nextStage, nextIndex] = puzzleIndex + 1 >= size ? [stage + 1, 0] : [stage, puzzleIndex + 1];
      get().start(nextStage, nextIndex);
    },

    tickRush(now) {
      const { mode, status, rushDeadline } = get();
      if (mode !== 'rush' || status !== 'playing' || rushDeadline === null) return;
      const remaining = Math.max(0, rushDeadline - now);
      set({ rushRemainingMs: remaining });
      if (remaining === 0) endRush('timeUp');
    },

    exit() {
      set({ status: 'idle', puzzle: null, ...noSelection });
    },
  };
});
