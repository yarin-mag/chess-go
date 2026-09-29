# Learning Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Blunder Vault, "Why not X?" move explorer, Opening Trainer, Game Summary, and Glossary — five learning-enhancement features, all client-side, zero network dependency, reusing the app's existing local engine (Web Worker) and i18n infrastructure.

**Architecture:** Each feature is additive: new pure logic modules (TDD'd) plus new/modified UI components (live-verified, matching this codebase's established split). No feature touches the network layer, the online-play protocol, or build tooling. Three features (Blunder Vault, Why-not-X, Game Summary) reuse the existing analysis pipeline (`analyzeGame`/`requestMoveGrade`/`classify`/`explainTags`/`phraseFor`/`reasonFor`) already built for post-game review; Opening Trainer reuses the already-bundled `CURATED_OPENINGS` data; Glossary is pure new i18n content.

**Tech Stack:** React 19 + TypeScript + Zustand (+ `persist` where noted) + chess.js, existing Web Worker engine (`engineClient.ts`), `react-i18next` (existing 6 namespaces + one new `glossary` namespace).

**Spec:** `docs/superpowers/specs/2026-09-30-learning-enhancements-design.md`

## Global Constraints

- No network calls anywhere — every computation runs against bundled/local data or the existing local Web Worker engine.
- All new user-facing strings go through `react-i18next`, real content in all three locales (en/he/es), no placeholders.
- Any template interpolating a piece name or phase name into Spanish text routes through i18next's `context` feature or is worded to avoid gendered-article agreement — checked explicitly per task, never assumed safe (this is the exact bug class the i18n feature's final review caught as Critical).
- New persisted stores use `zustand` + `persist` + `createJSONStorage(() => localStorage)`, each with an explicit entry cap.
- Background work (Blunder Vault's auto-analysis) never blocks or competes with foreground engine use — starting a new game, opening Review, or exploring a move always aborts/wins over background analysis in flight.
- Any move-grading call from a UI event handler goes through `requestMoveGrade` (the Web Worker dispatch in `engineClient.ts`), never `analyzeMove`/`scoreRootMoves` directly — those run synchronously and would block the main thread if called outside the worker. (`analyzeMove` itself only ever runs *inside* `worker.ts`.)
- Pure computation gets full TDD coverage. JSX/screen wiring follows this codebase's established convention: no dedicated component test, verified live in the browser (same split used throughout the i18n work).

## Review Focus

1. **Background Blunder Vault analysis racing a foreground engine request** — starting a new game, clicking "Review game", or exploring a move while a background analysis is mid-flight must abort it cleanly, never delay or corrupt the foreground request.
2. **Blunder Vault growing unbounded in `localStorage`** across months of play — needs an explicit cap and eviction, same as `savedGamesStore`.
3. **A Game Summary sentence with a gendered Spanish article mismatch** — the exact bug class the i18n final review caught as Critical. Every new `stats:summary*` template is checked against this explicitly in its own task.
4. **Opening Trainer telling the player their move was "wrong"** when it was merely not the one curated line (v1 has no branching) — feedback text must name the book move without implying the player's move was bad.
5. **Glossary search matching the untranslated key instead of the visible (translated) text** — would silently break in he/es if implemented carelessly.

---

### Task 1: Blunder Vault — store, entry extraction, puzzle-data mapping

**Files:**
- Create: `src/renderer/features/vault/blunderVaultStore.ts`
- Create: `src/renderer/features/vault/blunderVaultStore.test.ts`
- Create: `src/renderer/features/vault/vaultPuzzle.ts`
- Create: `src/renderer/features/vault/vaultPuzzle.test.ts`

**Interfaces:**
- Consumes: `MoveAnalysis` (`src/renderer/features/review/analyzeGame.ts`, unchanged), `PuzzleData` (`src/renderer/features/puzzle/puzzles.ts`, unchanged), `MoveInput`/`Tier`/`ExplanationTag` (unchanged).
- Produces: `VaultEntry`, `useBlunderVaultStore` (state: `entries`, `solvedIds`; actions: `addEntries`, `markSolved`, `pickNext`, `clear`), `extractVaultEntries(sourceGameId, analysis)`, `toPuzzleData(entry)` — consumed by Task 2 (extraction) and Task 3 (puzzle UI).

- [ ] **Step 1: Write the failing tests for `blunderVaultStore`.**

```ts
// src/renderer/features/vault/blunderVaultStore.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { useBlunderVaultStore, type VaultEntry } from './blunderVaultStore';

const entry = (id: string, fenBefore = '6k1/8/8/8/8/8/8/6K1 w - - 0 1'): VaultEntry => ({
  id,
  sourceGameId: 'game-1',
  ply: 4,
  fenBefore,
  bestMove: { from: 'a1', to: 'a8' },
  bestSan: 'Ra8#',
  playedSan: 'Kh2',
  tier: 'blunder',
  tags: ['missedMate'],
  capturedAt: '2026-09-30T00:00:00.000Z',
});

beforeEach(() => {
  useBlunderVaultStore.setState({ entries: [], solvedIds: [] });
});

describe('addEntries', () => {
  it('adds new entries, most recent first', () => {
    useBlunderVaultStore.getState().addEntries([entry('a')]);
    useBlunderVaultStore.getState().addEntries([entry('b')]);
    expect(useBlunderVaultStore.getState().entries.map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('dedupes by fenBefore — the same position is never stored twice', () => {
    useBlunderVaultStore.getState().addEntries([entry('a', 'fen-1')]);
    useBlunderVaultStore.getState().addEntries([entry('b', 'fen-1')]);
    expect(useBlunderVaultStore.getState().entries).toHaveLength(1);
    expect(useBlunderVaultStore.getState().entries[0].id).toBe('a'); // first one wins
  });

  it('caps at MAX_VAULT_ENTRIES, evicting the oldest', () => {
    const many = Array.from({ length: 65 }, (_, i) => entry(`e${i}`, `fen-${i}`));
    useBlunderVaultStore.getState().addEntries(many);
    const state = useBlunderVaultStore.getState();
    expect(state.entries).toHaveLength(60);
    expect(state.entries[0].id).toBe('e64'); // most recent kept
    expect(state.entries.find((e) => e.id === 'e0')).toBeUndefined(); // oldest evicted
  });
});

describe('markSolved / pickNext', () => {
  it('prefers an unsolved entry', () => {
    useBlunderVaultStore.getState().addEntries([entry('a'), entry('b', 'fen-2')]);
    useBlunderVaultStore.getState().markSolved('a');
    expect(useBlunderVaultStore.getState().pickNext()?.id).toBe('b');
  });

  it('falls back to any entry once everything is solved', () => {
    useBlunderVaultStore.getState().addEntries([entry('a')]);
    useBlunderVaultStore.getState().markSolved('a');
    expect(useBlunderVaultStore.getState().pickNext()?.id).toBe('a');
  });

  it('returns null with no entries at all', () => {
    expect(useBlunderVaultStore.getState().pickNext()).toBeNull();
  });
});

describe('clear', () => {
  it('empties entries and solvedIds', () => {
    useBlunderVaultStore.getState().addEntries([entry('a')]);
    useBlunderVaultStore.getState().markSolved('a');
    useBlunderVaultStore.getState().clear();
    expect(useBlunderVaultStore.getState().entries).toEqual([]);
    expect(useBlunderVaultStore.getState().solvedIds).toEqual([]);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/renderer/features/vault/blunderVaultStore.test.ts` → FAIL (module doesn't exist).

- [ ] **Step 3: Implement `blunderVaultStore.ts`.**

```ts
// src/renderer/features/vault/blunderVaultStore.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MoveInput } from '@/core/types';
import type { Tier } from '@/engine/classify';
import type { ExplanationTag } from '@/engine/explain';
import type { MoveAnalysis } from '@/features/review/analyzeGame';

// Full saved games (fenBefore-replayable) run to MAX_SAVED_GAMES=100 in savedGamesStore; a vault entry is
// much smaller per-record, but still capped so localStorage never grows unbounded across months of play.
export const MAX_VAULT_ENTRIES = 60;

export interface VaultEntry {
  id: string;
  sourceGameId: string;
  ply: number;
  fenBefore: string;
  bestMove: MoveInput;
  bestSan: string;
  playedSan: string;
  tier: Tier;
  tags: ExplanationTag[];
  capturedAt: string; // ISO timestamp
}

interface BlunderVaultState {
  entries: VaultEntry[];
  solvedIds: string[];
  addEntries(entries: VaultEntry[]): void;
  markSolved(id: string): void;
  /** An unsolved entry if one exists, otherwise any entry, otherwise null (vault empty). */
  pickNext(): VaultEntry | null;
  clear(): void;
}

/** A blunder/mistake worth practicing, pulled from one game's already-computed review analysis. */
export function extractVaultEntries(sourceGameId: string, analysis: MoveAnalysis[]): VaultEntry[] {
  return analysis
    .filter((a) => a.tier === 'blunder' || a.tier === 'mistake')
    .map((a) => ({
      id: `${sourceGameId}-${a.ply}`,
      sourceGameId,
      ply: a.ply,
      fenBefore: a.fenBefore,
      bestMove: a.bestMove,
      bestSan: a.bestSan,
      playedSan: a.move.san,
      tier: a.tier,
      tags: a.tags,
      capturedAt: new Date().toISOString(),
    }));
}

export const useBlunderVaultStore = create<BlunderVaultState>()(
  persist(
    (set, get) => ({
      entries: [],
      solvedIds: [],

      addEntries(newEntries) {
        const { entries } = get();
        const seenFens = new Set(entries.map((e) => e.fenBefore));
        const deduped = newEntries.filter((e) => !seenFens.has(e.fenBefore));
        // also dedupe within the incoming batch itself
        const trulyNew: VaultEntry[] = [];
        const batchFens = new Set<string>();
        for (const e of deduped) {
          if (batchFens.has(e.fenBefore)) continue;
          batchFens.add(e.fenBefore);
          trulyNew.push(e);
        }
        if (trulyNew.length === 0) return;
        set({ entries: [...trulyNew, ...entries].slice(0, MAX_VAULT_ENTRIES) });
      },

      markSolved(id) {
        const { solvedIds } = get();
        if (!solvedIds.includes(id)) set({ solvedIds: [...solvedIds, id] });
      },

      pickNext() {
        const { entries, solvedIds } = get();
        if (entries.length === 0) return null;
        return entries.find((e) => !solvedIds.includes(e.id)) ?? entries[0];
      },

      clear() {
        set({ entries: [], solvedIds: [] });
      },
    }),
    { name: 'b-chess-blunder-vault', storage: createJSONStorage(() => localStorage) },
  ),
);
```

- [ ] **Step 4:** Run `npx vitest run src/renderer/features/vault/blunderVaultStore.test.ts` → PASS.

- [ ] **Step 5: Write the failing tests for `vaultPuzzle.ts`.**

```ts
// src/renderer/features/vault/vaultPuzzle.test.ts
import { describe, expect, it } from 'vitest';
import { toPuzzleData } from './vaultPuzzle';
import type { VaultEntry } from './blunderVaultStore';

const entry: VaultEntry = {
  id: 'game-1-4',
  sourceGameId: 'game-1',
  ply: 4,
  fenBefore: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
  bestMove: { from: 'a1', to: 'a8' },
  bestSan: 'Ra8#',
  playedSan: 'Kd2',
  tier: 'blunder',
  tags: ['missedMate'],
  capturedAt: '2026-09-30T00:00:00.000Z',
};

describe('toPuzzleData', () => {
  it('carries the position and a single-move solution ending immediately (no forced opponent reply)', () => {
    const puzzle = toPuzzleData(entry);
    expect(puzzle.fen).toBe(entry.fenBefore);
    expect(puzzle.solution).toEqual(['a1a8']);
    expect(puzzle.id).toBe(entry.id);
  });

  it('encodes a promotion move in the UCI solution', () => {
    const promo: VaultEntry = { ...entry, bestMove: { from: 'a7', to: 'a8', promotion: 'q' } };
    expect(toPuzzleData(promo).solution).toEqual(['a7a8q']);
  });
});
```

- [ ] **Step 6:** Run `npx vitest run src/renderer/features/vault/vaultPuzzle.test.ts` → FAIL.

- [ ] **Step 7: Implement `vaultPuzzle.ts`.**

```ts
// src/renderer/features/vault/vaultPuzzle.ts
import type { MoveInput } from '@/core/types';
import type { PuzzleData } from '@/features/puzzle/puzzles';
import type { VaultEntry } from './blunderVaultStore';

const toUci = (m: MoveInput): string => `${m.from}${m.to}${m.promotion ?? ''}`;

/**
 * Converts a vault entry into the shape PuzzleScreen's solve/hint/feedback UI already consumes.
 * `solution` is a single-element array — PuzzleData's own contract ("always ending on a player move")
 * means one entry already terminates the puzzle immediately on a correct guess, with no scripted
 * opponent reply, which is exactly right: a vault entry has one "you should have played X" answer,
 * not a forced multi-move sequence like the bundled tactical puzzles.
 */
export function toPuzzleData(entry: VaultEntry): PuzzleData {
  return {
    id: entry.id,
    fen: entry.fenBefore,
    solution: [toUci(entry.bestMove)],
    rating: 0,
    stage: -1,
    themes: entry.tags,
  };
}
```

- [ ] **Step 8:** Run `npx vitest run src/renderer/features/vault/`, `npm run typecheck` — clean.

- [ ] **Step 9:** Commit:
```bash
git add src/renderer/features/vault/blunderVaultStore.ts src/renderer/features/vault/blunderVaultStore.test.ts src/renderer/features/vault/vaultPuzzle.ts src/renderer/features/vault/vaultPuzzle.test.ts
git commit -m "feat(vault): blunder vault store, entry extraction, puzzle-data mapping"
```

---

### Task 2: Blunder Vault — background analysis queue, game-end/abort wiring

**Files:**
- Create: `src/renderer/features/vault/backgroundAnalysisQueue.ts`
- Create: `src/renderer/features/vault/backgroundAnalysisQueue.test.ts`
- Modify: `src/renderer/features/game/gameStore.ts`
- Modify: `src/renderer/features/game/gameStore.test.ts`
- Modify: `src/renderer/features/review/reviewStore.ts`

**Interfaces:**
- Consumes: `analyzeGame` (`analyzeGame.ts`, unchanged), `extractVaultEntries`/`useBlunderVaultStore` (Task 1).
- Produces: `enqueueBackgroundAnalysis(item)`, `abortBackgroundAnalysis()` — consumed by `gameStore.finish`, `reviewStore.start`, and Task 3's on-demand explore/vault-open paths (any foreground engine use aborts background work first).

- [ ] **Step 1: Write the failing tests.**

```ts
// src/renderer/features/vault/backgroundAnalysisQueue.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/review/analyzeGame', () => ({
  analyzeGame: vi.fn(),
}));

import { analyzeGame } from '@/features/review/analyzeGame';
import { useBlunderVaultStore } from './blunderVaultStore';
import { abortBackgroundAnalysis, enqueueBackgroundAnalysis } from './backgroundAnalysisQueue';

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  abortBackgroundAnalysis();
  useBlunderVaultStore.setState({ entries: [], solvedIds: [] });
  vi.mocked(analyzeGame).mockReset();
});

const grade = { ply: 0, tier: 'blunder' as const, tags: [] as const, fenBefore: 'fen', bestMove: { from: 'a1', to: 'a8' }, bestSan: 'Ra8', bestScore: 100, playedScore: -200, centipawnLoss: 300, move: { san: 'Kh2' } as never, opening: null };

describe('enqueueBackgroundAnalysis', () => {
  it('runs analyzeGame and stores extracted vault entries on completion', async () => {
    vi.mocked(analyzeGame).mockResolvedValueOnce([grade]);
    enqueueBackgroundAnalysis({ sourceGameId: 'g1', fen: undefined, history: [] });
    await flush();
    expect(useBlunderVaultStore.getState().entries).toHaveLength(1);
    expect(useBlunderVaultStore.getState().entries[0].sourceGameId).toBe('g1');
  });

  it('runs at most one analysis at a time, queuing the rest', async () => {
    let resolveFirst!: (v: typeof grade[]) => void;
    vi.mocked(analyzeGame).mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)));
    vi.mocked(analyzeGame).mockResolvedValueOnce([]);

    enqueueBackgroundAnalysis({ sourceGameId: 'g1', fen: undefined, history: [] });
    enqueueBackgroundAnalysis({ sourceGameId: 'g2', fen: undefined, history: [] });
    await flush();
    expect(analyzeGame).toHaveBeenCalledTimes(1); // second is still queued, not started

    resolveFirst([]);
    await flush();
    expect(analyzeGame).toHaveBeenCalledTimes(2); // second started once the first finished
  });

  it('abortBackgroundAnalysis stops the in-flight run and drops the rest of the queue', async () => {
    vi.mocked(analyzeGame).mockImplementationOnce((_fen, _hist, _progress, signal: AbortSignal) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Analysis aborted', 'AbortError')));
      });
    });
    enqueueBackgroundAnalysis({ sourceGameId: 'g1', fen: undefined, history: [] });
    enqueueBackgroundAnalysis({ sourceGameId: 'g2', fen: undefined, history: [] });
    await flush();
    abortBackgroundAnalysis();
    await flush();
    expect(useBlunderVaultStore.getState().entries).toEqual([]);
    // the queued (never-started) g2 item must not run after an abort either
    await flush();
    expect(analyzeGame).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/renderer/features/vault/backgroundAnalysisQueue.test.ts` → FAIL (module doesn't exist).

- [ ] **Step 3: Implement `backgroundAnalysisQueue.ts`.**

```ts
// src/renderer/features/vault/backgroundAnalysisQueue.ts
import type { MoveRecord } from '@/core/types';
import { analyzeGame } from '@/features/review/analyzeGame';
import { extractVaultEntries, useBlunderVaultStore } from './blunderVaultStore';

interface QueueItem {
  sourceGameId: string;
  fen: string | undefined;
  history: MoveRecord[];
}

let controller: AbortController | null = null;
let queue: QueueItem[] = [];
let running = false;

/** Cancels any in-flight or still-queued background analysis. Called before any foreground engine use
 *  (a new game, opening Review, exploring a move) so background work never competes with it. */
export function abortBackgroundAnalysis(): void {
  controller?.abort();
  controller = null;
  queue = [];
  running = false;
}

export function enqueueBackgroundAnalysis(item: QueueItem): void {
  queue.push(item);
  void runNext();
}

async function runNext(): Promise<void> {
  if (running || queue.length === 0) return;
  running = true;
  const item = queue.shift()!;
  const localController = new AbortController();
  controller = localController;
  try {
    const analysis = await analyzeGame(item.fen, item.history, () => {}, localController.signal);
    if (localController.signal.aborted) return;
    const entries = extractVaultEntries(item.sourceGameId, analysis);
    if (entries.length > 0) useBlunderVaultStore.getState().addEntries(entries);
  } catch {
    // Aborted, or a worker error mid-analysis — a background run silently contributing nothing is fine,
    // the same tolerance reviewStore.start()'s own analyzeGame().catch() already has.
  } finally {
    running = false;
    if (controller === localController) controller = null;
    void runNext();
  }
}
```

- [ ] **Step 4:** Run `npx vitest run src/renderer/features/vault/backgroundAnalysisQueue.test.ts` → PASS.

- [ ] **Step 5: Wire `gameStore.ts`'s `finish()`.** Read the file first — `finish` is defined inside `useGameStore(create(...))`, calling `useSavedGamesStore.getState().saveGame(config, history, result)` when `history.length > 0`. Add, right after that call:

```ts
import { enqueueBackgroundAnalysis } from '@/features/vault/backgroundAnalysisQueue';
// ...
if (history.length > 0) {
  useSavedGamesStore.getState().saveGame(config, history, result);
  enqueueBackgroundAnalysis({ sourceGameId: String(gameId), fen: config.fen, history });
}
```
(`gameId` is already destructured from `get()` at the top of `finish`; confirm it's in scope at this exact line — it is, per the existing `const { config, history } = get();` line, which becomes `const { config, history, gameId } = get();`.)

Also wire the abort in `startGame(config)`, right beside its existing `abortEngine()` call:
```ts
import { abortBackgroundAnalysis } from '@/features/vault/backgroundAnalysisQueue';
// ...
startGame(config) {
  abortEngine();
  abortBackgroundAnalysis();
  // ...
```

- [ ] **Step 6: Wire `reviewStore.ts`'s `start()`.** Add the same abort call at the top of `start()`, before its own `abortController?.abort()` line:
```ts
import { abortBackgroundAnalysis } from '@/features/vault/backgroundAnalysisQueue';
// ...
start(config, history, options = {}) {
  abortBackgroundAnalysis();
  const recordStats = options.recordStats ?? true;
  // ...
```

- [ ] **Step 7: Mock the queue in `gameStore.test.ts`.** It already mocks `@/engine/engineClient` (only `requestEngineMove`/`requestMoveHint` — no `requestMoveGrade`), so an unmocked background queue reaching real `analyzeGame`/`requestMoveGrade` would hit `undefined` mid-flight and, more importantly, could write into the real (module-singleton) `useBlunderVaultStore` from every test that calls `finish()`, leaking state across this file's tests non-deterministically. Add, alongside the existing `vi.mock('@/engine/engineClient', ...)`:
```ts
vi.mock('@/features/vault/backgroundAnalysisQueue', () => ({
  enqueueBackgroundAnalysis: vi.fn(),
  abortBackgroundAnalysis: vi.fn(),
}));
```
This keeps `gameStore.test.ts` testing gameStore's own logic only — the queue itself is already fully covered by Task 2's own `backgroundAnalysisQueue.test.ts`.

- [ ] **Step 8:** Run `npx vitest run`, `npm run typecheck` — clean.

- [ ] **Step 9:** Commit:
```bash
git add src/renderer/features/vault/backgroundAnalysisQueue.ts src/renderer/features/vault/backgroundAnalysisQueue.test.ts src/renderer/features/game/gameStore.ts src/renderer/features/game/gameStore.test.ts src/renderer/features/review/reviewStore.ts
git commit -m "feat(vault): background analysis queue, wired to game-end and abort points"
```

---

### Task 3: Blunder Vault — backfill, puzzle-store `vault` mode, UI

**Files:**
- Modify: `src/renderer/features/puzzle/puzzleStore.ts`
- Modify: `src/renderer/features/puzzle/puzzleStore.test.ts`
- Modify: `src/renderer/components/PuzzleMapScreen.tsx`
- Modify: `src/renderer/components/PuzzleScreen.tsx`
- Create: `src/renderer/features/vault/backfillVault.ts`
- Create: `src/renderer/features/vault/backfillVault.test.ts`
- Modify: `src/renderer/main.tsx`
- Modify: `src/renderer/locales/en/puzzles.json`, `src/renderer/locales/he/puzzles.json`, `src/renderer/locales/es/puzzles.json`

**Interfaces:** Consumes `useBlunderVaultStore`/`toPuzzleData` (Task 1), `enqueueBackgroundAnalysis` (Task 2). Produces `usePuzzleStore.startVault()`, `PuzzleMode` extended with `'vault'`.

- [ ] **Step 1: Write the failing test for `backfillVault`.**

```ts
// src/renderer/features/vault/backfillVault.test.ts
import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('./backgroundAnalysisQueue', () => ({ enqueueBackgroundAnalysis: vi.fn() }));

import { enqueueBackgroundAnalysis } from './backgroundAnalysisQueue';
import { useBlunderVaultStore } from './blunderVaultStore';
import { useSavedGamesStore } from '@/features/history/savedGamesStore';
import { backfillVaultIfEmpty, MAX_BACKFILL_GAMES } from './backfillVault';

const savedGame = (id: string) => ({
  id,
  playedAt: '2026-01-01T00:00:00.000Z',
  config: { white: { type: 'human' as const }, black: { type: 'human' as const }, timeControl: { initialMs: 0, incrementMs: 0 } },
  history: [{ ply: 0, from: 'e2', to: 'e4', san: 'e4', color: 'w' as const, fen: 'fen', flags: '', piece: 'p' as const }],
  result: { kind: 'checkmate' as const, winner: 'w' as const },
});

afterEach(() => {
  useBlunderVaultStore.setState({ entries: [], solvedIds: [] });
  useSavedGamesStore.setState({ games: [] });
  vi.mocked(enqueueBackgroundAnalysis).mockReset();
});

describe('backfillVaultIfEmpty', () => {
  it('does nothing when the vault already has entries', () => {
    useBlunderVaultStore.setState({ entries: [{ id: 'x' } as never], solvedIds: [] });
    useSavedGamesStore.setState({ games: [savedGame('a')] });
    backfillVaultIfEmpty();
    expect(enqueueBackgroundAnalysis).not.toHaveBeenCalled();
  });

  it('does nothing when there are no saved games', () => {
    backfillVaultIfEmpty();
    expect(enqueueBackgroundAnalysis).not.toHaveBeenCalled();
  });

  it('enqueues up to MAX_BACKFILL_GAMES most-recent saved games when the vault is empty', () => {
    const games = Array.from({ length: MAX_BACKFILL_GAMES + 5 }, (_, i) => savedGame(`g${i}`));
    useSavedGamesStore.setState({ games });
    backfillVaultIfEmpty();
    expect(enqueueBackgroundAnalysis).toHaveBeenCalledTimes(MAX_BACKFILL_GAMES);
    expect(vi.mocked(enqueueBackgroundAnalysis).mock.calls[0][0].sourceGameId).toBe('g0');
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/renderer/features/vault/backfillVault.test.ts` → FAIL.

- [ ] **Step 3: Implement `backfillVault.ts`.**

```ts
// src/renderer/features/vault/backfillVault.ts
import { useSavedGamesStore } from '@/features/history/savedGamesStore';
import { enqueueBackgroundAnalysis } from './backgroundAnalysisQueue';
import { useBlunderVaultStore } from './blunderVaultStore';

export const MAX_BACKFILL_GAMES = 20;

/** One-time, on-boot backfill: if the vault is empty but there's play history, seed it from the most
 *  recent saved games (each already has full replayable history) so returning players aren't starting
 *  from zero. No-ops instantly if the vault already has anything — never re-backfills. */
export function backfillVaultIfEmpty(): void {
  const { entries } = useBlunderVaultStore.getState();
  if (entries.length > 0) return;
  const { games } = useSavedGamesStore.getState();
  if (games.length === 0) return;
  for (const game of games.slice(0, MAX_BACKFILL_GAMES)) {
    enqueueBackgroundAnalysis({ sourceGameId: game.id, fen: game.config.fen, history: game.history });
  }
}
```

- [ ] **Step 4:** Run `npx vitest run src/renderer/features/vault/backfillVault.test.ts` → PASS.

- [ ] **Step 5: Call `backfillVaultIfEmpty()` once at app boot.** In `src/renderer/main.tsx`, after the existing `import './i18n';` line:
```ts
import { backfillVaultIfEmpty } from './features/vault/backfillVault';
backfillVaultIfEmpty();
```

- [ ] **Step 6: Write the failing `puzzleStore.ts` test for `startVault`.** Extend `puzzleStore.test.ts` (its `requestMoveGrade` mock from Step-context above is already in place):
```ts
import { useBlunderVaultStore } from '@/features/vault/blunderVaultStore';

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
```

- [ ] **Step 7:** Run `npx vitest run src/renderer/features/puzzle/puzzleStore.test.ts` → FAIL (`startVault` doesn't exist).

- [ ] **Step 8: Wire `puzzleStore.ts`.**
```ts
import { toPuzzleData } from '@/features/vault/vaultPuzzle';
import { useBlunderVaultStore } from '@/features/vault/blunderVaultStore';

type PuzzleMode = 'ladder' | 'daily' | 'rush' | 'vault';
```
Add the action to the `PuzzleState` interface (`startVault(): void;`) and implement it beside `startDaily`:
```ts
startVault() {
  const entry = useBlunderVaultStore.getState().pickNext();
  if (!entry) return;
  load(toPuzzleData(entry), -1, -1, 'vault');
},
```
In the `playCorrect` inner function's solved branch, add a `vault` case alongside the existing `daily`/ladder-fallback branching:
```ts
if (mode === 'daily') {
  usePuzzleProgressStore.getState().recordDailySolve();
} else if (mode === 'vault') {
  useBlunderVaultStore.getState().markSolved(puzzle!.id);
} else {
  // existing ladder progress logic, unchanged
}
```

- [ ] **Step 9:** Run `npx vitest run src/renderer/features/puzzle/puzzleStore.test.ts` → PASS.

- [ ] **Step 10: Add `puzzles.json` keys (×3 locales).**

`en`:
```json
"myMistakes": "🩹 My Mistakes",
"myMistakesEmpty": "Play a few more games — you'll see your own mistakes here to practice.",
"vaultLabel": "🩹 From your games"
```
`he`:
```json
"myMistakes": "🩹 הטעויות שלי",
"myMistakesEmpty": "שחק עוד כמה משחקים — הטעויות שלך יופיעו כאן לתרגול.",
"vaultLabel": "🩹 מהמשחקים שלך"
```
`es`:
```json
"myMistakes": "🩹 Mis errores",
"myMistakesEmpty": "Juega algunas partidas más — tus propios errores aparecerán aquí para practicar.",
"vaultLabel": "🩹 De tus partidas"
```

- [ ] **Step 11: Wire `PuzzleMapScreen.tsx`.** Add a button below the existing Rush row, gated behind having at least one vault entry:
```tsx
import { useBlunderVaultStore } from '@/features/vault/blunderVaultStore';
// inside the component:
const vaultCount = useBlunderVaultStore((s) => s.entries.length);
const startVault = usePuzzleStore((s) => s.startVault);
// ... in the JSX, after the rushRow div:
{vaultCount > 0 ? (
  <button className="btn" onClick={startVault}>{t('puzzles:myMistakes')}</button>
) : (
  <p className={styles.streak}>{t('puzzles:myMistakesEmpty')}</p>
)}
```

- [ ] **Step 12: Wire `PuzzleScreen.tsx`.** In the top status-line block (`mode === 'daily' && ...` / `mode === 'ladder' && ...`), add:
```tsx
{mode === 'vault' && t('puzzles:vaultLabel')}
```

- [ ] **Step 13:** Run `npx vitest run`, `npm run typecheck`, `npm run build`, `npm run build:web` — all clean.

- [ ] **Step 14: Live verification** (per this codebase's established convention — pure JSX/store wiring, no dedicated component test):
  - Play a full local game ending in a clear blunder (e.g. hang the queen), let it finish. Confirm (via `localStorage`'s `b-chess-blunder-vault` key, or waiting ~a few seconds and checking Puzzle Map) that a vault entry appears without ever clicking "Review game".
  - Open Puzzle Map → "🩹 My Mistakes" → solve it → confirm it's marked solved and doesn't reappear immediately via `pickNext()`.
  - Confirm starting a *new* game immediately after finishing one (before background analysis would normally complete) doesn't stutter/delay move responsiveness — background analysis should be invisible.
  - Switch to Hebrew/Spanish, confirm "🩹 My Mistakes" / empty-state text renders correctly, RTL-correct in Hebrew.

- [ ] **Step 15:** Commit:
```bash
git add src/renderer/features/vault/backfillVault.ts src/renderer/features/vault/backfillVault.test.ts src/renderer/features/puzzle/puzzleStore.ts src/renderer/features/puzzle/puzzleStore.test.ts src/renderer/components/PuzzleMapScreen.tsx src/renderer/components/PuzzleScreen.tsx src/renderer/main.tsx src/renderer/locales/en/puzzles.json src/renderer/locales/he/puzzles.json src/renderer/locales/es/puzzles.json
git commit -m "feat(vault): backfill, puzzle-store vault mode, My Mistakes UI"
```

---

### Task 4: "Why not X?" move explorer — grading logic

**Files:**
- Create: `src/renderer/features/review/exploreMove.ts`
- Create: `src/renderer/features/review/exploreMove.test.ts`

**Interfaces:** Consumes `requestMoveGrade` (`engineClient.ts`, unchanged), `classify`, `explainTags`/`phraseFor`/`reasonFor` (`explain.ts`, unchanged — same functions `TutorPanel.tsx` already calls). Produces `exploreMove(fenBefore, move, seed?): Promise<ExploredMove>` — consumed by Task 5's UI.

- [ ] **Step 1: Write the failing test.**

```ts
// src/renderer/features/review/exploreMove.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/engine/engineClient', () => ({
  requestMoveGrade: vi.fn(async (fen: string, move: { from: string; to: string; promotion?: string }) => {
    const { scoreRootMoves } = await import('@/engine/search');
    const { ANALYSIS_LEVEL } = await import('@/engine/analyzeLevel');
    const scored = scoreRootMoves(fen, ANALYSIS_LEVEL);
    const best = scored[0];
    const played = scored.find((s) => s.move.from === move.from && s.move.to === move.to) ?? best;
    return {
      bestMove: best.move, bestSan: best.san, bestScore: best.score,
      playedScore: played.score, centipawnLoss: Math.max(0, best.score - played.score),
    };
  }),
}));

import { exploreMove } from './exploreMove';

describe('exploreMove', () => {
  it('grades an arbitrary legal move without requiring it to have been played', async () => {
    // Same fixture used by describeMove/explain tests: a move that hangs a piece.
    const fen = '6k1/8/8/4p3/8/5N2/8/4K3 w - - 0 1';
    const result = await exploreMove(fen, { from: 'f3', to: 'd4' });
    expect(result.san).toBe('Nd4');
    expect(result.tags).toContain('hangsPiece');
    expect(result.phrase).toContain('Nd4');
    expect(result.reason.length).toBeGreaterThan(result.phrase.length);
  });

  it('never marks an explored move as best/brilliant — it always grades as a plain candidate', async () => {
    const fen = new (await import('@/core/chessGame')).ChessGame().fen();
    const result = await exploreMove(fen, { from: 'e2', to: 'e4' });
    expect(result.tier).not.toBe('brilliant');
  });
});
```

- [ ] **Step 2:** Run `npx vitest run src/renderer/features/review/exploreMove.test.ts` → FAIL.

- [ ] **Step 3: Implement `exploreMove.ts`.**

```ts
// src/renderer/features/review/exploreMove.ts
import { ChessGame } from '@/core/chessGame';
import type { MoveInput } from '@/core/types';
import { requestMoveGrade } from '@/engine/engineClient';
import { classify, type Tier } from '@/engine/classify';
import { explainTags, phraseFor, reasonFor, type ExplanationTag } from '@/engine/explain';

export interface ExploredMove {
  san: string;
  tier: Tier;
  tags: ExplanationTag[];
  phrase: string;
  reason: string;
}

/**
 * Grades a move the player is merely curious about — never actually played — through the same
 * worker-backed grading path puzzleStore's wrong-attempt feedback already uses, so this never blocks
 * the UI thread. `tier`/`tags` always compute as a plain candidate (never "best"/"brilliant"): those
 * labels describe how a move compares to what was actually played in a real game, which has no meaning
 * for a hypothetical the player is just exploring.
 */
export async function exploreMove(fenBefore: string, candidate: MoveInput, seed = 0): Promise<ExploredMove> {
  const grade = await requestMoveGrade(fenBefore, candidate);
  const before = new ChessGame(fenBefore);
  const after = new ChessGame(fenBefore);
  const record = after.move(candidate)!;
  const tier = classify(grade.centipawnLoss, false, false);
  const tags = explainTags({ before, after, move: record, grade, tier, ply: 0 });
  return {
    san: record.san,
    tier,
    tags,
    phrase: tags.map((tag, i) => phraseFor(tag, tier, record.san, seed + i)).join(' '),
    reason: tags.map((tag, i) => reasonFor(tag, tier, record.san, seed + i)).join(' '),
  };
}
```

- [ ] **Step 4:** Run `npx vitest run src/renderer/features/review/exploreMove.test.ts` → PASS.

- [ ] **Step 5:** Run `npm run typecheck` — clean.

- [ ] **Step 6:** Commit:
```bash
git add src/renderer/features/review/exploreMove.ts src/renderer/features/review/exploreMove.test.ts
git commit -m "feat(explorer): exploreMove — grade any legal move via the existing worker path"
```

---

### Task 5: "Why not X?" move explorer — UI

**Files:**
- Create: `src/renderer/components/MoveExplorerPopover.tsx`
- Create: `src/renderer/components/MoveExplorerPopover.module.css`
- Modify: `src/renderer/components/ReviewBoard.tsx`

**Interfaces:** Consumes `exploreMove` (Task 4), `ChessGame.legalMovesFrom` (unchanged, same method `gameStore.select()`/`puzzleStore.select()` already use), `t`/`useTranslation` (existing `tutor`/`stats`/`common` namespaces — zero new keys).

- [ ] **Step 1: Implement `MoveExplorerPopover.tsx`.** (Pure JSX wiring — per Global Constraints, no dedicated test; reuses `TutorPanel.module.css`'s already-shipped `.tier`/`.brilliant`/`.best`/.../`.blunder` classes for the badge, so no new CSS is needed for that part.)

```tsx
import { useTranslation } from 'react-i18next';
import type { ExploredMove } from '@/features/review/exploreMove';
import tutorStyles from './TutorPanel.module.css';
import styles from './MoveExplorerPopover.module.css';

interface Props {
  move: ExploredMove | null;
  loading: boolean;
  onClose: () => void;
}

/** Shown when the player clicks a legal move (other than the one played) while reviewing a game. */
export function MoveExplorerPopover({ move, loading, onClose }: Props) {
  const { t } = useTranslation();
  if (!loading && !move) return null;

  return (
    <div className={styles.popover}>
      <button className={styles.close} onClick={onClose} aria-label={t('common:done')}>
        ✕
      </button>
      {loading || !move ? (
        <p className={styles.loading}>{t('tutor:analyzing', { done: 0, total: 1 })}</p>
      ) : (
        <>
          <div className={tutorStyles.header}>
            <strong>{move.san}</strong>
            <span className={`${tutorStyles.tier} ${tutorStyles[move.tier]}`}>{t(`stats:tier_${move.tier}`)}</span>
          </div>
          <p className={styles.phrase}>{move.phrase}</p>
          {move.reason && move.reason !== move.phrase && <p className={styles.reason}>{move.reason}</p>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `MoveExplorerPopover.module.css`.**

```css
.popover {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.close {
  position: absolute;
  top: 8px;
  right: 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  cursor: pointer;
}

.close:hover {
  color: var(--text);
}

.loading {
  color: var(--muted);
  font-size: 14px;
}

.phrase {
  color: var(--text);
  font-size: 14px;
}

.reason {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}
```

- [ ] **Step 3: Wire `ReviewBoard.tsx`.** Add local explorer state (selected/targets computed the same way `gameStore.select()`/`puzzleStore.select()` already compute theirs — via `ChessGame.legalMovesFrom`), gated to only be active while `reviewStore.status === 'ready'` and never mutating `reviewStore`'s own position:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChessGame } from '@/core/chessGame';
import { trackPieces } from '@/core/pieceTracking';
import type { Square as SquareName } from '@/core/types';
import { exploreMove, type ExploredMove } from '@/features/review/exploreMove';
import { useReviewStore } from '@/features/review/reviewStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { BoardView } from './BoardView';
import { MoveExplorerPopover } from './MoveExplorerPopover';
import styles from './Board.module.css';

const SWIPE_THRESHOLD_PX = 60;

interface Props {
  flipped: boolean;
}

export function ReviewBoard({ flipped }: Props) {
  const { t } = useTranslation();
  const { config, history, index, next, prev, status } = useReviewStore();
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const theme = BOARD_THEMES[useSettingsStore((s) => s.boardTheme)];
  const dragStartX = useRef<number | null>(null);
  const [explorerSelected, setExplorerSelected] = useState<SquareName | null>(null);
  const [explored, setExplored] = useState<ExploredMove | null>(null);
  const [exploring, setExploring] = useState(false);

  const visibleHistory = useMemo(() => history.slice(0, index + 1), [history, index]);
  const pieces = useMemo(() => trackPieces(config?.fen, visibleHistory), [config?.fen, visibleHistory]);
  const currentFen = index >= 0 ? visibleHistory[index].fen : (config?.fen ?? new ChessGame().fen());
  const currentGame = useMemo(() => new ChessGame(currentFen), [currentFen]);
  const checkSquare = useMemo(() => (currentGame.inCheck() ? currentGame.kingSquare(currentGame.turn()) : null), [currentGame]);
  const lastMove = index >= 0 ? { from: visibleHistory[index].from, to: visibleHistory[index].to } : null;
  const explorerTargets = explorerSelected ? currentGame.legalMovesFrom(explorerSelected) : [];
  const canExplore = status === 'ready';

  const style = { '--sq-light': theme.light, '--sq-dark': theme.dark } as CSSProperties;

  const closeExplorer = () => {
    setExplorerSelected(null);
    setExplored(null);
  };

  const onSquareClick = (sq: SquareName) => {
    if (!canExplore) return;
    if (explorerSelected && explorerTargets.includes(sq)) {
      const from = explorerSelected;
      setExplorerSelected(null);
      setExploring(true);
      exploreMove(currentFen, { from, to: sq }).then((result) => {
        setExplored(result);
        setExploring(false);
      });
      return;
    }
    const piece = currentGame.pieceAt(sq);
    if (piece?.color === currentGame.turn() && sq !== explorerSelected) setExplorerSelected(sq);
    else setExplorerSelected(null);
  };

  const onPointerDown = (e: PointerEvent) => {
    dragStartX.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (dragStartX.current === null) return;
    const delta = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return; // a tap, not a swipe — let onSquareClick handle it
    if (delta <= -SWIPE_THRESHOLD_PX) next();
    else if (delta >= SWIPE_THRESHOLD_PX) prev();
  };

  return (
    <div
      className={styles.board}
      style={{ ...style, touchAction: 'pan-y', position: 'relative' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <BoardView
        pieces={pieces}
        flipped={flipped}
        selected={explorerSelected}
        targets={canExplore ? explorerTargets : []}
        lastMove={lastMove}
        checkSquare={checkSquare}
        showLegalMoves={showLegalMoves}
        isCaptureTarget={(sq) => currentGame.pieceAt(sq) !== null}
        onSquareClick={canExplore ? onSquareClick : undefined}
      />
      {(exploring || explored) && (
        <MoveExplorerPopover move={explored} loading={exploring} onClose={closeExplorer} />
      )}
    </div>
  );
}
```
(Note: the existing swipe-vs-tap ambiguity — a real drag both moves `dragStartX` and would previously always call `next()`/`prev()` on pointer-up regardless of distance, per the original code's `delta <= -SWIPE_THRESHOLD_PX` / `delta >= SWIPE_THRESHOLD_PX` checks already gating on the threshold; adding `onSquareClick` for small taps needs the explicit `Math.abs(delta) < SWIPE_THRESHOLD_PX` early return added above so a tap-to-explore doesn't also fire a swipe navigation — this is a real behavior fix alongside the new feature, ledgered as a Ruling if this exact interaction wasn't previously reachable because there was no `onSquareClick` at all before this task.)

- [ ] **Step 4:** Run `npx vitest run`, `npm run typecheck`, `npm run build`, `npm run build:web` — all clean.

- [ ] **Step 5: Live verification:**
  - Review a game, at some ply click a legal move that was *not* played. Confirm the popover shows a tier badge + explanation, and the actual reviewed position/move list is untouched.
  - Confirm clicking while `reviewStore.status !== 'ready'` (mid-analysis) does nothing.
  - Confirm swipe-to-navigate (prev/next ply) still works after the tap/swipe disambiguation change.
  - Switch to Hebrew, confirm the popover's tier badge/text render correctly (reuses already-verified `tutor`/`stats` namespace content, so this is a regression check, not new translation surface).

- [ ] **Step 6:** Commit:
```bash
git add src/renderer/components/MoveExplorerPopover.tsx src/renderer/components/MoveExplorerPopover.module.css src/renderer/components/ReviewBoard.tsx
git commit -m "feat(explorer): click any legal move during review to see why it would (or wouldn't) work"
```

---

### Task 6: Opening Trainer — quiz store

**Files:**
- Create: `src/renderer/features/openings/openingQuizStore.ts`
- Create: `src/renderer/features/openings/openingQuizStore.test.ts`

**Interfaces:** Consumes `CuratedOpening` (`curatedOpenings.ts`, unchanged), `ChessGame`, `MoveInput`/`Color` (unchanged). Produces `useOpeningQuizStore` — consumed by Task 7's UI.

- [ ] **Step 1: Write the failing tests.**

```ts
// src/renderer/features/openings/openingQuizStore.test.ts
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
```

- [ ] **Step 2:** Run `npx vitest run src/renderer/features/openings/openingQuizStore.test.ts` → FAIL.

- [ ] **Step 3: Implement `openingQuizStore.ts`.**

```ts
// src/renderer/features/openings/openingQuizStore.ts
import { create } from 'zustand';
import { ChessGame } from '@/core/chessGame';
import type { Color, MoveInput } from '@/core/types';
import type { CuratedOpening } from './curatedOpenings';

const uciToMove = (uci: string): MoveInput => ({
  from: uci.slice(0, 2),
  to: uci.slice(2, 4),
  promotion: uci.length > 4 ? (uci[4] as MoveInput['promotion']) : undefined,
});

const sameMove = (a: MoveInput, b: MoveInput) => a.from === b.from && a.to === b.to;

interface OpeningQuizState {
  opening: CuratedOpening | null;
  side: Color;
  game: ChessGame;
  step: number;
  correctCount: number;
  status: 'idle' | 'playing' | 'done';
  lastWrong: { san: string; bookSan: string } | null;
  start(opening: CuratedOpening, side: Color): void;
  submitMove(move: MoveInput): void;
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

    start(opening, side) {
      set({ opening, side, game: new ChessGame(), step: 0, correctCount: 0, status: 'playing', lastWrong: null });
      advanceOpponentIfNeeded();
    },

    submitMove(move) {
      const { status, opening, step, side, game } = get();
      if (status !== 'playing' || !opening) return;
      const isPlayerTurn = step % 2 === (side === 'w' ? 0 : 1);
      if (!isPlayerTurn) return;

      const book = uciToMove(opening.sequence[step]);
      if (!sameMove(move, book)) {
        const bookSan = new ChessGame(game.fen()).move(book)?.san ?? opening.sequence[step];
        const attemptedSan = new ChessGame(game.fen()).move(move)?.san ?? `${move.from}${move.to}`;
        set({ lastWrong: { san: attemptedSan, bookSan } });
        return;
      }

      set({ lastWrong: null });
      playStep(step);
      set({ correctCount: get().correctCount + 1 });
      advanceOpponentIfNeeded();
    },

    exit() {
      set({ opening: null, game: new ChessGame(), step: 0, correctCount: 0, status: 'idle', lastWrong: null });
    },
  };
});
```

- [ ] **Step 4:** Run `npx vitest run src/renderer/features/openings/openingQuizStore.test.ts` → PASS.

- [ ] **Step 5:** Run `npm run typecheck` — clean.

- [ ] **Step 6:** Commit:
```bash
git add src/renderer/features/openings/openingQuizStore.ts src/renderer/features/openings/openingQuizStore.test.ts
git commit -m "feat(opening-trainer): quiz store — walk a curated line, grade the player's guesses"
```

---

### Task 7: Opening Trainer — UI

**Files:**
- Create: `src/renderer/components/OpeningQuizScreen.tsx`
- Create: `src/renderer/components/OpeningQuizScreen.module.css`
- Modify: `src/renderer/components/OpeningExplorerScreen.tsx`
- Modify: `src/renderer/locales/en/puzzles.json`, `src/renderer/locales/he/puzzles.json`, `src/renderer/locales/es/puzzles.json`

**Interfaces:** Consumes `useOpeningQuizStore` (Task 6).

- [ ] **Step 1: Add `puzzles.json` keys (×3 locales).**

`en`:
```json
"quiz": "🎯 Quiz",
"whatsTheMove": "What's the book move here?",
"notQuiteMove": "Not quite — the book move was {{san}}.",
"quizComplete": "{{correct}} / {{total}} correct",
"quizExit": "End quiz"
```
`he`:
```json
"quiz": "🎯 חידון",
"whatsTheMove": "מה המהלך הידוע כאן?",
"notQuiteMove": "לא בדיוק — המהלך הידוע היה {{san}}.",
"quizComplete": "{{correct}} / {{total}} נכונים",
"quizExit": "סיים חידון"
```
`es`:
```json
"quiz": "🎯 Cuestionario",
"whatsTheMove": "¿Cuál es el movimiento de libro aquí?",
"notQuiteMove": "No exactamente — el movimiento de libro era {{san}}.",
"quizComplete": "{{correct}} / {{total}} correctos",
"quizExit": "Terminar cuestionario"
```
(Feedback wording deliberately never calls the player's own move "wrong" — only names what the book move was, per Review Focus item 4.)

- [ ] **Step 2: Implement `OpeningQuizScreen.module.css`.**

```css
.screen {
  display: flex;
  justify-content: center;
  padding: 24px 16px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 420px;
}

.feedback {
  padding: 10px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--panel-raised);
  color: var(--text);
  font-size: 14px;
  min-height: 20px;
}

.progress {
  color: var(--muted);
  font-size: 14px;
  text-align: center;
}
```

- [ ] **Step 3: Implement `OpeningQuizScreen.tsx`.** Renders a read-only-except-on-your-turn board (reuses `BoardView` + local selected/targets state, the same pattern `ReviewBoard.tsx` now has from Task 5) plus a feedback line and progress counter.

```tsx
import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { trackPieces } from '@/core/pieceTracking';
import type { Square as SquareName } from '@/core/types';
import { useOpeningQuizStore } from '@/features/openings/openingQuizStore';
import { useSettingsStore } from '@/features/settings/settingsStore';
import { BOARD_THEMES } from '@/styles/themes';
import { BoardView } from './BoardView';
import styles from './OpeningQuizScreen.module.css';

interface Props {
  onExit: () => void;
}

export function OpeningQuizScreen({ onExit }: Props) {
  const { t } = useTranslation();
  const { opening, game, step, side, correctCount, status, lastWrong, submitMove, exit } = useOpeningQuizStore();
  const showLegalMoves = useSettingsStore((s) => s.showLegalMoves);
  const theme = BOARD_THEMES[useSettingsStore((s) => s.boardTheme)];
  const [selected, setSelected] = useState<SquareName | null>(null);

  const pieces = useMemo(() => trackPieces(undefined, game.history), [game]);
  const isPlayerTurn = status === 'playing' && step % 2 === (side === 'w' ? 0 : 1);
  const targets = selected ? game.legalMovesFrom(selected) : [];
  const style = { '--sq-light': theme.light, '--sq-dark': theme.dark } as CSSProperties;

  const onSquareClick = (sq: SquareName) => {
    if (!isPlayerTurn) return;
    if (selected && targets.includes(sq)) {
      submitMove({ from: selected, to: sq });
      setSelected(null);
      return;
    }
    const piece = game.pieceAt(sq);
    if (piece?.color === game.turn() && sq !== selected) setSelected(sq);
    else setSelected(null);
  };

  const leave = () => {
    exit();
    onExit();
  };

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.board} style={style}>
          <BoardView
            pieces={pieces}
            flipped={side === 'b'}
            selected={selected}
            targets={isPlayerTurn ? targets : []}
            lastMove={null}
            checkSquare={game.inCheck() ? game.kingSquare(game.turn()) : null}
            showLegalMoves={showLegalMoves}
            isCaptureTarget={(sq) => game.pieceAt(sq) !== null}
            onSquareClick={onSquareClick}
          />
        </div>

        {status === 'done' ? (
          <p className={styles.progress}>{t('puzzles:quizComplete', { correct: correctCount, total: Math.ceil((opening?.sequence.length ?? 0) / 2) })}</p>
        ) : (
          <p className={styles.feedback}>
            {lastWrong ? t('puzzles:notQuiteMove', { san: lastWrong.bookSan }) : t('puzzles:whatsTheMove')}
          </p>
        )}

        <button className="btn" onClick={leave}>
          {t('puzzles:quizExit')}
        </button>
      </div>
    </div>
  );
}
```
(`className={styles.board}` above needs a `.board` rule in the CSS added in Step 2 — add `display: grid; position: relative; aspect-ratio: 1;` matching `Board.module.css`'s `.board` base, or simplest: reuse `Board.module.css`'s own `.board` class directly via `import boardStyles from './Board.module.css'` instead of defining a new one — prefer that reuse over duplicating the grid/aspect-ratio rules.)

- [ ] **Step 4: Wire `OpeningExplorerScreen.tsx`.** Add a "🎯 Quiz" button per row and render `OpeningQuizScreen` in place of the list when a quiz is active:
```tsx
import { useOpeningQuizStore } from '@/features/openings/openingQuizStore';
import { OpeningQuizScreen } from './OpeningQuizScreen';
// ...
const quizStatus = useOpeningQuizStore((s) => s.status);
const startQuiz = useOpeningQuizStore((s) => s.start);

if (quizStatus !== 'idle') {
  return <OpeningQuizScreen onExit={() => {}} />;
}
```
And per opening row, alongside the existing Watch/Practice buttons:
```tsx
<button className="btn" onClick={() => startQuiz(opening, side)}>
  {t('puzzles:quiz')}
</button>
```

- [ ] **Step 5:** Run `npx vitest run`, `npm run typecheck`, `npm run build`, `npm run build:web` — all clean.

- [ ] **Step 6: Live verification:**
  - Start a quiz as White on a known opening, play the correct first move, confirm the opponent auto-plays its reply and it's the player's turn again.
  - Deliberately play a wrong (but legal) move, confirm the feedback names the book move without saying "wrong".
  - Complete a short line, confirm the `X / Y correct` summary and that "End quiz" returns to the opening list.
  - Start as Black, confirm White's first move auto-plays before the player does anything.
  - Switch to Hebrew, confirm quiz text/RTL renders correctly.

- [ ] **Step 7:** Commit:
```bash
git add src/renderer/components/OpeningQuizScreen.tsx src/renderer/components/OpeningQuizScreen.module.css src/renderer/components/OpeningExplorerScreen.tsx src/renderer/locales/en/puzzles.json src/renderer/locales/he/puzzles.json src/renderer/locales/es/puzzles.json
git commit -m "feat(opening-trainer): quiz UI — guess the book move, wired into Opening Explorer"
```

---

### Task 8: Game Summary — summarizer logic

**Files:**
- Modify: `src/renderer/features/history/weaknessStats.ts`
- Create: `src/renderer/features/review/summarizeGame.ts`
- Create: `src/renderer/features/review/summarizeGame.test.ts`
- Modify: `src/renderer/locales/en/stats.json`, `src/renderer/locales/he/stats.json`, `src/renderer/locales/es/stats.json`

**Interfaces:** Consumes `phaseBreakdown`/`tagFrequency`/`tierCounts`/`TAG_PHRASE_KEY` (`weaknessStats.ts` — `TAG_PHRASE_KEY` becomes exported, a one-line change, no behavior change), `MoveAnalysis` (`analyzeGame.ts`, unchanged). Produces `summarizeGame(analysis): string[]` — consumed by Task 9.

- [ ] **Step 1: Export `TAG_PHRASE_KEY` from `weaknessStats.ts`.** Change `const TAG_PHRASE_KEY: ...` to `export const TAG_PHRASE_KEY: ...` (the map is already exactly what's needed; this task reuses it instead of duplicating it). No other change to that file.

- [ ] **Step 2:** Run `npx vitest run src/renderer/features/history/weaknessStats.test.ts` → still PASS (confirms the export-only change didn't break anything).

- [ ] **Step 3: Add `stats.json` keys (×3 locales).** Every template avoids requiring gendered-article agreement on the interpolated phase name (the exact lesson from the i18n final review's Critical finding) — phase names are always object-of-preposition, never subject-with-article.

`en`:
```json
"summaryClean": "Clean game — no real mistakes to point out.",
"summaryOneRoughPhase": "Your roughest patch was the {{phase}} phase.",
"summaryMultipleRoughPhases": "You had trouble in a few phases: {{phases}}.",
"summaryTopMistake": "Most often it came down to {{tagPhrase}}.",
"summaryHadBrilliancy": "You also found at least one brilliant move — nice work."
```
`he`:
```json
"summaryClean": "משחק נקי — אין טעויות משמעותיות לציין.",
"summaryOneRoughPhase": "הקושי הגדול ביותר שלך היה ב{{phase}}.",
"summaryMultipleRoughPhases": "התקשית בכמה שלבים: {{phases}}.",
"summaryTopMistake": "לרוב זה נבע מ{{tagPhrase}}.",
"summaryHadBrilliancy": "גם מצאת לפחות מהלך מבריק אחד — עבודה יפה."
```
`es`:
```json
"summaryClean": "Partida limpia — sin errores importantes que señalar.",
"summaryOneRoughPhase": "Tu momento más flojo fue en la fase de {{phase}}.",
"summaryMultipleRoughPhases": "Tuviste dificultades en varias fases: {{phases}}.",
"summaryTopMistake": "Casi siempre por {{tagPhrase}}.",
"summaryHadBrilliancy": "También encontraste al menos un movimiento brillante — buen trabajo."
```
(`{{phases}}` for the multiple-rough-phases case is composed in code as phase names joined by " · " — the same language-agnostic separator style already used throughout the app's UI, e.g. `game:playerComputer`'s "Computer · Medium" — sidestepping list-joining grammar ("X and Y" vs "X, Y and Z") entirely rather than getting it wrong for he/es.)

- [ ] **Step 4: Write the failing tests.**

```ts
// src/renderer/features/review/summarizeGame.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { summarizeGame } from './summarizeGame';
import type { MoveAnalysis } from './analyzeGame';
import type { Tier } from '@/engine/classify';
import type { ExplanationTag } from '@/engine/explain';

afterEach(async () => {
  if (i18n.language !== 'en') await i18n.changeLanguage('en');
});

type Fixture = Pick<MoveAnalysis, 'ply' | 'tier' | 'tags'>;
const move = (ply: number, tier: Tier, tags: ExplanationTag[] = []): Fixture => ({ ply, tier, tags });

describe('summarizeGame', () => {
  it('returns nothing for an empty analysis', () => {
    expect(summarizeGame([])).toEqual([]);
  });

  it('names a clean game when nothing rises above good', () => {
    const analysis = [move(0, 'good'), move(1, 'best'), move(2, 'good')];
    expect(summarizeGame(analysis)).toEqual(['Clean game — no real mistakes to point out.']);
  });

  it('names the single roughest phase when only one clears the sample threshold', () => {
    // 5 opening-phase moves (ply < 10), 3 of them mistakes/blunders; nothing else.
    const analysis = [
      move(0, 'blunder', ['hangsPiece']),
      move(1, 'mistake', ['hangsPiece']),
      move(2, 'mistake'),
      move(3, 'good'),
      move(4, 'good'),
    ];
    const summary = summarizeGame(analysis);
    expect(summary[0]).toBe('Your roughest patch was the opening phase.');
  });

  it('names multiple rough phases, joined with · , when more than one clears the threshold', () => {
    const analysis = [
      move(0, 'blunder'), move(1, 'mistake'), move(2, 'blunder'), // opening: 3 mistakes/blunders
      move(30, 'blunder'), move(31, 'mistake'), move(32, 'blunder'), // endgame: 3 mistakes/blunders
    ];
    const summary = summarizeGame(analysis);
    expect(summary[0]).toBe('You had trouble in a few phases: Opening · Endgame.');
  });

  it('adds a top-mistake sentence naming the most frequent tag among the mistakes', () => {
    const analysis = [
      move(0, 'blunder', ['hangsPiece']),
      move(1, 'mistake', ['hangsPiece']),
      move(2, 'mistake', ['hangsPiece']),
    ];
    const summary = summarizeGame(analysis);
    expect(summary).toContain('Most often it came down to leaving a piece hanging.');
  });

  it('adds a brilliancy callout when at least one brilliant move exists, alongside a rough-phase note', () => {
    const analysis = [
      move(0, 'blunder'), move(1, 'mistake'), move(2, 'blunder'),
      move(10, 'brilliant'),
    ];
    const summary = summarizeGame(analysis);
    expect(summary).toContain('You also found at least one brilliant move — nice work.');
  });

  it('applies correct Spanish grammatical agreement for the single-rough-phase sentence', async () => {
    await i18n.changeLanguage('es');
    const analysis = [move(0, 'blunder'), move(1, 'mistake'), move(2, 'blunder'), move(3, 'good'), move(4, 'good')];
    expect(summarizeGame(analysis)[0]).toBe('Tu momento más flojo fue en la fase de Apertura.');
  });
});
```

- [ ] **Step 5:** Run `npx vitest run src/renderer/features/review/summarizeGame.test.ts` → FAIL.

- [ ] **Step 6: Implement `summarizeGame.ts`.**

```ts
// src/renderer/features/review/summarizeGame.ts
import { t } from '@/i18n';
import { phaseBreakdown, tagFrequency, tierCounts, TAG_PHRASE_KEY, type RecordedGame } from '@/features/history/weaknessStats';
import type { MoveAnalysis } from './analyzeGame';

// A phase needs at least this many moves *in this one game* before the summary comments on it — lower
// than weaknessStats' cross-game MIN_SAMPLE_SIZE (5) since a single game's opening/middlegame/endgame
// split is naturally smaller than an aggregate across many games.
const MIN_PHASE_SAMPLE = 3;

function asRecordedGame(analysis: Pick<MoveAnalysis, 'ply' | 'tier' | 'tags'>[]): RecordedGame {
  return { id: 'current', playedAt: '', moves: analysis.map((a) => ({ ply: a.ply, tier: a.tier, tags: a.tags })) };
}

/**
 * A short natural-language recap of one game's review, built from the same phase/tag machinery My Stats
 * already uses (`phaseBreakdown`/`tagFrequency`/`tierCounts`) — scoped to this one game instead of the
 * whole play history.
 */
export function summarizeGame(analysis: Pick<MoveAnalysis, 'ply' | 'tier' | 'tags'>[]): string[] {
  if (analysis.length === 0) return [];

  const game = asRecordedGame(analysis);
  const tiers = tierCounts([game]);
  const phases = phaseBreakdown([game]).filter((p) => p.totalMoves >= MIN_PHASE_SAMPLE);
  const tags = tagFrequency([game]);
  const roughPhases = phases.filter((p) => p.mistakeCount > 0).sort((a, b) => b.mistakeRate - a.mistakeRate);

  const sentences: string[] = [];

  if (roughPhases.length === 0) {
    sentences.push(t('stats:summaryClean'));
  } else if (roughPhases.length === 1) {
    sentences.push(t('stats:summaryOneRoughPhase', { phase: t(`stats:phase_${roughPhases[0].phase}`) }));
  } else {
    const phases = roughPhases.map((p) => t(`stats:phase_${p.phase}`)).join(' · ');
    sentences.push(t('stats:summaryMultipleRoughPhases', { phases }));
  }

  if (roughPhases.length > 0 && tags.length > 0) {
    const tagKey = TAG_PHRASE_KEY[tags[0].tag];
    if (tagKey) sentences.push(t('stats:summaryTopMistake', { tagPhrase: t(`stats:${tagKey}`) }));
  }

  if (tiers.brilliant > 0) sentences.push(t('stats:summaryHadBrilliancy'));

  return sentences;
}
```

- [ ] **Step 7:** Run `npx vitest run src/renderer/features/review/summarizeGame.test.ts` → PASS.

- [ ] **Step 8:** Run `npm run typecheck` — clean.

- [ ] **Step 9:** Commit:
```bash
git add src/renderer/features/history/weaknessStats.ts src/renderer/features/review/summarizeGame.ts src/renderer/features/review/summarizeGame.test.ts src/renderer/locales/en/stats.json src/renderer/locales/he/stats.json src/renderer/locales/es/stats.json
git commit -m "feat(summary): summarizeGame — one-paragraph review recap, reusing My Stats' own machinery"
```

---

### Task 9: Game Summary — TutorPanel wiring

**Files:**
- Modify: `src/renderer/components/TutorPanel.tsx`
- Modify: `src/renderer/components/TutorPanel.module.css`

**Interfaces:** Consumes `summarizeGame` (Task 8), `reviewStore.analysis`/`status` (unchanged).

- [ ] **Step 1: Wire `TutorPanel.tsx`.** Compute the summary once when analysis becomes ready (not per-ply), render above the existing per-move header:
```tsx
import { useMemo } from 'react';
import { summarizeGame } from '@/features/review/summarizeGame';
// ... inside the component, alongside the existing `const { analysis, index, status, ... } = useReviewStore();`
const summary = useMemo(() => (status === 'ready' ? summarizeGame(analysis) : []), [status, analysis]);
```
Render it above the existing `<div className={styles.header}>`:
```tsx
{summary.length > 0 && (
  <div className={styles.summary}>
    {summary.map((s, i) => <p key={i}>{s}</p>)}
  </div>
)}
```
Add the corresponding rule to `TutorPanel.module.css`:
```css
.summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--panel-raised);
  color: var(--text);
  font-size: 14px;
}
```

- [ ] **Step 2:** Run `npx vitest run`, `npm run typecheck`, `npm run build`, `npm run build:web` — all clean.

- [ ] **Step 3: Live verification:**
  - Review a game with a clear blunder in one phase, confirm the summary paragraph appears once analysis finishes and correctly names that phase.
  - Review a clean game (or a short one with no mistakes), confirm the "Clean game" sentence appears instead.
  - Switch to Spanish, review a game where the roughest phase is the opening, confirm "la fase de Apertura" (not "el Apertura" or any other mismatch).
  - Confirm the summary does *not* recompute/flicker on every `goTo()` ply change — only once when `status` becomes `'ready'`.

- [ ] **Step 4:** Commit:
```bash
git add src/renderer/components/TutorPanel.tsx src/renderer/components/TutorPanel.module.css
git commit -m "feat(summary): render the game summary at the top of the Tutor panel"
```

---

### Task 10: Glossary — content and namespace

**Files:**
- Create: `src/renderer/locales/en/glossary.json`, `src/renderer/locales/he/glossary.json`, `src/renderer/locales/es/glossary.json`
- Modify: `src/renderer/i18n/index.ts`
- Create: `src/renderer/features/glossary/glossaryTerms.ts`
- Modify: `src/renderer/locales/en/common.json`, `src/renderer/locales/he/common.json`, `src/renderer/locales/es/common.json`

**Interfaces:** Produces the `glossary` namespace, `GLOSSARY_KEYS` — consumed by Task 11's UI.

- [ ] **Step 1: Create `glossaryTerms.ts`.**

```ts
// src/renderer/features/glossary/glossaryTerms.ts
/** Each entry has a `term_<key>`/`def_<key>` pair in glossary.json, all three locales. */
export const GLOSSARY_KEYS = [
  'enPassant', 'castlingKingside', 'castlingQueenside', 'check', 'checkmate', 'stalemate',
  'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleAttack', 'zugzwang', 'zwischenzug',
  'fianchetto', 'outpost', 'isolatedPawn', 'passedPawn', 'doubledPawns', 'backRankMate',
  'perpetualCheck', 'opposition', 'tempo', 'development', 'material', 'centipawn',
  'overloadedPiece', 'smotheredMate', 'enPrise', 'tactic', 'sacrifice',
] as const;
export type GlossaryKey = (typeof GLOSSARY_KEYS)[number];
```

- [ ] **Step 2: Create `glossary.json` (×3 locales).**

`src/renderer/locales/en/glossary.json`:
```json
{
  "term_enPassant": "En passant", "def_enPassant": "A special pawn capture: if an enemy pawn moves two squares and lands beside yours, you may capture it as though it had only moved one — but only on your very next move.",
  "term_castlingKingside": "Castling, kingside", "def_castlingKingside": "A king-and-rook move toward the h-file, getting the king to safety and the rook into play in one move.",
  "term_castlingQueenside": "Castling, queenside", "def_castlingQueenside": "A king-and-rook move toward the a-file — same idea as kingside castling, the other direction.",
  "term_check": "Check", "def_check": "Your king is under direct attack. You must get out of check immediately — move the king, block the attack, or capture the attacker.",
  "term_checkmate": "Checkmate", "def_checkmate": "A check with no way out. The game ends immediately.",
  "term_stalemate": "Stalemate", "def_stalemate": "The player to move has no legal move and is not in check. The game is a draw.",
  "term_fork": "Fork", "def_fork": "One piece attacking two (or more) enemy pieces at the same time, so the opponent can't save them all.",
  "term_pin": "Pin", "def_pin": "A piece can't move (or shouldn't) because doing so would expose a more valuable piece behind it to attack.",
  "term_skewer": "Skewer", "def_skewer": "Like a pin in reverse: attacking a valuable piece that, if it moves, exposes a less valuable one behind it.",
  "term_discoveredAttack": "Discovered attack", "def_discoveredAttack": "Moving one piece out of the way reveals an attack from another piece behind it.",
  "term_doubleAttack": "Double attack", "def_doubleAttack": "A single move that creates two threats at once, so the opponent can only defend against one.",
  "term_zugzwang": "Zugzwang", "def_zugzwang": "A position where any legal move makes things worse for the player to move — they'd rather pass, but chess doesn't allow that.",
  "term_zwischenzug": "Zwischenzug", "def_zwischenzug": "An 'in-between move' — instead of the expected reply, a player inserts a surprising, more urgent move first.",
  "term_fianchetto": "Fianchetto", "def_fianchetto": "Developing a bishop to the long diagonal by moving it to the square next to a knight, after the knight's pawn has advanced.",
  "term_outpost": "Outpost", "def_outpost": "A square, usually in enemy territory, where a piece (often a knight) can sit safely because no enemy pawn can ever attack it.",
  "term_isolatedPawn": "Isolated pawn", "def_isolatedPawn": "A pawn with no friendly pawns on either neighboring file to defend it if attacked.",
  "term_passedPawn": "Passed pawn", "def_passedPawn": "A pawn with no enemy pawns in front of it (on its file or the two adjacent files) to stop it from promoting.",
  "term_doubledPawns": "Doubled pawns", "def_doubledPawns": "Two of your own pawns stacked on the same file — usually a structural weakness.",
  "term_backRankMate": "Back-rank mate", "def_backRankMate": "Checkmate delivered along a player's own first rank, because their king had no escape square — typically trapped behind its own pawns.",
  "term_perpetualCheck": "Perpetual check", "def_perpetualCheck": "A repeating sequence of checks neither side can escape, leading to a draw by repetition.",
  "term_opposition": "Opposition", "def_opposition": "An endgame king standoff: two kings face off with one square between them, and it's important whose turn it is to move.",
  "term_tempo": "Tempo", "def_tempo": "A 'move' of relative time — gaining a tempo means getting ahead in development or position for free, often by making a threat the opponent must answer.",
  "term_development": "Development", "def_development": "Bringing your pieces out from their starting squares into the game, especially in the opening.",
  "term_material": "Material", "def_material": "The total value of the pieces and pawns a player has on the board.",
  "term_centipawn": "Centipawn", "def_centipawn": "The engine's unit for measuring advantage — 100 centipawns is roughly worth one pawn.",
  "term_overloadedPiece": "Overloaded piece", "def_overloadedPiece": "A piece defending two things at once, so it can be distracted or removed to win one of them.",
  "term_smotheredMate": "Smothered mate", "def_smotheredMate": "Checkmate by a knight against a king that has no escape square because it's completely surrounded by its own pieces.",
  "term_enPrise": "En prise", "def_enPrise": "A piece that can be captured for free (or for less than it's worth) right now.",
  "term_tactic": "Tactic", "def_tactic": "A short forcing sequence — checks, captures, threats — that wins material or delivers checkmate.",
  "term_sacrifice": "Sacrifice", "def_sacrifice": "Giving up material on purpose, betting that what you get in return (an attack, a better position, forced mate) is worth more."
}
```

`src/renderer/locales/he/glossary.json`:
```json
{
  "term_enPassant": "אנפסן", "def_enPassant": "אכילת רגלי מיוחדת: אם רגלי יריב זז שני משבצות ונוחת ליד שלך, אתה יכול לאכול אותו כאילו זז רק משבצת אחת — אך רק במהלך שלך הבא מיד.",
  "term_castlingKingside": "הצרחה קצרה", "def_castlingKingside": "מהלך משותף של המלך והצריח לכיוון עמודת ה-h, שמביא את המלך למקום בטוח ואת הצריח למשחק במהלך אחד.",
  "term_castlingQueenside": "הצרחה ארוכה", "def_castlingQueenside": "מהלך משותף של המלך והצריח לכיוון עמודת ה-a — אותו רעיון כמו הצרחה קצרה, לכיוון ההפוך.",
  "term_check": "שח", "def_check": "המלך שלך נתון להתקפה ישירה. עליך לצאת משח מיד — להזיז את המלך, לחסום את ההתקפה, או לאכול את התוקף.",
  "term_checkmate": "מט", "def_checkmate": "שח שאין ממנו מוצא. המשחק מסתיים מיד.",
  "term_stalemate": "פט", "def_stalemate": "לשחקן שאמור לזוז אין מהלך חוקי והוא אינו בשח. המשחק מסתיים בתיקו.",
  "term_fork": "מזלג", "def_fork": "כלי אחד תוקף שני כלי יריב (או יותר) בו-זמנית, כך שהיריב לא יכול להציל את שניהם.",
  "term_pin": "ריתוק", "def_pin": "כלי לא יכול (או לא כדאי לו) לזוז כי זה יחשוף כלי יקר יותר מאחוריו להתקפה.",
  "term_skewer": "שיפוד", "def_skewer": "כמו ריתוק הפוך: תקיפת כלי יקר שאם יזוז, יחשוף כלי פחות יקר מאחוריו.",
  "term_discoveredAttack": "התקפה מגלה", "def_discoveredAttack": "הזזת כלי אחד הצידה חושפת התקפה מכלי אחר שמאחוריו.",
  "term_doubleAttack": "התקפה כפולה", "def_doubleAttack": "מהלך אחד שיוצר שני איומים בו-זמנית, כך שהיריב יכול להתגונן רק מפני אחד מהם.",
  "term_zugzwang": "צוגצוואנג", "def_zugzwang": "עמדה שבה כל מהלך חוקי מחמיר את מצבו של השחקן שאמור לזוז — הוא היה מעדיף לוותר על התור, אך זה לא אפשרי בשחמט.",
  "term_zwischenzug": "צווישנצוג", "def_zwischenzug": "'מהלך ביניים' — במקום התגובה הצפויה, שחקן מכניס מהלך דחוף ומפתיע יותר קודם.",
  "term_fianchetto": "פיאנקטו", "def_fianchetto": "פיתוח רץ לאלכסון הארוך על ידי הזזתו למשבצת ליד הסוס, לאחר שרגלי הסוס התקדם.",
  "term_outpost": "מוצב קדמי", "def_outpost": "משבצת, בדרך כלל בשטח היריב, שבה כלי (לרוב סוס) יכול לשבת בבטחה כי אף רגלי יריב לא יכול לתקוף אותה אי פעם.",
  "term_isolatedPawn": "רגלי מבודד", "def_isolatedPawn": "רגלי ללא רגלים ידידותיים באחת מהעמודות הסמוכות להגן עליו אם יותקף.",
  "term_passedPawn": "רגלי עובר", "def_passedPawn": "רגלי ללא רגלי יריב לפניו (בעמודה שלו או בשתי העמודות הסמוכות) שיכול לעצור אותו מלהתקדם.",
  "term_doubledPawns": "רגלים כפולים", "def_doubledPawns": "שני רגלים משלך בעמודה אחת — בדרך כלל חולשה מבנית.",
  "term_backRankMate": "מט בשורה האחרונה", "def_backRankMate": "מט שמתבצע לאורך השורה הראשונה של שחקן, כי למלך שלו לא הייתה משבצת מילוט — בדרך כלל לכוד מאחורי הרגלים שלו.",
  "term_perpetualCheck": "שח נצחי", "def_perpetualCheck": "רצף שחים חוזר שאף צד לא יכול להימלט ממנו, המוביל לתיקו על ידי חזרה.",
  "term_opposition": "אופוזיציה", "def_opposition": "עימות מלכים בסוף המשחק: שני מלכים ניצבים זה מול זה עם משבצת אחת ביניהם, וחשוב מי תורו לזוז.",
  "term_tempo": "טמפו", "def_tempo": "'מהלך' של זמן יחסי — הרווחת טמפו משמעה להתקדם בפיתוח או בעמדה בחינם, לרוב על ידי יצירת איום שהיריב חייב לענות עליו.",
  "term_development": "פיתוח", "def_development": "הוצאת הכלים שלך מהמשבצות ההתחלתיות שלהם אל תוך המשחק, במיוחד בפתיחה.",
  "term_material": "חומר", "def_material": "הערך הכולל של הכלים והרגלים שיש לשחקן על הלוח.",
  "term_centipawn": "סנטיפון", "def_centipawn": "יחידת המדידה של המנוע ליתרון — 100 סנטיפונים שווים בערך לרגלי אחד.",
  "term_overloadedPiece": "כלי עמוס יתר", "def_overloadedPiece": "כלי שמגן על שני דברים בו-זמנית, כך שניתן להסיח את דעתו או להסירו כדי לזכות באחד מהם.",
  "term_smotheredMate": "מט חנוק", "def_smotheredMate": "מט על ידי סוס נגד מלך שאין לו משבצת מילוט כי הוא מוקף לחלוטין בכליו שלו.",
  "term_enPrise": "אנפריז", "def_enPrise": "כלי שניתן לאכול בחינם (או בפחות ממה שהוא שווה) ברגע זה.",
  "term_tactic": "טקטיקה", "def_tactic": "רצף כפוי קצר — שחים, אכילות, איומים — שזוכה בחומר או מוביל למט.",
  "term_sacrifice": "הקרבה", "def_sacrifice": "ויתור מכוון על חומר, מתוך הימור שמה שמקבלים בתמורה (התקפה, עמדה טובה יותר, מט כפוי) שווה יותר."
}
```

`src/renderer/locales/es/glossary.json`:
```json
{
  "term_enPassant": "Al paso", "def_enPassant": "Una captura especial de peón: si un peón rival avanza dos casillas y queda junto al tuyo, puedes capturarlo como si solo hubiera avanzado una — pero solo en tu siguiente movimiento inmediato.",
  "term_castlingKingside": "Enroque corto", "def_castlingKingside": "Un movimiento conjunto de rey y torre hacia la columna h, que pone al rey a salvo y saca la torre a jugar en un solo movimiento.",
  "term_castlingQueenside": "Enroque largo", "def_castlingQueenside": "Un movimiento conjunto de rey y torre hacia la columna a — la misma idea que el enroque corto, hacia el otro lado.",
  "term_check": "Jaque", "def_check": "Tu rey está bajo ataque directo. Debes salir del jaque de inmediato — mover el rey, bloquear el ataque o capturar al atacante.",
  "term_checkmate": "Jaque mate", "def_checkmate": "Un jaque sin salida. La partida termina de inmediato.",
  "term_stalemate": "Rey ahogado", "def_stalemate": "El jugador en turno no tiene movimiento legal y no está en jaque. La partida es tablas.",
  "term_fork": "Horquilla", "def_fork": "Una pieza que ataca a dos (o más) piezas rivales a la vez, de modo que el rival no puede salvarlas todas.",
  "term_pin": "Clavada", "def_pin": "Una pieza no puede (o no conviene que) mover porque eso expondría a una pieza más valiosa detrás de ella.",
  "term_skewer": "Rayo X", "def_skewer": "Como una clavada al revés: atacar una pieza valiosa que, si se mueve, expone a una menos valiosa detrás de ella.",
  "term_discoveredAttack": "Ataque descubierto", "def_discoveredAttack": "Mover una pieza revela un ataque de otra pieza que estaba detrás de ella.",
  "term_doubleAttack": "Doble ataque", "def_doubleAttack": "Un solo movimiento que crea dos amenazas a la vez, de modo que el rival solo puede defenderse de una.",
  "term_zugzwang": "Zugzwang", "def_zugzwang": "Una posición donde cualquier movimiento legal empeora la situación del jugador en turno — preferiría pasar, pero el ajedrez no lo permite.",
  "term_zwischenzug": "Zwischenzug", "def_zwischenzug": "Un 'movimiento intermedio' — en lugar de la respuesta esperada, un jugador inserta primero un movimiento más urgente y sorprendente.",
  "term_fianchetto": "Fianchetto", "def_fianchetto": "Desarrollar un alfil hacia la diagonal larga moviéndolo a la casilla junto al caballo, después de que el peón del caballo haya avanzado.",
  "term_outpost": "Puesto avanzado", "def_outpost": "Una casilla, normalmente en territorio rival, donde una pieza (a menudo un caballo) puede estar segura porque ningún peón rival podrá atacarla jamás.",
  "term_isolatedPawn": "Peón aislado", "def_isolatedPawn": "Un peón sin peones propios en ninguna columna vecina que lo defiendan si es atacado.",
  "term_passedPawn": "Peón pasado", "def_passedPawn": "Un peón sin peones rivales por delante (en su columna o las dos columnas adyacentes) que puedan detener su coronación.",
  "term_doubledPawns": "Peones doblados", "def_doubledPawns": "Dos peones propios apilados en la misma columna — normalmente una debilidad estructural.",
  "term_backRankMate": "Mate en la fila final", "def_backRankMate": "Jaque mate dado en la primera fila propia de un jugador, porque su rey no tenía casilla de escape — típicamente atrapado detrás de sus propios peones.",
  "term_perpetualCheck": "Jaque perpetuo", "def_perpetualCheck": "Una secuencia repetida de jaques de la que ningún bando puede escapar, llevando a tablas por repetición.",
  "term_opposition": "Oposición", "def_opposition": "Un enfrentamiento de reyes en el final: dos reyes se encaran con una casilla entre ellos, y importa a quién le toca mover.",
  "term_tempo": "Tiempo", "def_tempo": "Un 'movimiento' de tiempo relativo — ganar un tiempo significa adelantarse en desarrollo o posición gratis, a menudo creando una amenaza que el rival debe responder.",
  "term_development": "Desarrollo", "def_development": "Sacar tus piezas de sus casillas iniciales hacia el juego, especialmente en la apertura.",
  "term_material": "Material", "def_material": "El valor total de las piezas y peones que tiene un jugador en el tablero.",
  "term_centipawn": "Centipeón", "def_centipawn": "La unidad del motor para medir la ventaja — 100 centipeones equivalen aproximadamente a un peón.",
  "term_overloadedPiece": "Pieza sobrecargada", "def_overloadedPiece": "Una pieza que defiende dos cosas a la vez, por lo que se la puede distraer o eliminar para ganar una de ellas.",
  "term_smotheredMate": "Mate sofocado", "def_smotheredMate": "Jaque mate dado por un caballo contra un rey sin casilla de escape porque está completamente rodeado por sus propias piezas.",
  "term_enPrise": "En prise", "def_enPrise": "Una pieza que se puede capturar gratis (o por menos de lo que vale) ahora mismo.",
  "term_tactic": "Táctica", "def_tactic": "Una secuencia forzada corta — jaques, capturas, amenazas — que gana material o da jaque mate.",
  "term_sacrifice": "Sacrificio", "def_sacrifice": "Entregar material a propósito, apostando a que lo que se recibe a cambio (un ataque, una mejor posición, mate forzado) vale más."
}
```

- [ ] **Step 3: Register the `glossary` namespace in `i18n/index.ts`.**
```ts
import glossaryEn from '@/locales/en/glossary.json';
import glossaryHe from '@/locales/he/glossary.json';
import glossaryEs from '@/locales/es/glossary.json';
// ... add `glossary: glossaryEn` / `glossaryHe` / `glossaryEs` to each locale's resources entry, same pattern as the other six namespaces.
```

- [ ] **Step 4: Add `common.json`'s `glossary` menu key (×3 locales).**
`en`: `"glossary": "📚 Glossary"`
`he`: `"glossary": "📚 מילון מונחים"`
`es`: `"glossary": "📚 Glosario"`

- [ ] **Step 5:** Run `npx vitest run`, `npm run typecheck` — clean (i18n's own `index.test.ts` tests still pass unaffected by the new namespace).

- [ ] **Step 6:** Commit:
```bash
git add src/renderer/locales/en/glossary.json src/renderer/locales/he/glossary.json src/renderer/locales/es/glossary.json src/renderer/locales/en/common.json src/renderer/locales/he/common.json src/renderer/locales/es/common.json src/renderer/i18n/index.ts src/renderer/features/glossary/glossaryTerms.ts
git commit -m "feat(glossary): term/definition content, ×3 locales, new namespace"
```

---

### Task 11: Glossary — screen and menu entry

**Files:**
- Create: `src/renderer/features/glossary/glossaryVisibilityStore.ts`
- Create: `src/renderer/components/GlossaryScreen.tsx`
- Create: `src/renderer/components/GlossaryScreen.module.css`
- Modify: `src/renderer/components/NewGameMenu.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/locales/en/common.json`, `src/renderer/locales/he/common.json`, `src/renderer/locales/es/common.json`

**Interfaces:** Consumes `GLOSSARY_KEYS` (Task 10).

- [ ] **Step 1: Create `glossaryVisibilityStore.ts`.**
```ts
// src/renderer/features/glossary/glossaryVisibilityStore.ts
import { createVisibilityStore } from '@/features/shared/visibilityStore';

/** Just a screen-visibility flag — Glossary has no other state (no persisted progress, nothing to load). */
export const useGlossaryVisibilityStore = createVisibilityStore();
```

- [ ] **Step 2: Add the search-placeholder and empty-state keys to `common.json` (×3 locales).**
`en`: `"glossarySearch": "Search terms…"`, `"glossaryEmpty": "No terms match."`
`he`: `"glossarySearch": "חפש מונחים…"`, `"glossaryEmpty": "לא נמצאו מונחים תואמים."`
`es`: `"glossarySearch": "Buscar términos…"`, `"glossaryEmpty": "Ningún término coincide."`

- [ ] **Step 3: Implement `GlossaryScreen.module.css`.**
```css
.screen {
  display: flex;
  justify-content: center;
  padding: 24px 16px;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 520px;
}

.search {
  padding: 10px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--panel-raised);
  color: var(--text);
  font: inherit;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 60vh;
  overflow-y: auto;
}

.entry {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--panel-raised);
}

.term {
  font-weight: 700;
  color: var(--accent);
}

.definition {
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
}

.empty {
  color: var(--muted);
  text-align: center;
  padding: 20px 0;
}
```

- [ ] **Step 4: Implement `GlossaryScreen.tsx`.** Filters against the *translated* text (Review Focus item 5), never the raw key.
```tsx
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GLOSSARY_KEYS } from '@/features/glossary/glossaryTerms';
import styles from './GlossaryScreen.module.css';

interface Props {
  onExit: () => void;
}

export function GlossaryScreen({ onExit }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const entries = useMemo(
    () => GLOSSARY_KEYS.map((key) => ({ key, term: t(`glossary:term_${key}`), definition: t(`glossary:def_${key}`) })),
    [t],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    // Matches against the resolved (translated) term/definition text, never the raw term_* key — a
    // Hebrew or Spanish player searching in their own language must be able to find terms.
    return entries.filter((e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q));
  }, [entries, query]);

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1>{t('common:glossary')}</h1>
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('common:glossarySearch')}
        />
        <div className={styles.list}>
          {filtered.length === 0 && <p className={styles.empty}>{t('common:glossaryEmpty')}</p>}
          {filtered.map((e) => (
            <div key={e.key} className={styles.entry}>
              <p className={styles.term}>{e.term}</p>
              <p className={styles.definition}>{e.definition}</p>
            </div>
          ))}
        </div>
        <button className="btn" onClick={onExit}>
          {t('common:menu')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Wire `NewGameMenu.tsx`.** Add a new menu button alongside the existing Puzzles/Openings/My Stats/Saved games/Play Online buttons:
```tsx
import { useGlossaryVisibilityStore } from '@/features/glossary/glossaryVisibilityStore';
// ...
const showGlossary = useGlossaryVisibilityStore((s) => s.show);
// ... in the JSX:
<button className="btn" onClick={showGlossary}>
  {t('common:glossary')}
</button>
```

- [ ] **Step 6: Wire `App.tsx`.**
```tsx
import { GlossaryScreen } from './components/GlossaryScreen';
import { useGlossaryVisibilityStore } from './features/glossary/glossaryVisibilityStore';
// ...
const viewingGlossary = useGlossaryVisibilityStore((s) => s.visible);
const hideGlossary = useGlossaryVisibilityStore((s) => s.hide);
// ... add a branch, e.g. right after the `viewingSavedGames` branch:
if (viewingGlossary) return <GlossaryScreen onExit={hideGlossary} />;
```

- [ ] **Step 7:** Run `npx vitest run`, `npm run typecheck`, `npm run build`, `npm run build:web` — all clean.

- [ ] **Step 8: Live verification:**
  - Open Glossary from the menu, confirm all ~29 terms render with definitions.
  - Search for a partial word that only appears in a definition (not a term), confirm it still matches.
  - Switch to Hebrew, confirm the search filter still matches Hebrew text typed in Hebrew, and RTL layout is correct.
  - Confirm searching for the raw key text (e.g. "enPassant", camelCase) does *not* spuriously match when the visible term is different (proves the filter runs against translated text, not the key).

- [ ] **Step 9:** Commit:
```bash
git add src/renderer/features/glossary/glossaryVisibilityStore.ts src/renderer/components/GlossaryScreen.tsx src/renderer/components/GlossaryScreen.module.css src/renderer/components/NewGameMenu.tsx src/renderer/App.tsx src/renderer/locales/en/common.json src/renderer/locales/he/common.json src/renderer/locales/es/common.json
git commit -m "feat(glossary): searchable glossary screen, wired into the main menu"
```

---

### Task 12: Final sweep and cross-feature verification

**Files:**
- Modify: any file the sweep below finds still hardcoded.

**Interfaces:** None new — final integration pass.

- [ ] **Step 1: Sweep for hardcoded strings** in every file this plan touched or created, using both the line-based and multiline patterns the i18n plan's own final sweep needed (the single-line grep alone missed two real cases last time):
```bash
grep -rnoE ">[^<>{}\n][a-zA-Z ,.'!?…0-9]{2,80}<" src/renderer/components/*.tsx
```
and, for multi-line JSX text nodes and emoji-prefixed text (the exact class the i18n final review caught):
```bash
grep -rnoE ">[^<>{}\n]*[A-Za-z]{3,}[^<>{}\n]*<" src/renderer/components/*.tsx
```
Fix anything found the same way every prior task did: `t()` calls to already-registered keys, or new keys in the fitting namespace (×3 locales) if genuinely new.

- [ ] **Step 2:** Run `npx vitest run`, `npm run typecheck`, `npm run build`, `npm run build:web` — all clean.

- [ ] **Step 3: Cross-feature live verification:**
  - Play several games in a row, confirm the Blunder Vault accumulates entries without ever noticeably slowing down starting a new game.
  - Confirm a fresh install (clear `localStorage`, or a fresh profile) with pre-existing saved games (seed a couple manually or just play 2-3 games first) triggers the one-time backfill and the vault isn't empty after a short wait.
  - Full end-to-end pass in Hebrew: menu → Glossary → back → start a game → blunder on purpose → finish → Puzzle Map shows "My Mistakes" → solve it → My Stats shows a game summary line from a prior review → Opening Explorer → Quiz a line → Review a game → click a legal alternative move for the "why not X" explanation. Confirm no raw English/untranslated keys appear anywhere in this whole path, and RTL layout holds throughout.
  - Same pass in Spanish, paying specific attention to every phase/piece-name-bearing sentence (game summary, move descriptions) for gender agreement.
  - Confirm the app still boots and plays a normal game with `localStorage` completely cleared (all five new stores start empty/absent without error).

- [ ] **Step 4:** Commit:
```bash
git add -A
git commit -m "feat: final sweep — learning enhancements cross-feature verification"
```

---

## Self-Review

- **Spec coverage:** all five features from the design spec are covered — Blunder Vault (Tasks 1-3), Why-not-X (Tasks 4-5), Opening Trainer (Tasks 6-7), Game Summary (Tasks 8-9), Glossary (Tasks 10-11), final sweep (Task 12).
- **Type consistency:** `VaultEntry`/`useBlunderVaultStore` (Task 1) consumed unchanged by Tasks 2-3; `enqueueBackgroundAnalysis`/`abortBackgroundAnalysis` (Task 2) consumed unchanged by Task 3 (indirectly, via `backfillVault.ts`) and referenced (as a constraint) by Tasks 4-5's worker-dispatch requirement; `exploreMove`/`ExploredMove` (Task 4) consumed unchanged by Task 5; `useOpeningQuizStore` (Task 6) consumed unchanged by Task 7; `summarizeGame`/exported `TAG_PHRASE_KEY` (Task 8) consumed unchanged by Task 9; `GLOSSARY_KEYS` (Task 10) consumed unchanged by Task 11.
- **Placeholder scan:** none — every JSON resource file has real content in all three locales, every code step has real implementation, every test has real assertions.
- **Review Focus:** all five items have an owning task with a specific test or live-verification step: (1) Task 2's abort tests + Task 12's "doesn't slow down starting a new game" check; (2) Task 1's cap/eviction test; (3) Task 8's Spanish-agreement test; (4) Task 7's feedback-wording step + live check; (5) Task 11's key-vs-translated-text live check.
