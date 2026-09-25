# B-Chess Phase 1.5 — Move Tutor & Replay

Post-game review: every move graded against the engine's own best move, explained in plain language, browsable like a spectator with swipe/arrow navigation.

## Why not a lookup table

Chess has on the order of 10^44 legal positions. No JSON, no database holds "position → best move" for arbitrary states. The only genuinely finite, freely available table is **opening theory** (a few thousand known move orders) — everything past that is graded live by our own engine.

## Scope

**In:** post-game review screen, 6-tier move grading, rule-based plain-language explanations, opening name recognition, swipe/arrow/click navigation through the finished game.
**Out (this phase):** live in-game feedback during play, multiplayer game review (architecture doesn't block it, but there's no multiplayer to review yet), a stronger/replaced chess engine.

## Architecture

```
src/renderer/
  engine/
    analyzeLevel.ts     analysis search config (depth/time, separate from play levels)
    analyze.ts          analyzeMove(fen, played) + analyzeGame(startFen, history, onProgress)
    classify.ts         centipawn loss -> tier (pure)
    explain.ts           detectors: position -> tag[] (pure, chess.js-based)
    phrases.ts           tag+tier -> template sentence(s) (data)
  core/
    openings.ts          longest-prefix lookup over the ECO table
  assets/
    openings.json        generated from the free Lichess chess-openings TSVs
  features/review/
    reviewStore.ts        snapshot + analysis progress + navigation index
  components/
    BoardView.tsx         presentational board (existing Board.tsx split into this + a thin wrapper)
    ReviewBoard.tsx        read-only board driven by reviewStore's index
    TutorPanel.tsx         tier badge, explanation, opening tag, eval bar, move nav
    EvalBar.tsx            vertical eval indicator
    ReviewScreen.tsx        layout: ReviewBoard + TutorPanel + clickable MoveList
```

Dependency rule unchanged: `components → features → core/engine`. `engine/*` and `core/openings.ts` stay framework-free and unit tested.

### Analysis (`engine/analyze.ts`)

Reuses the existing `Searcher` from `engine/search.ts` (Task 4 of phase 1), at a new fixed config — not tied to the easy/medium/hard play levels:

```ts
// engine/analyzeLevel.ts
export const ANALYSIS: LevelConfig = { depth: 4, timeMs: 800, quiescence: true, randomTopN: 1, randomChance: 0, noise: 0 };
```

```ts
// engine/analyze.ts
export interface MoveAnalysis {
  ply: number;               // index into history
  move: MoveRecord;
  bestMove: MoveInput;
  bestSan: string;
  bestScore: number;         // centipawns, mover's POV
  playedScore: number;       // centipawns, mover's POV
  centipawnLoss: number;     // max(0, bestScore - playedScore)
  tier: Tier;
  tags: ExplanationTag[];
  opening: { eco: string; name: string } | null;
}

export function analyzeMove(fenBefore: string, played: MoveInput): Omit<MoveAnalysis, 'ply' | 'move' | 'opening'>;

/** Analyzes every ply sequentially in the worker; reports progress as it goes. */
export function analyzeGame(
  startFen: string | undefined,
  history: MoveRecord[],
  onProgress: (done: number, total: number) => void,
): Promise<MoveAnalysis[]>;
```

`analyzeMove` runs `Searcher.search()` once on the pre-move position with `exact: true` semantics (every root move gets a real score, since we need both the best move's score and the played move's score from the same list — no second search). Sign convention matches the existing engine: scores are always from the side-to-move's point of view, so "loss" is always ≥ 0 for the mover.

Worker (`engine/worker.ts`) gets a second message kind (`{ type: 'analyze', fen, move }`) alongside the existing move-search kind, so play and analysis share one worker file.

### Classification (`engine/classify.ts`, pure)

```ts
export type Tier = 'brilliant' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export function classify(centipawnLoss: number, isBestMove: boolean, sacrificedMaterial: boolean): Tier;
```

Thresholds: best (loss ≤ 0), good (< 50), inaccuracy (< 100), mistake (< 300), else blunder. `brilliant` overrides `best` when the move is the engine's top choice *and* the mover's material dropped this move (a real sacrifice) while the score stayed level or improved — i.e. it looks bad on material but the engine agrees it's correct.

### Explanations (`engine/explain.ts` + `engine/phrases.ts`)

Detectors are small pure functions `(before: ChessGame, after: ChessGame, move: MoveRecord, analysis) => ExplanationTag | null`, run in priority order, first match(es) win (cap at 2 tags so the sentence stays short):

- `hangsPiece` — after the move, does the opponent have a capture on one of our pieces worth more than any recapture we get back?
- `missedMate` — the best move led to a forced mate the played move let slip.
- `walkedIntoTactic` — the opponent's reply (their engine best response) wins material immediately.
- `goodTrade` — a capture where the material exchanged is roughly even and the tier is good/best.
- `developsPiece` / `ignoresCenter` — opening-phase heuristics (piece count developed, pawn on d/e file) only tagged within the opening window (first 10 plies).
- `keepsAdvantage` / `throwsAwayAdvantage` — score before vs. after relative to the tier, for the closing message on an otherwise untagged move.

`phrases.ts` maps `tag` (and untagged fallback per `tier`) to one or more template strings with `{san}` / `{square}` placeholders; when multiple templates exist for a tag+tier pair, pick one at random per render (deterministic per move via a seeded pick, so re-viewing the same move doesn't reword it) to avoid repetitive tutoring on long games.

### Openings (`core/openings.ts`, `assets/openings.json`)

Build step (Task in the plan) converts the free `lichess-org/chess-openings` TSVs (`a.tsv` … `e.tsv`, ECO-classified, ~3000 rows, PGN move text + name) into one JSON: `{ [uciMoveSequence: string]: { eco: string; name: string } }`, keyed by the space-joined UCI moves from the start position. `core/openings.ts` does longest-matching-prefix lookup against the game's played UCI sequence, so it degrades gracefully mid-transposition and returns `null` once the game leaves book.

### Review store (`features/review/reviewStore.ts`)

```ts
interface ReviewState {
  status: 'idle' | 'analyzing' | 'ready';
  config: GameConfig | null;
  history: MoveRecord[];
  progress: { done: number; total: number };
  analysis: MoveAnalysis[];
  index: number;              // -1 = start position, history.length - 1 = final position

  start(config: GameConfig, history: MoveRecord[]): void;   // snapshots + kicks off analyzeGame
  goTo(index: number): void;
  next(): void;
  prev(): void;
  exit(): void;               // back to 'idle', returns to menu
}
```

Independent from `gameStore` on purpose: the finished game is a frozen snapshot, so starting a new game (which resets `gameStore`) can't corrupt an in-progress review.

### UI

- `Board.tsx` splits into `BoardView` (pure props: pieces derived from `{startFen, history up to index}`, `lastMove`, `flipped`, `selected`, `targets`, `checkSquare`, `onSquareClick?`) and a thin `Board` wrapper that connects it to `gameStore` exactly as today (no behavior change for phase 1).
- `ReviewBoard` connects `BoardView` to `reviewStore` instead — no `onSquareClick`, navigation comes from swipe/keys, not the board.
- `TutorPanel`: tier badge (color-coded: brilliant teal, best green, good lime, inaccuracy yellow, mistake orange, blunder red), the explanation sentence, opening name when present, an `EvalBar` (vertical gradient bar, position from `bestScore`/`playedScore` clamped ±800cp), and prev/next buttons.
- `ReviewScreen`: `ReviewBoard` + `TutorPanel` side by side, `MoveList` reused in a clickable mode (`onSelectPly?`) to jump straight to any move, "Exit to menu" button.
- Navigation: left/right arrow keys (window listener while mounted), pointer-drag swipe on the board (horizontal drag past a threshold = prev/next, matching the piece-slide animation direction), and move-list clicks.
- `GameOverModal` adds a "Review game" button that calls `reviewStore.start(config, history)` and switches `App` to the review screen.

### Error handling

- Worker analysis failure on a given ply: that ply's `MoveAnalysis` gets `tier: 'good'`/no tags and a generic "Analysis unavailable for this move" tag, rather than blocking the rest of the game's analysis.
- Leaving the review screen mid-analysis aborts the in-flight worker requests (same abort pattern as `gameStore`'s engine calls).

## Testing

- `classify.test.ts`: boundary values for every tier, brilliant override.
- `explain.test.ts`: one constructed FEN per detector (hanging piece, missed mate, good trade, opening heuristics).
- `openings.test.ts`: exact match, prefix match, transposition falls back to `null` past book.
- `reviewStore.test.ts`: start → analyzing → ready transitions, progress updates, index bounds (can't go below -1 or above history.length - 1), exit resets state, starting a new game while reviewing doesn't affect the snapshot.
- `analyze.test.ts`: `analyzeMove` returns loss 0 for the actual best move in a constructed position; returns positive loss for a known blunder (e.g. hanging the queen).

## Non-goals

Live in-game hints, a stronger third-party engine, reviewing anyone else's games, exporting the review (PGN/annotations) — all deferred.
