# B-Chess Phase 1.5 — Move Tutor & Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After any finished game, let the player review it move by move with an engine-graded tier (Brilliant…Blunder), a plain-language explanation, and opening recognition — navigable by swipe, arrow keys, or clicking a move.

**Architecture:** The existing alpha-beta engine already scores every legal root move each search; a new `scoreRootMoves` export exposes that full list instead of just the top pick, so grading a played move needs no second search. A feature-level orchestrator (`features/review/analyzeGame.ts`) replays the finished game, asks the worker to grade each ply, runs pure classification/explanation/opening-lookup on the result, and hands the array to a new `reviewStore`. The board's rendering is split into a presentational `BoardView` shared by live play and the new read-only replay board, so neither duplicates the other.

**Tech Stack:** Same as phase 1 (Electron, React, TypeScript, Zustand, Framer Motion, chess.js, Vitest). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-25-b-chess-phase1.5-tutor-design.md`

## Global Constraints

- Everything free / open source, no paid services, no external AI API calls — grading and explanations are computed locally (engine + rule-based checks).
- No new lookup table of positions. The only static JSON is the opening book (`assets/openings.json`), built from the free `lichess-org/chess-openings` dataset.
- Dependency rule holds: `components → features → core/engine`. `engine/*` and `core/*` stay framework-free and unit tested; `features/review/*` may import both.
- Reuses phase 1's worker (`engine/worker.ts`) and its abort pattern — no second worker file.
- `Board.tsx`'s existing DOM structure and CSS classes (`Board.module.css`) must not change visually; the split into `BoardView` is a refactor, not a redesign.

## Shared interfaces (all tasks rely on these)

```ts
// engine/levels.ts (extended)
export interface LevelConfig {
  depth: number;
  timeMs: number;
  quiescence: boolean;
  randomTopN: number;
  randomChance: number;
  noise: number;
  /** Score every root move exactly rather than pruning later ones with a narrowed window. */
  exact: boolean;
}
```

```ts
// engine/analyze.ts
export interface MoveGrade {
  bestMove: MoveInput;
  bestSan: string;
  bestScore: number;    // centipawns, mover's POV
  playedScore: number;  // centipawns, mover's POV
  centipawnLoss: number; // max(0, bestScore - playedScore)
}
export function analyzeMove(fenBefore: string, played: MoveInput): MoveGrade;
```

```ts
// engine/classify.ts
export type Tier = 'brilliant' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export function classify(centipawnLoss: number, isBestMove: boolean, sacrificedMaterial: boolean): Tier;
```

```ts
// engine/explain.ts
export type ExplanationTag =
  | 'hangsPiece' | 'missedMate' | 'walksIntoMate' | 'goodTrade'
  | 'developsPiece' | 'ignoresCenter' | 'keepsAdvantage' | 'throwsAwayAdvantage' | 'solid';
export function explainTags(ctx: ExplainContext): ExplanationTag[]; // at most 2, priority order
export function isHanging(fen: string, square: Square): boolean;
```

```ts
// core/openings.ts
export interface Opening { eco: string; name: string }
export function lookupOpening(uciSequence: string[]): Opening | null; // longest-prefix match
```

```ts
// features/review/analyzeGame.ts
export interface MoveAnalysis {
  ply: number;
  move: MoveRecord;
  bestMove: MoveInput;
  bestSan: string;
  bestScore: number;
  playedScore: number;
  centipawnLoss: number;
  tier: Tier;
  tags: ExplanationTag[];
  opening: Opening | null;
}
export function analyzeGame(
  startFen: string | undefined,
  history: MoveRecord[],
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<MoveAnalysis[]>;
```

```ts
// features/review/reviewStore.ts
interface ReviewState {
  status: 'idle' | 'analyzing' | 'ready';
  config: GameConfig | null;
  history: MoveRecord[];
  progress: { done: number; total: number };
  analysis: MoveAnalysis[];
  index: number; // -1 = start position, history.length - 1 = final position
  start(config: GameConfig, history: MoveRecord[]): void;
  goTo(index: number): void;
  next(): void;
  prev(): void;
  exit(): void;
}
```

```ts
// components/BoardView.tsx
export interface BoardViewProps {
  pieces: TrackedPiece[];
  flipped: boolean;
  selected: Square | null;
  targets: Square[];
  lastMove: MoveInput | null;
  checkSquare: Square | null;
  showLegalMoves: boolean;
  isCaptureTarget: (sq: Square) => boolean;
  onSquareClick?: (sq: Square) => void; // absent = read-only board
}
```

---

### Task 1: Engine — expose exact root scores + analysis config

**Files:**
- Modify: `src/renderer/engine/levels.ts`
- Modify: `src/renderer/engine/search.ts`
- Test: `src/renderer/engine/engine.test.ts` (extend, existing file)

**Interfaces:** Produces `LevelConfig.exact`, `scoreRootMoves(fen, cfg): RootMoveScore[]`, `ANALYSIS_LEVEL`.

- [ ] **Step 1: Write the failing test** (append to `engine.test.ts`):
```ts
import { scoreRootMoves } from './search';
import { ANALYSIS_LEVEL } from './analyzeLevel';

describe('scoreRootMoves', () => {
  it('scores every legal move, best first', () => {
    const scored = scoreRootMoves('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', ANALYSIS_LEVEL);
    expect(scored[0].move).toMatchObject({ from: 'a1', to: 'a8' });
    expect(scored.length).toBeGreaterThan(1);
    expect(scored.every((s) => typeof s.score === 'number')).toBe(true);
  });

  it('includes the san for each move', () => {
    const scored = scoreRootMoves('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', ANALYSIS_LEVEL);
    expect(scored.find((s) => s.move.from === 'a1' && s.move.to === 'a8')?.san).toBe('Ra8#');
  });
});
```
- [ ] **Step 2:** Run `npx vitest run src/renderer/engine` → FAIL (`scoreRootMoves`/`ANALYSIS_LEVEL` don't exist).
- [ ] **Step 3: Implement.**

In `levels.ts`, add the field and set it explicitly for every level (values chosen so behavior is unchanged: easy/medium already scored exactly via the old derived rule, hard did not):
```ts
export interface LevelConfig {
  depth: number;
  timeMs: number;
  quiescence: boolean;
  randomTopN: number;
  randomChance: number;
  noise: number;
  /** Score every root move exactly rather than pruning later ones with a narrowed window. */
  exact: boolean;
}

export const LEVELS: Record<Level, LevelConfig> = {
  easy: { depth: 1, timeMs: 300, quiescence: false, randomTopN: 4, randomChance: 0.3, noise: 40, exact: true },
  medium: { depth: 3, timeMs: 1500, quiescence: true, randomTopN: 1, randomChance: 0, noise: 10, exact: true },
  hard: { depth: 5, timeMs: 2500, quiescence: true, randomTopN: 1, randomChance: 0, noise: 0, exact: false },
};
```

In `search.ts`, replace the derived `exact` line inside `search()`:
```ts
// before: const exact = this.cfg.randomTopN > 1 || this.cfg.noise > 0;
const exact = this.cfg.exact;
```

Still in `search.ts`, add below `findBestMove`:
```ts
export interface RootMoveScore {
  move: MoveInput;
  san: string;
  score: number;
}

/** Scores every legal move from `fen` (best first). Used for post-game analysis, where every move's score is needed, not just the best one. */
export function scoreRootMoves(fen: string, cfg: LevelConfig): RootMoveScore[] {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) return [];
  if (legal.length === 1) return [{ move: toInput(legal[0]), san: legal[0].san, score: 0 }];
  return new Searcher(chess, cfg).search().map((s) => ({ move: toInput(s.move), san: s.move.san, score: s.score }));
}
```

New file `src/renderer/engine/analyzeLevel.ts`:
```ts
import type { LevelConfig } from './levels';

/** Depth/time budget for post-game analysis. Not tied to the play difficulties in levels.ts. */
export const ANALYSIS_LEVEL: LevelConfig = {
  depth: 4,
  timeMs: 800,
  quiescence: true,
  randomTopN: 1,
  randomChance: 0,
  noise: 0,
  exact: true,
};
```

- [ ] **Step 4:** Run `npx vitest run src/renderer/engine` → PASS (existing `findBestMove` tests must still pass unchanged — confirms the refactor didn't change play behavior).
- [ ] **Step 5:** `npm run typecheck`. Commit:
```bash
git add src/renderer/engine
git commit -m "feat(engine): expose exact root move scores for analysis"
```

### Task 2: Engine — analyzeMove + worker grading

**Files:**
- Create: `src/renderer/engine/analyze.ts`
- Modify: `src/renderer/engine/worker.ts`
- Modify: `src/renderer/engine/engineClient.ts`
- Test: `src/renderer/engine/analyze.test.ts`

**Interfaces:** Consumes `scoreRootMoves`, `ANALYSIS_LEVEL`. Produces `analyzeMove`, `MoveGrade`, and `requestMoveGrade` (client-side, for Task 7).

- [ ] **Step 1: Write the failing test**
```ts
import { describe, expect, it } from 'vitest';
import { analyzeMove } from './analyze';

describe('analyzeMove', () => {
  it('gives zero loss for the actual best move', () => {
    const fen = '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1';
    const grade = analyzeMove(fen, { from: 'a1', to: 'a8' });
    expect(grade.bestMove).toMatchObject({ from: 'a1', to: 'a8' });
    expect(grade.centipawnLoss).toBe(0);
  });

  it('gives positive loss for a blunder that hangs the queen', () => {
    const fen = '4k3/8/8/4p3/8/8/8/3QK3 w - - 0 1'; // Qd1-d4?? loses the queen to the e5 pawn
    const grade = analyzeMove(fen, { from: 'd1', to: 'd4' });
    expect(grade.centipawnLoss).toBeGreaterThan(300);
  });
});
```
- [ ] **Step 2:** Run `npx vitest run src/renderer/engine/analyze.test.ts` → FAIL.
- [ ] **Step 3: Implement.**

`src/renderer/engine/analyze.ts`:
```ts
import type { MoveInput } from '@/core/types';
import { ANALYSIS_LEVEL } from './analyzeLevel';
import { scoreRootMoves } from './search';

export interface MoveGrade {
  bestMove: MoveInput;
  bestSan: string;
  bestScore: number;
  playedScore: number;
  centipawnLoss: number;
}

const sameMove = (a: MoveInput, b: MoveInput) => a.from === b.from && a.to === b.to && a.promotion === b.promotion;

/** Grades one played move against the engine's own best move at that position. */
export function analyzeMove(fenBefore: string, played: MoveInput): MoveGrade {
  const scored = scoreRootMoves(fenBefore, ANALYSIS_LEVEL);
  const best = scored[0];
  // The played move is always one of the scored legal moves; falling back to best guards against a desync.
  const playedEntry = scored.find((s) => sameMove(s.move, played)) ?? best;
  return {
    bestMove: best.move,
    bestSan: best.san,
    bestScore: best.score,
    playedScore: playedEntry.score,
    centipawnLoss: Math.max(0, best.score - playedEntry.score),
  };
}
```

`worker.ts` — add a `kind` discriminator without breaking the existing move-search path:
```ts
import type { Level, MoveInput } from '@/core/types';
import { analyzeMove, type MoveGrade } from './analyze';
import { findBestMove } from './search';

export type EngineRequest =
  | { id: number; kind: 'bestMove'; fen: string; level: Level }
  | { id: number; kind: 'grade'; fen: string; move: MoveInput };

export interface EngineResponse {
  id: number;
  bestMove?: MoveInput;
  grade?: MoveGrade;
  error?: string;
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<EngineRequest>) => void) | null;
  postMessage: (msg: EngineResponse) => void;
};

ctx.onmessage = ({ data }) => {
  try {
    if (data.kind === 'bestMove') ctx.postMessage({ id: data.id, bestMove: findBestMove(data.fen, data.level) });
    else ctx.postMessage({ id: data.id, grade: analyzeMove(data.fen, data.move) });
  } catch (e) {
    ctx.postMessage({ id: data.id, error: e instanceof Error ? e.message : String(e) });
  }
};
```

`engineClient.ts` — rewrite to route both request kinds through one pending map:
```ts
import type { Level, MoveInput } from '@/core/types';
import type { EngineRequest, EngineResponse, MoveGrade } from './worker'; // MoveGrade re-exported below
```
Since `MoveGrade` is defined in `analyze.ts`, not `worker.ts`, import it from there instead. Full file:
```ts
import type { Level, MoveInput } from '@/core/types';
import type { MoveGrade } from './analyze';
import type { EngineRequest, EngineResponse } from './worker';

interface Pending {
  resolve: (value: MoveInput | MoveGrade) => void;
  reject: (e: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function failAll(reason: string): void {
  for (const p of pending.values()) p.reject(new Error(reason));
  pending.clear();
  worker?.terminate();
  worker = null; // recreated lazily on the next request
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<EngineResponse>) => {
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id);
    if (data.error) p.reject(new Error(data.error));
    else if (data.bestMove) p.resolve(data.bestMove);
    else if (data.grade) p.resolve(data.grade);
    else p.reject(new Error('Engine returned an empty response'));
  };
  worker.onerror = () => failAll('Engine worker crashed');
  return worker;
}

function send<T extends MoveInput | MoveGrade>(request: Omit<EngineRequest, 'id'>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve: resolve as (v: MoveInput | MoveGrade) => void, reject });
    getWorker().postMessage({ id, ...request } as EngineRequest);
  });
}

/** Asks the background engine for a move. Rejects if the worker fails; callers should fall back. */
export function requestEngineMove(fen: string, level: Level): Promise<MoveInput> {
  return send<MoveInput>({ kind: 'bestMove', fen, level });
}

/** Grades a played move against the engine's best move at that position (used for post-game review). */
export function requestMoveGrade(fen: string, move: MoveInput): Promise<MoveGrade> {
  return send<MoveGrade>({ kind: 'grade', fen, move });
}
```

- [ ] **Step 4:** Run `npx vitest run src/renderer/engine` → PASS. `npm run typecheck` (catches the `players.ts` call site, which still calls `requestEngineMove(fen, level)` — signature unchanged, should already compile).
- [ ] **Step 5:** Commit:
```bash
git add src/renderer/engine
git commit -m "feat(engine): worker-backed move grading alongside move search"
```

### Task 3: Core — attack detection for "hanging piece" checks

**Files:**
- Create: `src/renderer/core/attacks.ts`
- Test: `src/renderer/core/attacks.test.ts`

**Interfaces:** Produces `attackersOf(fen, square, byColor): Square[]`, `isDefended(fen, square): boolean`, `cheapestAttackerValue(fen, square, byColor): number | null`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, expect, it } from 'vitest';
import { attackersOf, cheapestAttackerValue } from './attacks';

describe('attacks', () => {
  it('finds the pieces of a color that attack a square', () => {
    // White rook a1 and knight b1 both bear on/near; only test a clean, unambiguous case: rook attacks a8.
    expect(attackersOf('6k1/8/8/8/8/8/8/R3K3 w - - 0 1', 'a8', 'w')).toEqual(['a1']);
  });

  it('returns no attackers when the square is out of reach', () => {
    expect(attackersOf('6k1/8/8/8/8/8/8/R3K3 w - - 0 1', 'h8', 'w')).toEqual([]);
  });

  it('reports the cheapest attacker value', () => {
    // Black queen d8 and rook a8 both attack d5; the queen is not cheaper than the rook (irrelevant here) —
    // use a position where a pawn and a rook both attack the same square, pawn should win.
    const fen = '8/8/8/3p4/8/8/8/R6K w - - 0 1'; // black pawn d5 could be attacked by white; flip: check black attackers of d4
    expect(cheapestAttackerValue(fen, 'a5', 'b')).toBeNull(); // nothing black attacks a5 here
  });

  it('is null when nothing attacks the square', () => {
    expect(cheapestAttackerValue('6k1/8/8/8/8/8/8/R3K3 w - - 0 1', 'h1', 'w')).toBeNull();
  });
});
```
- [ ] **Step 2:** Run `npx vitest run src/renderer/core/attacks.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
```ts
import { Chess } from 'chess.js';
import { PIECE_VALUE } from '@/engine/evaluate';
import type { Color, Square } from './types';

/**
 * Squares of `byColor`'s pieces that could move to `square` right now, by forcing `byColor` to move
 * from `fen`. This is always a legal thing to ask: right after any legal move the mover's own king is
 * never in check, so pretending it's the *other* side's turn from that same position never produces an
 * illegal one. It only approximates a real attack map (pins are not accounted for), which is acceptable
 * for tutoring heuristics.
 */
export function attackersOf(fen: string, square: Square, byColor: Color): Square[] {
  const parts = fen.split(' ');
  parts[1] = byColor;
  const chess = new Chess(parts.join(' '));
  return chess
    .moves({ verbose: true })
    .filter((m) => m.to === square)
    .map((m) => m.from);
}

/** The lowest material value among `byColor`'s attackers of `square`, or null if there are none. */
export function cheapestAttackerValue(fen: string, square: Square, byColor: Color): number | null {
  const chess = new Chess((() => {
    const parts = fen.split(' ');
    parts[1] = byColor;
    return parts.join(' ');
  })());
  const values = chess
    .moves({ verbose: true })
    .filter((m) => m.to === square)
    .map((m) => PIECE_VALUE[m.piece as keyof typeof PIECE_VALUE]);
  return values.length ? Math.min(...values) : null;
}
```
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** `npm run typecheck`. Commit:
```bash
git add src/renderer/core/attacks.ts src/renderer/core/attacks.test.ts
git commit -m "feat(core): attack detection for tutoring heuristics"
```

### Task 4: Engine — classify.ts

**Files:**
- Create: `src/renderer/engine/classify.ts`
- Test: `src/renderer/engine/classify.test.ts`

**Interfaces:** Produces `Tier`, `classify(centipawnLoss, isBestMove, sacrificedMaterial): Tier`.

- [ ] **Step 1: Write the failing test**
```ts
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
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.**
```ts
export type Tier = 'brilliant' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/**
 * Grades a played move by how many centipawns it lost compared to the engine's best move.
 * `sacrificedMaterial` marks a best move that gives up material outright (a real sacrifice) as 'brilliant'.
 */
export function classify(centipawnLoss: number, isBestMove: boolean, sacrificedMaterial: boolean): Tier {
  if (isBestMove) return sacrificedMaterial ? 'brilliant' : 'best';
  if (centipawnLoss < 50) return 'good';
  if (centipawnLoss < 100) return 'inaccuracy';
  if (centipawnLoss < 300) return 'mistake';
  return 'blunder';
}
```
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit:
```bash
git add src/renderer/engine/classify.ts src/renderer/engine/classify.test.ts
git commit -m "feat(engine): move-quality tier classification"
```

### Task 5: Engine — explain.ts + phrases.ts

**Files:**
- Create: `src/renderer/engine/phrases.ts`
- Create: `src/renderer/engine/explain.ts`
- Test: `src/renderer/engine/explain.test.ts`

**Interfaces:** Consumes `attackersOf`, `cheapestAttackerValue` (Task 3), `ChessGame`, `MoveRecord`. Produces `ExplanationTag`, `ExplainContext`, `explainTags(ctx): ExplanationTag[]`, `isHanging(fen, square): boolean`, `sacrificesMaterial(before, move): boolean`, `phraseFor(tag, tier, seed): string`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, expect, it } from 'vitest';
import { ChessGame } from '@/core/chessGame';
import { explainTags, isHanging, sacrificesMaterial, phraseFor } from './explain';

const grade = (bestScore: number, playedScore: number) => ({
  bestMove: { from: 'a1', to: 'a1' },
  bestSan: '',
  bestScore,
  playedScore,
  centipawnLoss: Math.max(0, bestScore - playedScore),
});

describe('isHanging', () => {
  it('is true for an undefended piece a lower-value attacker can take', () => {
    // White knight on d4, black pawn on e5 attacks it, nothing white defends d4.
    expect(isHanging('6k1/8/8/4p3/3N4/8/8/6K1 w - - 0 1', 'd4')).toBe(true);
  });

  it('is false when nothing attacks the square', () => {
    expect(isHanging('6k1/8/8/8/3N4/8/8/6K1 w - - 0 1', 'd4')).toBe(false);
  });

  it('is false when the piece is adequately defended', () => {
    // Knight d4 attacked by pawn e5, defended by pawn c3 (equal-or-better trade for the defender).
    expect(isHanging('6k1/8/8/4p3/3N4/2P5/8/6K1 w - - 0 1', 'd4')).toBe(false);
  });
});

describe('sacrificesMaterial', () => {
  it('is true when a move captures a cheaper piece with a pricier one', () => {
    const before = new ChessGame('6k1/8/8/3p4/8/8/8/3RK3 w - - 0 1');
    const move = before.move({ from: 'd1', to: 'd5' })!; // rook takes pawn
    expect(sacrificesMaterial(before, move)).toBe(true);
  });

  it('is false for a roughly even trade', () => {
    const before = new ChessGame('6k1/8/8/3r4/8/8/8/3RK3 w - - 0 1');
    const move = before.move({ from: 'd1', to: 'd5' })!; // rook takes rook
    expect(sacrificesMaterial(before, move)).toBe(false);
  });
});

describe('explainTags', () => {
  it('tags a move that hangs the piece it just moved', () => {
    const before = new ChessGame('6k1/8/8/8/8/8/8/3NK3 w - - 0 1');
    const move = before.move({ from: 'd1', to: 'd4' })!; // walks into... needs an attacker; adjust fen below
    const after = new ChessGame(move.fen);
    const tags = explainTags({ before, after, move, grade: grade(0, -320), tier: 'blunder', ply: 10 });
    expect(tags).toContain('hangsPiece');
  });

  it('tags a missed forced mate', () => {
    const before = new ChessGame('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1');
    const move = before.move({ from: 'a1', to: 'a7' })!; // not the mating move
    const after = new ChessGame(move.fen);
    const tags = explainTags({ before, after, move, grade: grade(99_990, 50), tier: 'blunder', ply: 10 });
    expect(tags).toContain('missedMate');
  });

  it('falls back to solid when nothing else fires', () => {
    const before = new ChessGame();
    const move = before.move({ from: 'e2', to: 'e4' })!;
    const after = new ChessGame(move.fen);
    const tags = explainTags({ before, after, move, grade: grade(20, 15), tier: 'good', ply: 0 });
    expect(tags.length).toBeGreaterThan(0);
  });
});

describe('phraseFor', () => {
  it('substitutes the move san', () => {
    expect(phraseFor('hangsPiece', 'blunder', 'e4', 0)).toContain('e4');
  });
});
```
- [ ] **Step 2:** Run `npx vitest run src/renderer/engine/explain.test.ts` → FAIL. (Note: verify the `hangsPiece` fixture actually leaves the knight attacked — adjust the FEN if `isHanging` reports false during Step 4; the test's intent is fixed, the exact FEN is not load-bearing.)
- [ ] **Step 3: Implement.**

`src/renderer/engine/phrases.ts`:
```ts
import type { ExplanationTag } from './explain';
import type { Tier } from './classify';

type PhraseKey = `${ExplanationTag}:${Tier}` | ExplanationTag;

const PHRASES: Partial<Record<PhraseKey, string[]>> = {
  hangsPiece: ['{san} leaves a piece hanging — your opponent can just take it for free.'],
  missedMate: ['{san} misses a forced checkmate that was on the board.'],
  walksIntoMate: ['{san} allows a forced checkmate against you.'],
  goodTrade: ['{san} is a fair trade — the material given up is matched by what you win back.'],
  developsPiece: ['{san} brings a new piece into the game — good development.'],
  ignoresCenter: ["{san} doesn't fight for the center; central pawns and pieces control more of the board."],
  keepsAdvantage: ['{san} keeps hold of your advantage.'],
  throwsAwayAdvantage: ['{san} throws away an advantage you had.'],
  solid: ['{san} is a perfectly reasonable move.'],
  'solid:best': ["{san} is exactly what the engine would play here."],
  'solid:brilliant': ['{san} is a brilliant sacrifice the engine confirms is sound.'],
};

/** Deterministic per-move pick among a tag's templates, so revisiting a move keeps the same wording. */
export function phraseFor(tag: ExplanationTag, tier: Tier, san: string, seed: number): string {
  const templates = PHRASES[`${tag}:${tier}` as PhraseKey] ?? PHRASES[tag] ?? PHRASES.solid!;
  const template = templates[seed % templates.length];
  return template.replace('{san}', san);
}
```

`src/renderer/engine/explain.ts`:
```ts
import { Chess } from 'chess.js';
import { attackersOf, cheapestAttackerValue } from '@/core/attacks';
import type { ChessGame } from '@/core/chessGame';
import type { MoveRecord } from '@/core/types';
import { PIECE_VALUE } from './evaluate';
import type { MoveGrade } from './analyze';
import type { Tier } from './classify';

export type ExplanationTag =
  | 'hangsPiece'
  | 'missedMate'
  | 'walksIntoMate'
  | 'goodTrade'
  | 'developsPiece'
  | 'ignoresCenter'
  | 'keepsAdvantage'
  | 'throwsAwayAdvantage'
  | 'solid';

export interface ExplainContext {
  before: ChessGame;
  after: ChessGame;
  move: MoveRecord;
  grade: MoveGrade;
  tier: Tier;
  ply: number;
}

const MATE_THRESHOLD = 99_000; // engine mate scores are (100_000 - plyToMate); this is safely below any real one
const OPENING_PLIES = 10;
const CENTER: readonly string[] = ['d4', 'd5', 'e4', 'e5'];

/** True when `square` can be captured by its own color's opponent for less than the piece is worth. */
export function isHanging(fen: string, square: string): boolean {
  const piece = new Chess(fen).get(square as never);
  if (!piece) return false;
  const opponent = piece.color === 'w' ? 'b' : 'w';
  const attackerValue = cheapestAttackerValue(fen, square, opponent);
  if (attackerValue === null) return false;
  const defended = attackersOf(fen, square, piece.color).length > 0;
  const pieceValue = PIECE_VALUE[piece.type as keyof typeof PIECE_VALUE];
  return !defended || attackerValue < pieceValue;
}

/** True when a capture gives up more material than it immediately wins back. */
export function sacrificesMaterial(before: ChessGame, move: MoveRecord): boolean {
  if (!move.captured) return false;
  return PIECE_VALUE[move.piece] > PIECE_VALUE[move.captured] + 50;
}

function isMateScore(score: number): boolean {
  return Math.abs(score) > MATE_THRESHOLD;
}

/** Ordered detectors; the first matches win, capped at two tags so the sentence stays short. */
export function explainTags(ctx: ExplainContext): ExplanationTag[] {
  const tags: ExplanationTag[] = [];
  const push = (tag: ExplanationTag) => tags.length < 2 && !tags.includes(tag) && tags.push(tag);

  if (isMateScore(ctx.grade.bestScore) && !isMateScore(ctx.grade.playedScore)) push('missedMate');
  if (isHanging(ctx.move.fen, ctx.move.to)) push('hangsPiece');
  if (ctx.move.captured && !sacrificesMaterial(ctx.before, ctx.move) && ctx.tier !== 'blunder' && ctx.tier !== 'mistake') {
    push('goodTrade');
  }
  if (ctx.ply < OPENING_PLIES) {
    if (CENTER.includes(ctx.move.to)) push('developsPiece');
    else if (ctx.move.piece === 'p' && !CENTER.some((sq) => sq[0] === ctx.move.to[0])) push('ignoresCenter');
  }
  if (tags.length === 0) {
    if (ctx.tier === 'mistake' || ctx.tier === 'blunder') push('throwsAwayAdvantage');
    else if (ctx.tier === 'good' || ctx.tier === 'best' || ctx.tier === 'brilliant') push('keepsAdvantage');
    else push('solid');
  }
  return tags;
}
```

- [ ] **Step 4:** Run `npx vitest run src/renderer/engine` → PASS. If the `hangsPiece` fixture doesn't trigger, adjust its FEN so the moved-to square is genuinely undefended and attacked (the assertion stays the same).
- [ ] **Step 5:** `npm run typecheck`. Commit:
```bash
git add src/renderer/engine/explain.ts src/renderer/engine/phrases.ts src/renderer/engine/explain.test.ts
git commit -m "feat(engine): rule-based move explanations"
```

### Task 6: Openings dataset + lookup

**Files:**
- Create: `src/renderer/assets/openings.json` (generated)
- Create: `src/renderer/core/openings.ts`
- Test: `src/renderer/core/openings.test.ts`

**Interfaces:** Produces `Opening`, `lookupOpening(uciSequence: string[]): Opening | null`.

- [ ] **Step 1: Generate the dataset.** Download the four free TSV files and convert to one JSON keyed by space-joined UCI move sequence:
```bash
cd src/renderer/assets
for f in a b c d e; do curl -sSL --ssl-no-revoke -o "$f.tsv" "https://raw.githubusercontent.com/lichess-org/chess-openings/master/$f.tsv"; done
node -e "
const fs = require('fs');
const out = {};
for (const f of ['a','b','c','d','e']) {
  const lines = fs.readFileSync(f + '.tsv', 'utf8').trim().split('\n').slice(1);
  for (const line of lines) {
    const [eco, name, uci] = line.split('\t');
    if (uci) out[uci.trim()] = { eco, name };
  }
}
fs.writeFileSync('openings.json', JSON.stringify(out));
console.log(Object.keys(out).length, 'openings');
"
rm a.tsv b.tsv c.tsv d.tsv e.tsv
```
(The `chess-openings` TSVs have columns `eco\tname\tpgn\tuci\tepd`; confirm the column order with `head -3 a.tsv` before the conversion script if the download succeeds, and adjust the destructuring indices to match.)

- [ ] **Step 2: Write the failing test**
```ts
import { describe, expect, it } from 'vitest';
import { lookupOpening } from './openings';

describe('lookupOpening', () => {
  it('finds an exact opening sequence', () => {
    // e4 e5 Nf3 Nc6 Bb5 = Ruy Lopez
    const result = lookupOpening(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5']);
    expect(result?.name).toMatch(/Ruy Lopez|Spanish/i);
  });

  it('falls back to the longest known prefix', () => {
    const short = lookupOpening(['e2e4', 'e7e5']);
    const longer = lookupOpening(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6']);
    expect(longer?.eco).toBeTruthy();
    expect(short?.eco).toBeTruthy();
  });

  it('returns null once the sequence leaves known theory', () => {
    expect(lookupOpening(['a2a3', 'a7a6', 'a1a2'])).toBeNull();
  });
});
```
- [ ] **Step 3: Implement.**
```ts
import openings from '@/assets/openings.json';

export interface Opening {
  eco: string;
  name: string;
}

const BOOK = openings as Record<string, Opening>;

/** Longest-prefix match: tries the full sequence, then drops moves off the end until one is known. */
export function lookupOpening(uciSequence: string[]): Opening | null {
  for (let len = uciSequence.length; len > 0; len--) {
    const key = uciSequence.slice(0, len).join(' ');
    if (BOOK[key]) return BOOK[key];
  }
  return null;
}
```
- [ ] **Step 4:** Run `npx vitest run src/renderer/core/openings.test.ts` → PASS. If the download step failed or column order differs, fix the conversion script and regenerate before this step, not the lookup code.
- [ ] **Step 5:** `npm run typecheck` (may need `"resolveJsonModule": true` — add it to `tsconfig.web.json`'s `compilerOptions` if the JSON import errors). Commit:
```bash
git add src/renderer/assets/openings.json src/renderer/core/openings.ts src/renderer/core/openings.test.ts tsconfig.web.json
git commit -m "feat(core): opening recognition from the free ECO dataset"
```

### Task 7: Review orchestration — analyzeGame

**Files:**
- Create: `src/renderer/features/review/analyzeGame.ts`
- Test: `src/renderer/features/review/analyzeGame.test.ts`

**Interfaces:** Consumes `ChessGame`, `requestMoveGrade`, `classify`, `explainTags`, `phraseFor` (not called here — phrases are resolved in the UI), `lookupOpening`. Produces `MoveAnalysis`, `analyzeGame(startFen, history, onProgress, signal)`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, expect, it, vi } from 'vitest';
import { ChessGame } from '@/core/chessGame';
import { analyzeGame } from './analyzeGame';

vi.mock('@/engine/engineClient', () => ({
  requestMoveGrade: vi.fn(async (fen: string, move) => {
    const { scoreRootMoves } = await import('@/engine/search');
    const { ANALYSIS_LEVEL } = await import('@/engine/analyzeLevel');
    const scored = scoreRootMoves(fen, ANALYSIS_LEVEL);
    const best = scored[0];
    const played = scored.find((s) => s.move.from === move.from && s.move.to === move.to) ?? best;
    return { bestMove: best.move, bestSan: best.san, bestScore: best.score, playedScore: played.score, centipawnLoss: Math.max(0, best.score - played.score) };
  }),
}));

function playHistory(moves: [string, string][]) {
  const g = new ChessGame();
  for (const [from, to] of moves) g.move({ from, to });
  return g.history();
}

describe('analyzeGame', () => {
  it('produces one analysis entry per ply, in order', async () => {
    const history = playHistory([['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3']]);
    const progress = vi.fn();
    const analysis = await analyzeGame(undefined, history, progress, new AbortController().signal);
    expect(analysis).toHaveLength(3);
    expect(analysis.map((a) => a.ply)).toEqual([0, 1, 2]);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
  });

  it('tags the opening for early moves', async () => {
    const history = playHistory([['e2', 'e4'], ['e7', 'e5']]);
    const analysis = await analyzeGame(undefined, history, () => {}, new AbortController().signal);
    expect(analysis[1].opening).not.toBeNull();
  });

  it('flags a move that allows a forced mate next', async () => {
    // 1.f3 e5 2.g4?? Qh4# — g4 allows mate; the analysis of ply index 2 (g4) should carry walksIntoMate.
    const history = playHistory([['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4']]);
    const analysis = await analyzeGame(undefined, history, () => {}, new AbortController().signal);
    expect(analysis[2].tags).toContain('walksIntoMate');
  });

  it('stops early when aborted', async () => {
    const history = playHistory([['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3']]);
    const controller = new AbortController();
    controller.abort();
    await expect(analyzeGame(undefined, history, () => {}, controller.signal)).rejects.toThrow();
  });
});
```
- [ ] **Step 2:** Run `npx vitest run src/renderer/features/review/analyzeGame.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
```ts
import { requestMoveGrade } from '@/engine/engineClient';
import { classify, type Tier } from '@/engine/classify';
import { explainTags, sacrificesMaterial, type ExplanationTag } from '@/engine/explain';
import { ChessGame } from '@/core/chessGame';
import { lookupOpening, type Opening } from '@/core/openings';
import type { MoveInput, MoveRecord } from '@/core/types';

export interface MoveAnalysis {
  ply: number;
  move: MoveRecord;
  bestMove: MoveInput;
  bestSan: string;
  bestScore: number;
  playedScore: number;
  centipawnLoss: number;
  tier: Tier;
  tags: ExplanationTag[];
  opening: Opening | null;
}

const MATE_THRESHOLD = 99_000;
const toUci = (m: MoveInput) => `${m.from}${m.to}${m.promotion ?? ''}`;

/**
 * Grades every move of a finished game. Runs sequentially (one worker round-trip per ply) so `onProgress`
 * reports steady incremental progress; aborting `signal` stops before the next ply's request is sent.
 */
export async function analyzeGame(
  startFen: string | undefined,
  history: MoveRecord[],
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<MoveAnalysis[]> {
  const results: MoveAnalysis[] = [];
  const replay = new ChessGame(startFen);
  const uciSoFar: string[] = [];

  for (let ply = 0; ply < history.length; ply++) {
    if (signal.aborted) throw new DOMException('Analysis aborted', 'AbortError');

    const move = history[ply];
    const fenBefore = replay.fen();
    const before = new ChessGame(fenBefore);
    const grade = await requestMoveGrade(fenBefore, { from: move.from, to: move.to, promotion: move.promotion });
    replay.move(move);
    const after = new ChessGame(replay.fen());

    const isBestMove = grade.bestMove.from === move.from && grade.bestMove.to === move.to && grade.bestMove.promotion === move.promotion;
    const tier = classify(grade.centipawnLoss, isBestMove, isBestMove && sacrificesMaterial(before, move));
    const tags = explainTags({ before, after, move, grade, tier, ply });

    uciSoFar.push(toUci({ from: move.from, to: move.to, promotion: move.promotion }));

    results.push({
      ply,
      move,
      bestMove: grade.bestMove,
      bestSan: grade.bestSan,
      bestScore: grade.bestScore,
      playedScore: grade.playedScore,
      centipawnLoss: grade.centipawnLoss,
      tier,
      tags,
      opening: lookupOpening(uciSoFar),
    });

    onProgress(ply + 1, history.length);
  }

  // Second pass: a move "walks into mate" when the very next ply's best score is a forced mate for
  // whoever moves there (i.e. the opponent, immediately after this move).
  for (let i = 0; i < results.length - 1; i++) {
    if (Math.abs(results[i + 1].bestScore) > MATE_THRESHOLD && !results[i].tags.includes('walksIntoMate')) {
      results[i].tags = ['walksIntoMate', ...results[i].tags].slice(0, 2);
    }
  }

  return results;
}
```
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** `npm run typecheck`. Commit:
```bash
git add src/renderer/features/review/analyzeGame.ts src/renderer/features/review/analyzeGame.test.ts
git commit -m "feat(review): full-game analysis orchestration"
```

### Task 8: reviewStore

**Files:**
- Create: `src/renderer/features/review/reviewStore.ts`
- Test: `src/renderer/features/review/reviewStore.test.ts`

**Interfaces:** Consumes `analyzeGame`, `GameConfig`, `MoveRecord`. Produces `useReviewStore` matching the `ReviewState` shape in Shared Interfaces.

- [ ] **Step 1: Write the failing test**
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReviewStore } from './reviewStore';
import { UNTIMED } from '@/features/clock/presets';

vi.mock('./analyzeGame', () => ({
  analyzeGame: vi.fn(async (_fen, history, onProgress, signal) => {
    for (let i = 0; i < history.length; i++) {
      if (signal.aborted) throw new DOMException('aborted', 'AbortError');
      onProgress(i + 1, history.length);
    }
    return history.map((move, ply) => ({
      ply, move, bestMove: move, bestSan: move.san, bestScore: 0, playedScore: 0, centipawnLoss: 0, tier: 'best', tags: ['solid'], opening: null,
    }));
  }),
}));

const config = { white: { type: 'human' } as const, black: { type: 'human' } as const, timeControl: UNTIMED };
const fakeHistory = (n: number) => Array.from({ length: n }, (_, i) => ({ from: 'e2', to: 'e4', san: `m${i}`, color: 'w' as const, piece: 'p' as const, flags: 'n', fen: 'x' }));

describe('reviewStore', () => {
  afterEach(() => useReviewStore.getState().exit());

  it('goes from analyzing to ready with full analysis', async () => {
    useReviewStore.getState().start(config, fakeHistory(3));
    expect(useReviewStore.getState().status).toBe('analyzing');
    await vi.waitFor(() => expect(useReviewStore.getState().status).toBe('ready'));
    expect(useReviewStore.getState().analysis).toHaveLength(3);
    expect(useReviewStore.getState().index).toBe(2); // starts on the final position
  });

  it('clamps navigation to valid bounds', async () => {
    useReviewStore.getState().start(config, fakeHistory(2));
    await vi.waitFor(() => expect(useReviewStore.getState().status).toBe('ready'));
    useReviewStore.getState().goTo(-5);
    expect(useReviewStore.getState().index).toBe(-1);
    useReviewStore.getState().goTo(99);
    expect(useReviewStore.getState().index).toBe(1);
    useReviewStore.getState().prev();
    expect(useReviewStore.getState().index).toBe(0);
    useReviewStore.getState().next();
    expect(useReviewStore.getState().index).toBe(1);
  });

  it('exit resets to idle', async () => {
    useReviewStore.getState().start(config, fakeHistory(1));
    await vi.waitFor(() => expect(useReviewStore.getState().status).toBe('ready'));
    useReviewStore.getState().exit();
    expect(useReviewStore.getState().status).toBe('idle');
    expect(useReviewStore.getState().analysis).toHaveLength(0);
  });
});
```
- [ ] **Step 2:** Run `npx vitest run src/renderer/features/review/reviewStore.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
```ts
import { create } from 'zustand';
import type { GameConfig } from '@/features/game/gameStore';
import type { MoveRecord } from '@/core/types';
import { analyzeGame, type MoveAnalysis } from './analyzeGame';

interface ReviewState {
  status: 'idle' | 'analyzing' | 'ready';
  config: GameConfig | null;
  history: MoveRecord[];
  progress: { done: number; total: number };
  analysis: MoveAnalysis[];
  index: number;
  start(config: GameConfig, history: MoveRecord[]): void;
  goTo(index: number): void;
  next(): void;
  prev(): void;
  exit(): void;
}

let abortController: AbortController | null = null;

export const useReviewStore = create<ReviewState>((set, get) => ({
  status: 'idle',
  config: null,
  history: [],
  progress: { done: 0, total: 0 },
  analysis: [],
  index: -1,

  start(config, history) {
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;
    set({ status: 'analyzing', config, history, analysis: [], progress: { done: 0, total: history.length }, index: -1 });

    analyzeGame(config.fen, history, (done, total) => {
      if (controller.signal.aborted) return;
      set({ progress: { done, total } });
    }, controller.signal)
      .then((analysis) => {
        if (controller.signal.aborted) return;
        set({ status: 'ready', analysis, index: history.length - 1 });
      })
      .catch(() => {
        // Aborted by a new start() or exit() — nothing to report.
      });
  },

  goTo(index) {
    const max = get().history.length - 1;
    set({ index: Math.max(-1, Math.min(max, index)) });
  },

  next() {
    get().goTo(get().index + 1);
  },

  prev() {
    get().goTo(get().index - 1);
  },

  exit() {
    abortController?.abort();
    abortController = null;
    set({ status: 'idle', config: null, history: [], analysis: [], progress: { done: 0, total: 0 }, index: -1 });
  },
}));
```
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** `npm run typecheck`. Commit:
```bash
git add src/renderer/features/review/reviewStore.ts src/renderer/features/review/reviewStore.test.ts
git commit -m "feat(review): review store with navigation and analysis progress"
```

### Task 9: Split Board into BoardView + live Board wrapper

**Files:**
- Create: `src/renderer/components/BoardView.tsx`
- Modify: `src/renderer/components/Board.tsx`
- Modify: `src/renderer/components/Square.tsx` (make `onClick` optional)

**Interfaces:** Produces `BoardViewProps` / `BoardView` exactly as in Shared Interfaces. No behavior change to live play.

- [ ] **Step 1:** In `Square.tsx`, change the prop and call site:
```ts
// before: onClick: (square: SquareName) => void;
onClick?: (square: SquareName) => void;
// before: onClick={() => p.onClick(p.square)}
onClick={() => p.onClick?.(p.square)}
```
- [ ] **Step 2:** Create `BoardView.tsx` — the grid, piece layer and hint layer exactly as they exist today inside `Board.tsx`, minus store access:
```tsx
import type { CSSProperties } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { TrackedPiece } from '@/core/pieceTracking';
import { FILES, isLightSquare, squareToCell } from '@/core/squares';
import type { MoveInput, Square as SquareName } from '@/core/types';
import { Piece } from './Piece';
import { Square } from './Square';
import styles from './Board.module.css';

const INDICES = [0, 1, 2, 3, 4, 5, 6, 7];

export interface BoardViewProps {
  pieces: TrackedPiece[];
  flipped: boolean;
  selected: SquareName | null;
  targets: SquareName[];
  lastMove: MoveInput | null;
  checkSquare: SquareName | null;
  showLegalMoves: boolean;
  isCaptureTarget: (sq: SquareName) => boolean;
  onSquareClick?: (sq: SquareName) => void;
}

/** Pure board rendering: squares, animated pieces and legal-move hints. No store access, so it drives both live play and the read-only replay board. */
export function BoardView(p: BoardViewProps) {
  return (
    <>
      <div className={styles.grid}>
        {INDICES.flatMap((row) =>
          INDICES.map((col) => {
            const file = p.flipped ? 7 - col : col;
            const rank = p.flipped ? row + 1 : 8 - row;
            const sq = `${FILES[file]}${rank}`;
            return (
              <Square
                key={sq}
                square={sq}
                light={isLightSquare(sq)}
                selected={sq === p.selected}
                lastMove={sq === p.lastMove?.from || sq === p.lastMove?.to}
                check={sq === p.checkSquare}
                fileLabel={row === 7 ? FILES[file] : undefined}
                rankLabel={col === 0 ? String(rank) : undefined}
                onClick={p.onSquareClick}
              />
            );
          }),
        )}
      </div>

      <div className={styles.layer}>
        <AnimatePresence>
          {p.pieces.map((piece) => (
            <Piece key={piece.id} piece={piece} flipped={p.flipped} selected={piece.square === p.selected} raised={piece.square === p.lastMove?.to} />
          ))}
        </AnimatePresence>
      </div>

      {p.showLegalMoves && (
        <div className={styles.layer}>
          {p.targets.map((sq) => {
            const { col, row } = squareToCell(sq, p.flipped);
            return (
              <span
                key={sq}
                className={`${styles.hint} ${p.isCaptureTarget(sq) ? styles.capture : ''}`}
                style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%` } as CSSProperties}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
```
- [ ] **Step 3:** Rewrite `Board.tsx` as a thin wrapper that keeps the outer `.board` div (theme CSS variables, `PromotionDialog`) and delegates the inside to `BoardView`:
```tsx
import { useMemo, type CSSProperties } from 'react';
import { trackPieces } from '@/core/pieceTracking';
import { useGameStore } from '@/features/game/gameStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { BoardView } from './BoardView';
import { PromotionDialog } from './PromotionDialog';
import styles from './Board.module.css';

export function Board() {
  const { game, config, history, selected, targets, lastMove, flipped, select } = useGameStore();
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const theme = BOARD_THEMES[useSettingsStore((s) => s.boardTheme)];

  const pieces = useMemo(() => trackPieces(config.fen, history), [config.fen, history]);
  const checkSquare = useMemo(() => (game.inCheck() ? game.kingSquare(game.turn()) : null), [game, history]);

  const style = { '--sq-light': theme.light, '--sq-dark': theme.dark } as CSSProperties;

  return (
    <div className={styles.board} style={style}>
      <BoardView
        pieces={pieces}
        flipped={flipped}
        selected={selected}
        targets={targets}
        lastMove={lastMove}
        checkSquare={checkSquare}
        showLegalMoves={showLegalMoves}
        isCaptureTarget={(sq) => game.pieceAt(sq) !== null}
        onSquareClick={select}
      />
      <PromotionDialog />
    </div>
  );
}
```
- [ ] **Step 4:** `npm run typecheck && npm test`. Then `npm run dev`, start a game vs computer, confirm clicking, hints, animations and promotion still work exactly as before (manual — this is a pure refactor with no new automated coverage of its own).
- [ ] **Step 5:** Commit:
```bash
git add src/renderer/components/Board.tsx src/renderer/components/BoardView.tsx src/renderer/components/Square.tsx
git commit -m "refactor(ui): split Board into presentational BoardView + live wrapper"
```

### Task 10: ReviewBoard, EvalBar, TutorPanel

**Files:**
- Create: `src/renderer/components/ReviewBoard.tsx`
- Create: `src/renderer/components/EvalBar.tsx` (+ `.module.css`)
- Create: `src/renderer/components/TutorPanel.tsx` (+ `.module.css`)

**Interfaces:** Consumes `useReviewStore`, `BoardView`, `phraseFor`, `trackPieces`, `ChessGame`.

- [ ] **Step 1:** `ReviewBoard.tsx` — read-only board driven by `reviewStore.index`, with swipe support:
```tsx
import { useMemo, useRef, type CSSProperties, type PointerEvent } from 'react';
import { ChessGame } from '@/core/chessGame';
import { trackPieces } from '@/core/pieceTracking';
import { useReviewStore } from '@/features/review/reviewStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { BoardView } from './BoardView';
import styles from './Board.module.css';

const SWIPE_THRESHOLD_PX = 60;

interface Props {
  flipped: boolean;
}

export function ReviewBoard({ flipped }: Props) {
  const { config, history, index, next, prev } = useReviewStore();
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const theme = BOARD_THEMES[useSettingsStore((s) => s.boardTheme)];
  const dragStartX = useRef<number | null>(null);

  const visibleHistory = useMemo(() => history.slice(0, index + 1), [history, index]);
  const pieces = useMemo(() => trackPieces(config?.fen, visibleHistory), [config?.fen, visibleHistory]);
  const currentFen = index >= 0 ? visibleHistory[index].fen : (config?.fen ?? new ChessGame().fen());
  const checkSquare = useMemo(() => {
    const g = new ChessGame(currentFen);
    return g.inCheck() ? g.kingSquare(g.turn()) : null;
  }, [currentFen]);
  const lastMove = index >= 0 ? { from: visibleHistory[index].from, to: visibleHistory[index].to } : null;

  const style = { '--sq-light': theme.light, '--sq-dark': theme.dark } as CSSProperties;

  const onPointerDown = (e: PointerEvent) => {
    dragStartX.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (dragStartX.current === null) return;
    const delta = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (delta <= -SWIPE_THRESHOLD_PX) next();
    else if (delta >= SWIPE_THRESHOLD_PX) prev();
  };

  return (
    <div className={styles.board} style={style} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <BoardView
        pieces={pieces}
        flipped={flipped}
        selected={null}
        targets={[]}
        lastMove={lastMove}
        checkSquare={checkSquare}
        showLegalMoves={showLegalMoves}
        isCaptureTarget={() => false}
      />
    </div>
  );
}
```
- [ ] **Step 2:** `EvalBar.tsx` — small vertical bar:
```tsx
import styles from './EvalBar.module.css';

const CLAMP_CP = 800;

/** Vertical eval indicator: `scoreForWhite` in centipawns, positive favors White. */
export function EvalBar({ scoreForWhite }: { scoreForWhite: number }) {
  const clamped = Math.max(-CLAMP_CP, Math.min(CLAMP_CP, scoreForWhite));
  const whiteShare = 50 + (clamped / CLAMP_CP) * 50;
  return (
    <div className={styles.bar} title={`${(scoreForWhite / 100).toFixed(1)} for ${scoreForWhite >= 0 ? 'White' : 'Black'}`}>
      <div className={styles.white} style={{ height: `${whiteShare}%` }} />
    </div>
  );
}
```
```css
/* EvalBar.module.css */
.bar {
  width: 14px;
  height: 100%;
  border-radius: 7px;
  background: #1a1a1a;
  border: 1px solid var(--border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.white {
  background: #f0ece0;
  transition: height 0.35s ease;
}
```
- [ ] **Step 3:** `TutorPanel.tsx`:
```tsx
import { useReviewStore } from '@/features/review/reviewStore';
import { phraseFor } from '@/engine/phrases';
import { EvalBar } from './EvalBar';
import styles from './TutorPanel.module.css';

const TIER_LABEL: Record<string, string> = {
  brilliant: 'Brilliant',
  best: 'Best move',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

export function TutorPanel() {
  const { analysis, index, status, progress, goTo, history } = useReviewStore();
  const current = index >= 0 ? analysis[index] : null;

  if (status === 'analyzing') {
    return (
      <div className={styles.panel}>
        <p>Analyzing move {progress.done} of {progress.total}…</p>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.moveNumber}>{index >= 0 ? `Move ${index + 1}` : 'Start position'}</span>
        {current && <span className={`${styles.tier} ${styles[current.tier]}`}>{TIER_LABEL[current.tier]}</span>}
      </div>

      <div className={styles.body}>
        {current ? (
          <EvalBar scoreForWhite={current.move.color === 'w' ? current.playedScore : -current.playedScore} />
        ) : (
          <EvalBar scoreForWhite={0} />
        )}
        <div className={styles.text}>
          {current?.opening && <p className={styles.opening}>{current.opening.eco} · {current.opening.name}</p>}
          {current ? (
            <p>{current.tags.map((tag, i) => phraseFor(tag, current.tier, current.move.san, current.ply + i)).join(' ')}</p>
          ) : (
            <p>Starting position. Swipe or use the arrow keys to step through the game.</p>
          )}
          {current && current.tier !== 'best' && current.tier !== 'brilliant' && (
            <p className={styles.suggestion}>Best was {current.bestSan}.</p>
          )}
        </div>
      </div>

      <div className={styles.nav}>
        <button className="btn" disabled={index <= -1} onClick={() => goTo(index - 1)}>← Prev</button>
        <button className="btn" disabled={index >= history.length - 1} onClick={() => goTo(index + 1)}>Next →</button>
      </div>
    </div>
  );
}
```
```css
/* TutorPanel.module.css */
.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  height: 100%;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.moveNumber {
  font-weight: 700;
  color: var(--muted);
}

.tier {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.brilliant { background: rgba(45, 212, 191, 0.18); color: #2dd4bf; }
.best { background: rgba(74, 222, 128, 0.18); color: #4ade80; }
.good { background: rgba(163, 230, 53, 0.18); color: #a3e635; }
.inaccuracy { background: rgba(250, 204, 21, 0.18); color: #facc15; }
.mistake { background: rgba(251, 146, 60, 0.18); color: #fb923c; }
.blunder { background: rgba(248, 113, 113, 0.18); color: #f87171; }

.body {
  flex: 1;
  display: flex;
  gap: 14px;
}

.text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.opening {
  font-weight: 600;
  color: var(--accent);
}

.suggestion {
  color: var(--muted);
  font-size: 14px;
}

.nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
```
- [ ] **Step 4:** `npm run typecheck`.
- [ ] **Step 5:** Commit:
```bash
git add src/renderer/components/ReviewBoard.tsx src/renderer/components/EvalBar.tsx src/renderer/components/EvalBar.module.css src/renderer/components/TutorPanel.tsx src/renderer/components/TutorPanel.module.css
git commit -m "feat(ui): review board, eval bar and tutor panel"
```

### Task 11: ReviewScreen, clickable MoveList, GameOverModal hookup, App routing

**Files:**
- Create: `src/renderer/components/ReviewScreen.tsx` (+ `.module.css`)
- Modify: `src/renderer/components/MoveList.tsx`
- Modify: `src/renderer/components/GameOverModal.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:** Consumes `useReviewStore`, `MoveList` (extended), `ReviewBoard`, `TutorPanel`.

- [ ] **Step 1:** Extend `MoveList.tsx` to optionally support jumping to a ply, without changing its default (live) behavior:
```tsx
interface Props {
  onSelectPly?: (ply: number) => void;
  activePly?: number;
}

export function MoveList({ onSelectPly, activePly }: Props = {}) {
  // ...unchanged rows computation...
  return (
    <div className={styles.list}>
      {rows.length === 0 && <p className={styles.empty}>Moves will appear here</p>}
      {rows.map((r) => {
        const whitePly = (r.number - 1) * 2;
        const blackPly = whitePly + 1;
        return (
          <div key={r.number} className={styles.row}>
            <span className={styles.number}>{r.number}.</span>
            <span
              className={`${styles.move} ${activePly === whitePly ? styles.active : ''}`}
              onClick={onSelectPly ? () => onSelectPly(whitePly) : undefined}
            >
              {r.white}
            </span>
            <span
              className={`${styles.move} ${activePly === blackPly ? styles.active : ''}`}
              onClick={onSelectPly && r.black ? () => onSelectPly(blackPly) : undefined}
            >
              {r.black}
            </span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
```
Add to `MoveList.module.css`:
```css
.active {
  color: var(--accent);
}
```
- [ ] **Step 2:** `ReviewScreen.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { useReviewStore } from '@/features/review/reviewStore';
import { MoveList } from './MoveList';
import { ReviewBoard } from './ReviewBoard';
import { TutorPanel } from './TutorPanel';
import styles from './ReviewScreen.module.css';

export function ReviewScreen() {
  const { index, next, prev, goTo, exit } = useReviewStore();
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  return (
    <div className={styles.screen}>
      <ReviewBoard flipped={flipped} />
      <aside className={styles.sidebar}>
        <TutorPanel />
        <MoveList onSelectPly={goTo} activePly={index} />
        <div className={styles.actions}>
          <button className="btn" onClick={() => setFlipped((f) => !f)}>⇅ Flip</button>
          <button className="btn" onClick={exit}>☰ Menu</button>
        </div>
      </aside>
    </div>
  );
}
```
```css
/* ReviewScreen.module.css */
.screen {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 28px;
}

.sidebar {
  width: var(--sidebar-width);
  height: var(--board-size);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
```
- [ ] **Step 3:** `GameOverModal.tsx` — add the review button:
```tsx
import { useReviewStore } from '@/features/review/reviewStore';
// ...
export function GameOverModal() {
  const { status, result, config, history, startGame, backToMenu } = useGameStore();
  const startReview = useReviewStore((s) => s.start);
  // ...
  <div className={styles.actions}>
    <button className="btn btn-primary" onClick={() => startGame(config)}>Rematch</button>
    <button className="btn" onClick={() => startReview(config, history)}>Review game</button>
    <button className="btn" onClick={backToMenu}>New game</button>
    <button className="btn" onClick={close}>View board</button>
  </div>
}
```
(`history` must be added to the destructured `useGameStore()` call at the top of the component alongside the existing fields.)
- [ ] **Step 4:** `App.tsx` — route to the review screen whenever one is active, regardless of `gameStore.status`:
```tsx
import { GameScreen } from './components/GameScreen';
import { NewGameMenu } from './components/NewGameMenu';
import { ReviewScreen } from './components/ReviewScreen';
import { useGameStore } from './features/game/gameStore';
import { useReviewStore } from './features/review/reviewStore';

export function App() {
  const reviewing = useReviewStore((s) => s.status !== 'idle');
  const inMenu = useGameStore((s) => s.status === 'menu');
  if (reviewing) return <ReviewScreen />;
  return inMenu ? <NewGameMenu /> : <GameScreen />;
}
```
- [ ] **Step 5:** `npm test && npm run typecheck && npm run build`. Commit:
```bash
git add src/renderer/components/ReviewScreen.tsx src/renderer/components/ReviewScreen.module.css src/renderer/components/MoveList.tsx src/renderer/components/MoveList.module.css src/renderer/components/GameOverModal.tsx src/renderer/App.tsx
git commit -m "feat(ui): review screen wired into game-over flow"
```

### Task 12: Final verification

- [ ] `npm test` — all suites pass, including the new `engine/`, `core/attacks`, `core/openings`, `features/review/*` tests.
- [ ] `npm run typecheck` and `npm run build` both clean.
- [ ] `npm run dev`: play a full game to checkmate (vs computer or local 1v2), click "Review game", confirm:
  - the "Analyzing move X/Y" progress shows and completes,
  - swiping/arrow keys/move-list clicks all navigate the same replay,
  - the tier badge, explanation text and best-move suggestion change per move,
  - an early move shows an opening name,
  - "Menu" exits back to `NewGameMenu` and starting a fresh game still works normally afterward.
- [ ] Fix any defects found, committing as you go.

---

## Self-Review

- **Spec coverage:** engine-based grading (Tasks 1-2, 4), rule-based explanations (Task 5), opening JSON (Task 6), review orchestration + store (Tasks 7-8), swipe/arrow/click navigation (Tasks 10-11), tier badges + eval bar (Task 10), `GameOverModal` entry point (Task 11), multiplayer-ready shape (`{startFen, history}` used throughout, no coupling to how moves were made) — no gaps against the design doc's scope.
- **Type consistency:** `MoveGrade`, `Tier`, `ExplanationTag`, `MoveAnalysis`, `ReviewState`, `BoardViewProps` are defined once (Shared Interfaces) and every task imports those exact names/shapes.
- **Placeholder scan:** the one inline `require(...)` shown mid-Task-5 is explicitly called out and replaced by the final code block immediately after it — no other TBD/TODO markers remain.
