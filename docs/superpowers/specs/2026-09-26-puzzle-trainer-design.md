# Puzzle Trainer — Design

A linear, difficulty-ladder puzzle trainer, reusing the engine/explain/board code already built for the
move tutor, backed by a curated offline slice of the free Lichess puzzle database.

## Data (already generated and verified)

`src/renderer/assets/puzzles.json` — **855 puzzles**, ratings 400–1398, sorted into **8 stages** (~99–108
each) covering beginner-relevant themes: `mateIn1`, `mateIn2`, `hangingPiece`, `fork`, `pin`, `skewer`,
`discoveredAttack`, `trappedPiece`, `backRankMate`.

```ts
interface PuzzleData {
  id: string;
  fen: string;        // the actual position to solve (setup move already applied)
  solution: string[]; // alternating [player, opponent, player, ...] moves in UCI, e.g. "e2e4" / "e7e8q"
  rating: number;
  stage: number;       // 0-7, easiest to hardest
  themes: string[];
}
```

Generated via `scripts/generate-puzzles/` (documented, re-runnable) from `lichess_db_puzzle.csv.zst`
(CC0): stream-decompressed and bucketed by (stage, primary theme) with a bounded top-N-by-popularity
heap so the whole ~5M-row, 300MB source is scanned once without ever materializing it in memory; then
each candidate's setup move is applied and its full solution replayed via `chess.js` to validate
legality before inclusion. All 855 candidates validated cleanly (0 rejected).

## Solving loop

Puzzle `fen` is the position the player must move in. `solution[0]` is the move the player needs to
find; if correct, `solution[1]` (the opponent's scripted reply) auto-plays; then `solution[2]` is the
player's next move; and so on until `solution` is exhausted (solved). The opponent's replies come from
the puzzle data itself, not our engine — the puzzle already specifies the intended line.

A wrong attempt doesn't just say "wrong": it's graded with the **existing** `analyzeMove` (from the move
tutor) against the current position, and `explainTags`/`phraseFor` produce the same kind of real
explanation used in Review ("That hangs your rook"), reusing that code untouched.

## Components

- `features/puzzle/puzzles.ts` — loads/groups the bundled JSON by stage (pure, no store).
- `features/puzzle/puzzleStore.ts` — Zustand store: current stage/puzzle, live `ChessGame`, selection
  state (mirrors `gameStore`'s `select`/targets pattern), solution progress, status
  (`playing | correct | wrong | solved`), and `{furthestStage, furthestPuzzle, solvedCount}` persisted
  to localStorage (same `zustand/persist` pattern as `settingsStore`).
- `components/PuzzleBoard.tsx` — third thin wrapper around the shared `BoardView` (alongside `Board` and
  `ReviewBoard`): interactive like `Board`, driven by `puzzleStore` instead of `gameStore`.
- `components/PuzzleScreen.tsx` — board + stage/progress header + feedback panel (reuses `EvalBar`-style
  presentation for consistency) + Retry/Next.
- Entry point: a "Puzzles" button on `NewGameMenu`, routed in `App.tsx` alongside the existing
  menu/game/review screens.

## Testing

- `puzzles.test.ts`: **every one of the 855 bundled puzzles' full solution replays legally** through
  `ChessGame` — an automatic sanity check on the data itself, not just the loader code.
- `puzzleStore.test.ts`: correct move advances/auto-plays opponent reply/eventually solves; wrong move
  sets status without corrupting position; retry/next/stage progression; persistence.

## Non-goals (v1)

Theme-picker menu (ladder only), adaptive/rating-based matchmaking, hints beyond the wrong-move
explanation, timed rush mode.
