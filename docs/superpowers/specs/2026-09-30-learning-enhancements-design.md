# Learning Enhancements — Design Spec

**Goal:** Ship five learning-enhancement features — Blunder Vault, "Why not X?" move explorer, Opening Trainer, Game Summary, Glossary — all running entirely client-side, with zero network dependency, reusing the app's existing local chess engine and i18n infrastructure.

**Context:** B-Chess (React/TypeScript/Zustand/chess.js, Electron + PWA) already ships a fully offline local engine (Web Worker via `engineClient.ts`), a per-move analysis pipeline (`analyzeGame.ts`), persisted history stores (`savedGamesStore`, `gameHistoryStore`), and a complete i18n layer (`react-i18next`, 6 namespaces × en/he/es, established in the i18n feature this spec follows). This spec adds five features on top of that foundation without introducing any server dependency, new build tooling, or new runtime.

## Global Constraints

- No network calls anywhere in any of the five features — every computation runs against bundled/local data or the existing local Web Worker engine.
- All new user-facing strings go through `react-i18next`, in the existing namespace whose content they belong to, or the one new `glossary` namespace. All three locales (en/he/es) get real content, not placeholders — same rule the i18n plan followed.
- Any template that interpolates a piece name or phase name into Spanish text must route through i18next's `context` feature (mover/captured gender) or be reworded to avoid gendered-article agreement — the exact class of bug fixed in the i18n final review. This is checked per task, not assumed.
- Persisted stores follow the existing `zustand` + `persist` + `createJSONStorage(() => localStorage)` pattern, each with an explicit cap so `localStorage` never grows unbounded (mirroring `savedGamesStore`'s `MAX_SAVED_GAMES = 100`).
- Background work (Blunder Vault's auto-analysis) never blocks or competes with foreground engine use — a new game, a manual "Review game", or opening the Tutor panel always wins; background analysis aborts immediately when any of those start.
- Pure computation (filtering, scoring lookups, template composition) gets full TDD coverage. JSX wiring and screen-level UI follow this codebase's established convention: no dedicated component test, verified live in the browser instead (same split used throughout the i18n work).

## Non-Goals

- No cloud sync of the Blunder Vault, saved games, or quiz progress — everything stays on-device (consistent with the app having no backend at all).
- Opening Trainer v1 does not support branching/alternate book moves — single fixed line per curated opening, exactly as `CURATED_OPENINGS` already models it. (The bundled `assets/openings.json` has the variation data for a future branching version; not built now.)
- No spaced-repetition scheduling for the Blunder Vault or Opening Trainer — simplest "show me an unsolved one" selection for v1.
- Glossary has no contextual linking from Tutor/puzzle text in v1 (e.g., tapping "hanging" inside a tutor sentence to jump to its glossary entry) — it's a standalone searchable screen only.
- No difficulty tuning knobs for any of the new modes beyond what already exists (engine level, time control).

---

## 1. Blunder Vault

**What it is:** Puzzles generated from the player's own past blunders and mistakes, so practice targets their actual weaknesses instead of a generic puzzle bank.

### Architecture

Reuses `analyzeGame()` (`src/renderer/features/review/analyzeGame.ts`) — already computes, per ply, `fenBefore`, `bestMove`, `bestSan`, `tier`, `tags`, fully offline via the worker. Today it only runs when `reviewStore.start()` is called (i.e., the player clicks "Review game"). This feature triggers it automatically instead.

### Data Flow

1. `gameStore.ts`'s `finish()` (already calls `useSavedGamesStore.getState().saveGame(...)`) additionally enqueues the just-finished game onto a new background analysis queue.
2. The queue runs `analyzeGame()` one game at a time (never in parallel — there's one worker). It is aborted (via the same `AbortController` pattern `reviewStore` already uses) the instant `reviewStore.start()`, a new `gameStore.startGame()`, or another queue item is requested — background work never contends with anything the player is actively waiting on.
3. On completion, results with `tier === 'blunder' || tier === 'mistake'` are mapped to `VaultEntry` records and pushed into `blunderVaultStore` (capped, oldest evicted first, deduped by `fenBefore` so the same position isn't stored twice across games).
4. One-time backfill: on first load after this ships, if `blunderVaultStore` is empty and `savedGamesStore.games` is non-empty, the same queue processes up to the last 20 saved games (each already has full replayable `history` + `config`) so returning players aren't starting from zero.

### Components

- **New store:** `src/renderer/features/vault/blunderVaultStore.ts`
  ```ts
  export interface VaultEntry {
    id: string;              // `${sourceGameId}-${ply}`
    sourceGameId: string;
    ply: number;
    fenBefore: string;
    bestMove: MoveInput;
    bestSan: string;
    playedSan: string;
    tier: Tier;               // 'blunder' | 'mistake'
    tags: ExplanationTag[];
    capturedAt: string;        // ISO timestamp
  }
  interface BlunderVaultState {
    entries: VaultEntry[];
    solvedIds: string[];       // ids already solved, so "unsolved first" selection works
    addEntries(entries: VaultEntry[]): void;   // dedupes by fenBefore, caps at MAX_VAULT_ENTRIES
    markSolved(id: string): void;
    clear(): void;
  }
  ```
- **New module:** `src/renderer/features/vault/backgroundAnalysisQueue.ts` — the abortable, one-at-a-time queue wrapping `analyzeGame`, called from `gameStore.ts`'s `finish()`.
- **Modified:** `src/renderer/features/game/gameStore.ts` — `finish()` enqueues.
- **Modified:** `src/renderer/features/review/reviewStore.ts` / `src/renderer/features/vault/backgroundAnalysisQueue.ts` — cross-abort wiring so a foreground review request cancels a background one in flight.
- **Modified:** `src/renderer/components/PuzzleMapScreen.tsx` — new "🩹 My Mistakes" entry point, gated behind `entries.length >= MIN_VAULT_ENTRIES` (`MIN_VAULT_ENTRIES = 5`, mirroring the existing `MIN_GAMES_FOR_TAGS` pattern in `WeaknessDashboardScreen.tsx`). Vault is capped at `MAX_VAULT_ENTRIES = 60` (same order of magnitude as `savedGamesStore`'s cap relative to its record size).
- **Modified:** `src/renderer/features/puzzle/puzzleStore.ts` / `PuzzleScreen.tsx` — new `mode: 'vault'`, sourcing puzzles from `blunderVaultStore.entries` instead of the static bank. A `VaultEntry` already has the exact shape (`fenBefore` + `bestMove`) `PuzzleScreen` consumes for static puzzles, so this is a new data source into existing solve/hint/feedback UI, not new UI.

### i18n

New keys in `puzzles.json` (×3 locales): `myMistakes` ("🩹 My Mistakes"), `myMistakesEmpty` ("Play a few more games to build up mistakes to practice"). Everything else (`findBestMove`, `tryAgain`, `solved`, `askForHelp`, `tier_*` from `stats.json`) is reused as-is.

### Error Handling

A failed background analysis (worker error, corrupted saved-game entry) is swallowed silently — same pattern as `reviewStore.start()`'s existing `.catch()` ("aborted by a new start()... nothing to report"). It just means that game contributes no vault entries; never surfaced to the user.

### Testing

- `backgroundAnalysisQueue.test.ts`: enqueue/abort ordering, one-at-a-time guarantee, abort-on-foreground-request.
- `blunderVaultStore.test.ts`: dedup by `fenBefore`, cap eviction (oldest first), `markSolved`/unsolved-first selection.
- PuzzleMapScreen/PuzzleScreen wiring: live-verified, no dedicated component test (existing convention).

---

## 2. "Why not X?" Move Explorer

**What it is:** From inside a reviewed game, click any legal move (not just the one played) at the current position to see its evaluation and plain-English explanation, without playing it.

### Architecture

`analyzeMove()` (`src/renderer/engine/analyze.ts`) already calls `scoreRootMoves(fenBefore, level)`, which scores **every** legal move at that position — it just discards all but the one matching `played`. This feature exposes that same computed list for an arbitrary candidate instead.

### Data Flow

1. Player is in ReviewScreen, `reviewStore.status === 'ready'` (static position, not mid-game), at some `index`.
2. Player clicks a legal destination square for a piece other than the one that was actually played at that ply.
3. `analyzeCandidate(fenBefore, candidateMove)` runs `scoreRootMoves` once (same worker call `analyzeMove` already makes) and looks up the candidate's own score alongside the best score — returns a `MoveGrade`-shaped result for that candidate.
4. Feed the result through the **exact same pipeline** TutorPanel already uses for the best/played move: `classify()` → tier, `explainTags()` → tags, `phraseFor`/`reasonFor` → text. Zero new translation content.
5. Rendered in a small popover under the board: `{candidate SAN}: {tier badge} — {phrase}`, with the same "Why?" expand-to-modal pattern `TutorPanel` already has.

### Components

- **New/modified:** `src/renderer/engine/analyze.ts` — export `analyzeCandidate(fenBefore, move): MoveGrade`, generalizing `analyzeMove`'s internals (both become thin wrappers over one shared `scoreAndFind` helper — `analyzeMove` is `analyzeCandidate` with `move` defaulted to the actually-played one, so this is a refactor with no behavior change to the existing function, verified by its existing tests staying green).
- **New:** `src/renderer/components/MoveExplorerPopover.tsx` — small panel, reuses `TutorPanel.module.css`'s tier-badge styling.
- **Modified:** `src/renderer/components/ReviewBoard.tsx` — click handler for legal squares at the current ply when `reviewStore.status === 'ready'`, calling `analyzeCandidate` and opening the popover. Does not mutate `reviewStore`'s position — purely a side panel.

### i18n

None. Fully reuses `tutor:phrase_*`/`reason_*`/`whyTitle`, `stats:tier_*`, `common:why`, `common:gotIt`.

### Error Handling

N/A beyond what `scoreRootMoves` already handles — a legal move is always scoreable; illegal clicks are filtered at the click-handler level before `analyzeCandidate` is ever called (same legal-move-highlighting logic `Board.tsx` already has).

### Testing

- `analyze.test.ts`: extend with `analyzeCandidate` tests — same fixtures as `analyzeMove`'s existing tests, asserting it returns the correct score for a candidate that is *not* the position's best move, and that `analyzeMove`'s existing tests still pass unchanged after the refactor (proves no behavior regression).
- Popover wiring: live-verified.

---

## 3. Opening Trainer

**What it is:** A drill mode inside Opening Explorer — walk a curated opening's line, guess White's/Black's book move at each of your turns.

### Architecture

Reuses `CURATED_OPENINGS[i].sequence` (`src/renderer/features/openings/curatedOpenings.ts`) as-is — already bundled, static, offline. No new dataset.

### Data Flow

1. Player picks an opening and a side (reusing the existing side/level Segmented controls already in `OpeningExplorerScreen.tsx`) and starts "🎯 Quiz" instead of Watch/Practice.
2. `openingQuizStore` walks `sequence` move by move from the start position. On the opponent's turns, the move plays automatically. On the player's turns, the board waits for input.
3. Player's move is compared to `sequence[step]` (exact UCI match). Correct → advance, brief positive feedback. Wrong → the correct move is shown/played for them (so the line stays intact), a brief "not quite" feedback, then advance.
4. End of sequence → summary (`X of Y correct`), option to retry or pick another opening.

### Components

- **New store:** `src/renderer/features/openings/openingQuizStore.ts` — session-only, **not persisted** (no new localStorage schema):
  ```ts
  interface OpeningQuizState {
    opening: CuratedOpening | null;
    side: Color;
    step: number;
    correctCount: number;
    status: 'idle' | 'playing' | 'done';
    start(opening: CuratedOpening, side: Color): void;
    submitMove(move: MoveInput): void; // no-op if not the player's turn
    exit(): void;
  }
  ```
- **Modified:** `src/renderer/components/OpeningExplorerScreen.tsx` — new "🎯 Quiz" button per row, alongside existing Watch/Practice.
- **New:** `src/renderer/components/OpeningQuizScreen.tsx` — reuses `BoardView`/`Board`-style rendering (read-only except on the player's turn), a feedback banner, a step counter.

### i18n

New keys in `puzzles.json` (×3 locales): `quiz` ("🎯 Quiz"), `whatsTheMove` ("What's the move?"), `correctMove` ("Correct!"), `notQuiteMove` ("Not quite — the book move was {{san}}"), `quizComplete` ("{{correct}} / {{total}} correct"). Reuses `common:playAgain`-style patterns where they already fit (`puzzles:playAgain`/`backToMap`).

### Error Handling

N/A — `sequence` is static and pre-validated (it's the same data `OpeningExplorerScreen`'s existing Watch/Practice already replay without incident).

### Testing

- `openingQuizStore.test.ts`: correct-move advance, wrong-move feedback + line stays intact, opponent auto-play, completion summary math.
- Screen wiring: live-verified.

---

## 4. Game Summary

**What it is:** A 1-3 sentence natural-language recap shown at the top of the Tutor panel once a game's review analysis is ready — "You played solidly in the opening but blundered your queen on move 23…"

### Architecture

Pure function over `reviewStore.analysis: MoveAnalysis[]` (already fully computed, in memory — zero new storage). Shares `weaknessStats.ts`'s phase/mistake-classification helpers (`phaseOf`, the `isMistakeOrWorse` predicate) rather than duplicating them — those become exported from `weaknessStats.ts` for reuse, or extracted into a small shared module both `weaknessStats.ts` and the new summarizer import (decided at task-planning time, not here).

### Data Flow

1. `reviewStore.status` transitions to `'ready'`.
2. `summarizeGame(analysis)` runs once, computing: overall tier distribution, worst phase (reusing the same "which phase has the highest mistake rate, above a minimum sample size" logic `biggestWeakness()` already has, applied to one game instead of many), and whether there were any `brilliant`/`best`-tier standout moves.
3. Composes 1-3 sentences by picking from a small set of `stats:summary*` templates based on that computed shape (clean game / one rough phase / multiple rough phases / had a brilliancy), interpolating phase name and move number(s) as needed.
4. Rendered as a paragraph above the per-move breakdown in `TutorPanel.tsx`.

### Components

- **New:** `src/renderer/features/review/summarizeGame.ts` — the pure `summarizeGame(analysis: MoveAnalysis[]): string[]` function.
- **Modified:** `src/renderer/features/history/weaknessStats.ts` — export `phaseOf` and the mistake-tier predicate for reuse (already effectively pure/shared logic, just not exported today).
- **Modified:** `src/renderer/components/TutorPanel.tsx` — renders the summary above the existing per-move section, only once (not per-ply — computed once when analysis completes, not recomputed on every `goTo`).

### i18n

New keys in `stats.json` (×3 locales): `summaryClean`, `summaryOneRoughPhase`, `summaryMultipleRoughPhases`, `summaryHadBrilliancy`, composed with the existing `insightPhase`-style interpolation. Any piece/phase-name interpolation routes through the same gender-`context` approach already proven for Spanish in the i18n final-review fix pass — checked explicitly during that task, not assumed correct by construction (the lesson from the prior review's Critical finding).

### Error Handling

N/A — operates on already-validated in-memory analysis data; a zero-length `analysis` (shouldn't happen, but defensively) returns an empty summary (renders nothing) rather than throwing.

### Testing

- `summarizeGame.test.ts`: one fixture per template branch (clean game, one rough phase, multiple rough phases, has a brilliancy), plus a Spanish-locale test proving gender agreement holds for a feminine-piece/phase-name-bearing sentence (the exact test shape that caught the earlier bug, applied proactively this time).
- TutorPanel wiring: live-verified.

---

## 5. Glossary

**What it is:** A standalone searchable list of chess terms and plain-English definitions.

### Architecture

Pure content + a list/search component. No engine, no game-state coupling, no persisted state beyond nothing (there's no state to persist).

### Components

- **New locale files:** `src/renderer/locales/{en,he,es}/glossary.json`, new namespace registered in `src/renderer/i18n/index.ts` (same pattern as the six existing namespaces). Flat structure matching the `tag_*` convention already used in `stats.json`:
  ```json
  {
    "term_enPassant": "En passant",
    "def_enPassant": "A special pawn capture...",
    "term_fork": "Fork",
    "def_fork": "One piece attacking two enemy pieces at once.",
    ...
  }
  ```
  ~25-30 starter terms: en passant, kingside/queenside castling, check, checkmate, stalemate, fork, pin, skewer, discovered attack, double attack, zugzwang, zwischenzug, fianchetto, outpost, isolated pawn, passed pawn, doubled pawns, back-rank mate, perpetual check, opposition, tempo, development, material, centipawn, overloaded piece, smothered mate, en prise, tactic, sacrifice.
- **New:** `src/renderer/features/glossary/glossaryTerms.ts` — a typed `GLOSSARY_KEYS` array (the term-key list), read by the screen to iterate (mirrors how `REACTION_KEYS` drives `ReactionPicker.tsx`).
- **New:** `src/renderer/components/GlossaryScreen.tsx` — list + a simple client-side text filter (filters on the *translated* term/definition text in the active locale, not the key).
- **Modified:** `src/renderer/components/NewGameMenu.tsx` — new "📚 Glossary" menu button.

### i18n

New `glossary` namespace, ×3 locales, as above. One new key in `common.json`: `glossary` ("📚 Glossary" — menu button label, matching the emoji-prefixed pattern every other menu entry already uses).

### Error Handling

N/A.

### Testing

- No pure logic beyond the filter predicate — `glossaryFilter.test.ts` if the filter logic is non-trivial enough to warrant it (simple substring match likely doesn't), otherwise live-verified only, same as other pure-content screens (e.g., `OpeningExplorerScreen`).

---

## Review Focus

The five input classes/failure modes most likely to bite a person using this, in priority order:

1. **Background Blunder Vault analysis running concurrently with a foreground engine request** (starting a new game, or clicking "Review game", while a background analysis is mid-flight) — must abort cleanly, never delay or corrupt the foreground request. Directly caused a real bug class in the online-play feature earlier this session (stale connections); the abort wiring here needs the same discipline.
2. **Blunder Vault growing unbounded** in `localStorage` across months of play — needs an explicit cap and eviction policy, same as `savedGamesStore`.
3. **A Game Summary sentence with a gendered Spanish article mismatch** — the exact bug class the i18n final review caught (Critical finding). Every new `stats:summary*` template gets checked against this explicitly, not assumed safe.
4. **Opening Trainer accepting a move that's objectively fine but not the one exact curated line** — since v1 has no branching, a player who knows real theory may be told they're "wrong" for a perfectly good alternative. Not a bug against this spec (explicitly a stated v1 limitation), but the "not quite" feedback text should say what the *book* move was, not imply the player's move was bad, to avoid teaching something false.
5. **Glossary search matching on the untranslated key instead of the visible (translated) text** — would silently break in he/es. The filter must run against `t()`'s resolved output, not the raw `term_*` key string.
