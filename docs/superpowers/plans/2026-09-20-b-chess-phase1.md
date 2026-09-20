# B-Chess Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a polished, animated, cross-platform Electron chess app: local 1v2, vs computer (3 levels), configurable clocks, legal-move hints.

**Architecture:** Pure-TS `core` + `clock` + `engine` modules (unit tested) sit under a Zustand game store that drives turns through a `PlayerController` interface (human / engine / future remote). React components render state; Framer Motion animates pieces. Engine runs in a Web Worker.

**Tech Stack:** Electron 44, electron-vite 3, Vite 6, React 19, TypeScript, Zustand, Framer Motion, chess.js, Vitest, electron-builder.

**Spec:** `docs/superpowers/specs/2026-09-20-b-chess-design.md`

## Global Constraints

- Node 20.18 must work (electron-vite `^3`, vite `^6`; do NOT use vite 7 / electron-vite 4).
- Everything free / open source. No paid services.
- Windows + macOS installers via electron-builder; unsigned.
- Dependency rule: `components → features → core`; `core`, `clock`, `engine` import no React/Electron.
- Legal-move hint toggle default ON; hints drawn as blue borders.
- No drag-and-drop in phase 1; click-click only.
- Code: small focused files, no duplicated logic, comments only where non-obvious.

## File Structure

```
package.json  electron.vite.config.ts  tsconfig.json  tsconfig.node.json  tsconfig.web.json
electron-builder.yml  vitest.config.ts  README.md  ASSETS.md  .gitignore
.github/workflows/release.yml
src/main/index.ts                      window creation
src/preload/index.ts                   empty bridge (phase 2 seam)
src/renderer/index.html  main.tsx  App.tsx
src/renderer/core/types.ts             shared types
src/renderer/core/chessGame.ts         chess.js adapter (ChessGame class)
src/renderer/core/chessGame.test.ts
src/renderer/features/clock/clock.ts   pure Clock
src/renderer/features/clock/presets.ts
src/renderer/features/clock/clock.test.ts
src/renderer/engine/evaluate.ts  search.ts  levels.ts  engine.test.ts
src/renderer/engine/worker.ts  engineClient.ts
src/renderer/features/game/players.ts        PlayerController + Human/Engine players
src/renderer/features/game/gameStore.ts
src/renderer/features/game/gameStore.test.ts
src/renderer/features/settings/settingsStore.ts
src/renderer/hooks/useClockDisplay.ts
src/renderer/audio/sounds.ts                 WebAudio synthesized sfx (no files)
src/renderer/components/{Board,Square,Piece,PromotionDialog,ClockPanel,MoveList,CapturedPieces,GameOverModal,NewGameMenu,SettingsPanel}.tsx + .module.css
src/renderer/styles/global.css  themes.ts
src/renderer/assets/pieces/{wK,...,bP}.svg
```

## Shared interfaces (all tasks rely on these)

```ts
// core/types.ts
export type Color = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Square = string; // 'e4'
export interface Piece { type: PieceType; color: Color }
export interface MoveInput { from: Square; to: Square; promotion?: Exclude<PieceType, 'p' | 'k'> }
export interface MoveRecord extends MoveInput { san: string; color: Color; piece: PieceType; captured?: PieceType; flags: string; fen: string }
export type GameResult =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'timeout'; winner: Color }
  | { kind: 'resign'; winner: Color }
  | { kind: 'draw'; reason: 'stalemate' | 'insufficient' | 'threefold' | 'fifty' | 'agreement' };
export type Level = 'easy' | 'medium' | 'hard';
export type PlayerKind = { type: 'human' } | { type: 'engine'; level: Level };
export interface TimeControl { name: string; minutes: number; incrementSec: number } // minutes 0 => untimed
```

```ts
// core/chessGame.ts
export class ChessGame {
  constructor(fen?: string);
  fen(): string; turn(): Color;
  board(): (Piece | null)[][];          // 8x8, rank 8 first
  pieceAt(sq: Square): Piece | null;
  legalMovesFrom(sq: Square): Square[];
  legalMoves(): MoveInput[];            // all, promotions expanded to 'q','r','b','n'
  isPromotion(from: Square, to: Square): boolean;
  move(m: MoveInput): MoveRecord | null; // null when illegal
  undo(): MoveRecord | null;
  history(): MoveRecord[];
  inCheck(): boolean; kingSquare(color: Color): Square;
  result(): GameResult | null;           // checkmate / stalemate / insufficient / threefold / fifty
}
```

```ts
// features/clock/clock.ts
export class Clock {
  constructor(initialMs: number, incrementMs: number);   // initialMs 0 => untimed
  get untimed(): boolean;
  remaining(color: Color, now: number): number;
  start(color: Color, now: number): void;                // begins running for color
  press(nextColor: Color, now: number): void;            // stops current (adds increment), starts next
  stop(now: number): void;
  flagged(now: number): Color | null;
}
```

```ts
// engine
export function evaluate(game: ChessGame): number;          // centipawns, white POV
export function findBestMove(fen: string, level: Level): MoveInput;
// engineClient.ts
export function requestEngineMove(fen: string, level: Level): Promise<MoveInput>;
```

```ts
// features/game/players.ts
export interface PlayerController { readonly kind: PlayerKind['type']; requestMove(fen: string, signal: AbortSignal): Promise<MoveInput> }
```

---

### Task 1: Scaffold Electron + Vite + React + TS + Vitest

**Files:** Create `package.json`, `electron.vite.config.ts`, `tsconfig*.json`, `vitest.config.ts`, `.gitignore`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/{index.html,main.tsx,App.tsx}`, `src/renderer/styles/global.css`.

**Interfaces:** Produces: `npm run dev|build|test|build:win|build:mac`; renderer root at `src/renderer`, alias `@` → `src/renderer`.

- [ ] **Step 1:** Write `package.json` with scripts `dev: electron-vite dev`, `build: electron-vite build`, `typecheck`, `test: vitest run`, `build:win: npm run build && electron-builder --win`, `build:mac: npm run build && electron-builder --mac`. Dependencies: `react`, `react-dom`, `zustand`, `framer-motion`, `chess.js`. DevDeps: `electron`, `electron-vite@^3`, `vite@^6`, `@vitejs/plugin-react`, `typescript`, `vitest`, `electron-builder`, `@types/react`, `@types/react-dom`, `@types/node`.
- [ ] **Step 2:** Write configs (`electron.vite.config.ts` with main/preload `externalizeDepsPlugin`, renderer `react()` plugin + `@` alias), tsconfigs (strict), `vitest.config.ts` (node env, `@` alias).
- [ ] **Step 3:** Main process opens a 1200x820 `BrowserWindow` (min 900x680, `backgroundColor:'#1b1a17'`, hidden menu bar, `contextIsolation:true`, `sandbox:true`); loads dev URL or built `index.html`. Renderer `App.tsx` renders "B-Chess".
- [ ] **Step 4:** `npm install`, `npm run build`, `npm run typecheck`. Expected: build succeeds.
- [ ] **Step 5:** Commit `chore: scaffold electron-vite react ts app`.

### Task 2: Core types + ChessGame adapter (TDD)

**Files:** Create `core/types.ts`, `core/chessGame.ts`, test `core/chessGame.test.ts`.

**Interfaces:** Produces `ChessGame` + types exactly as in "Shared interfaces".

- [ ] **Step 1: Failing tests**
```ts
import { describe, it, expect } from 'vitest';
import { ChessGame } from './chessGame';

describe('ChessGame', () => {
  it('lists legal targets for e2 pawn', () => {
    expect(new ChessGame().legalMovesFrom('e2').sort()).toEqual(['e3', 'e4']);
  });
  it('rejects illegal moves', () => {
    expect(new ChessGame().move({ from: 'e2', to: 'e5' })).toBeNull();
  });
  it('detects fool\'s mate', () => {
    const g = new ChessGame();
    for (const [f, t] of [['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']]) g.move({ from: f, to: t });
    expect(g.result()).toEqual({ kind: 'checkmate', winner: 'b' });
  });
  it('detects stalemate', () => {
    expect(new ChessGame('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').result()).toEqual({ kind: 'draw', reason: 'stalemate' });
  });
  it('flags promotion moves and expands promotion choices', () => {
    const g = new ChessGame('8/P7/8/8/8/8/k6K/8 w - - 0 1');
    expect(g.isPromotion('a7', 'a8')).toBe(true);
    expect(g.legalMoves().filter(m => m.from === 'a7').map(m => m.promotion).sort()).toEqual(['b','n','q','r']);
  });
  it('undo restores position', () => {
    const g = new ChessGame(); const start = g.fen();
    g.move({ from: 'e2', to: 'e4' }); g.undo();
    expect(g.fen()).toBe(start);
  });
  it('reports king square and check', () => {
    const g = new ChessGame('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
    expect(g.inCheck()).toBe(true); expect(g.kingSquare('w')).toBe('e1');
  });
});
```
- [ ] **Step 2:** `npx vitest run src/renderer/core` → FAIL (module missing).
- [ ] **Step 3:** Implement `ChessGame` wrapping `chess.js` (`new Chess(fen)`); map `verbose` moves to `MoveRecord`; `result()` maps `isCheckmate` (winner = opposite of side to move), `isStalemate`, `isInsufficientMaterial`, `isThreefoldRepetition`, `isDraw` (→ `fifty` if none of the others).
- [ ] **Step 4:** Run tests → PASS.
- [ ] **Step 5:** Commit `feat(core): chess game adapter`.

### Task 3: Clock + presets (TDD)

**Files:** Create `features/clock/clock.ts`, `features/clock/presets.ts`, test `clock.test.ts`.

**Interfaces:** `Clock` as in shared interfaces; `presets.ts` exports `TIME_PRESETS: TimeControl[]` = Untimed(0+0), Bullet 1+0, Blitz 3+2, Blitz 5+0, Rapid 10+0, Rapid 15+10, and `toClock(tc: TimeControl): Clock`.

- [ ] **Step 1: Failing tests**
```ts
import { describe, it, expect } from 'vitest';
import { Clock } from './clock';

describe('Clock', () => {
  it('counts down only the active side', () => {
    const c = new Clock(60_000, 0); c.start('w', 0);
    expect(c.remaining('w', 10_000)).toBe(50_000);
    expect(c.remaining('b', 10_000)).toBe(60_000);
  });
  it('applies increment on press and switches side', () => {
    const c = new Clock(60_000, 2_000); c.start('w', 0);
    c.press('b', 5_000);
    expect(c.remaining('w', 5_000)).toBe(57_000);
    expect(c.remaining('b', 9_000)).toBe(56_000);
  });
  it('reports flagged side when time hits zero', () => {
    const c = new Clock(1_000, 0); c.start('w', 0);
    expect(c.flagged(999)).toBeNull(); expect(c.flagged(1_000)).toBe('w');
  });
  it('untimed clock never flags', () => {
    const c = new Clock(0, 0); c.start('w', 0);
    expect(c.untimed).toBe(true); expect(c.flagged(1e9)).toBeNull();
  });
  it('stop freezes time', () => {
    const c = new Clock(60_000, 0); c.start('w', 0); c.stop(4_000);
    expect(c.remaining('w', 99_000)).toBe(56_000);
  });
});
```
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement with timestamp bookkeeping (`base` remaining per side, `activeSince`, `active`), remaining clamped ≥ 0. **Step 4:** PASS. **Step 5:** Commit `feat(clock): drift-free clock and presets`.

### Task 4: Engine — evaluate, search, levels, worker (TDD)

**Files:** Create `engine/evaluate.ts`, `search.ts`, `levels.ts`, `worker.ts`, `engineClient.ts`, test `engine.test.ts`.

**Interfaces:** Consumes `ChessGame`. Produces `findBestMove(fen, level)`, `requestEngineMove(fen, level)`; `levels.ts` exports `LEVELS: Record<Level, { depth: number; timeMs: number; randomTopN: number; randomChance: number; noise: number }>` = easy `{1, 300, 4, 0.3, 40}`, medium `{3, 1500, 1, 0, 10}`, hard `{4, 2500, 1, 0, 0}`.

- [ ] **Step 1: Failing tests**
```ts
import { describe, it, expect } from 'vitest';
import { findBestMove } from './search';
import { ChessGame } from '@/core/chessGame';

const legal = (fen: string, m: { from: string; to: string }) =>
  new ChessGame(fen).legalMovesFrom(m.from).includes(m.to);

describe('engine', () => {
  it('finds mate in one at every level (back rank)', () => {
    const fen = '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1';
    for (const lvl of ['medium', 'hard'] as const) {
      const m = findBestMove(fen, lvl);
      expect(`${m.from}${m.to}`).toBe('a1a8');
    }
  });
  it('always returns a legal move', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    for (const lvl of ['easy', 'medium', 'hard'] as const) expect(legal(fen, findBestMove(fen, lvl))).toBe(true);
  });
  it('hard does not hang its queen', () => {
    // Black pawn attacks queen square d5; queen on d1 must not go to a square where it is captured for free
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1';
    const m = findBestMove(fen, 'hard');
    expect(`${m.from}${m.to}`).not.toBe('d1d3');
  });
  it('captures a free queen', () => {
    const fen = '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1';
    const m = findBestMove(fen, 'hard'); expect(`${m.from}${m.to}`).toBe('d1d5');
  });
});
```
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** `evaluate.ts`: material (100/320/330/500/900) + piece-square tables (standard simplified PST, mirrored for black) + small mobility term; returns white-POV score. `search.ts`: negamax alpha-beta with iterative deepening up to `LEVELS[level].depth`, wall-clock cutoff (`timeMs`), MVV-LVA + promotion ordering, quiescence on captures (hard/medium only, depth-limited to 4), mate score `±100000 - ply`; root collects scored moves; for easy: with probability `randomChance` pick random among top `randomChance`-N; add uniform noise `±noise` to root scores. `worker.ts`: `onmessage({id,fen,level})` → `postMessage({id,move})`. `engineClient.ts`: lazily creates `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`, maps ids → promises, on `error` recreates worker and rejects so caller falls back.
- [ ] **Step 4:** Run tests → PASS (hard tests may take a few seconds).
- [ ] **Step 5:** Commit `feat(engine): alpha-beta engine with 3 levels in web worker`.

### Task 5: Game store + players (TDD)

**Files:** Create `features/game/players.ts`, `features/game/gameStore.ts`, test `gameStore.test.ts`, `features/settings/settingsStore.ts`.

**Interfaces:** Consumes `ChessGame`, `Clock`, `PlayerController`. Produces `useGameStore` with state and actions:
```ts
interface GameConfig { white: PlayerKind; black: PlayerKind; timeControl: TimeControl }
interface GameState {
  status: 'menu' | 'playing' | 'over';
  game: ChessGame; clock: Clock; config: GameConfig;
  history: MoveRecord[]; fen: string;         // fen changes on every move => re-render key
  selected: Square | null; targets: Square[];
  pendingPromotion: { from: Square; to: Square } | null;
  result: GameResult | null;
  lastMove: MoveInput | null;
  flipped: boolean;
  startGame(config: GameConfig): void;
  select(sq: Square): void;            // human click logic (select / move / deselect / open promotion)
  choosePromotion(p: MoveInput['promotion']): void; cancelPromotion(): void;
  playMove(m: MoveInput): boolean;     // applies move, switches clock, checks result, triggers next turn
  undo(): void;                        // vs engine: undoes both plies; 1v2: one ply
  resign(color: Color): void; agreeDraw(): void;
  tickClock(now: number): void;        // called by UI interval; ends game on flag
  toggleFlip(): void; backToMenu(): void;
}
```
`settingsStore`: `{ showLegalMoves: boolean (true), soundOn: true, autoFlip: false, boardTheme: 'classic'|'green'|'blue'|'dark' ('classic') }` persisted to localStorage (guarded try/catch), setters `set(partial)`.
`players.ts`: `HumanPlayer` (its `requestMove` never resolves until aborted — moves come via `select`), `EnginePlayer(level)` calls `requestEngineMove`, wraps failure with random legal move fallback and enforces min think time 500 ms so moves feel natural; `createPlayer(kind)`.

- [ ] **Step 1: Failing tests** (inject `now` via `tickClock`; engine mocked with `vi.mock('@/engine/engineClient')` returning a fixed legal move):
```ts
it('alternates turns and records history', ...);        // startGame human/human, select e2 then e4 → history length 1, turn 'b'
it('select ignores opponent pieces and illegal targets', ...);
it('opens promotion dialog then completes move', ...);  // FEN-based startGame requires optional config.fen for tests
it('ends game on checkmate with result', ...);          // fool's mate via select()
it('flag ends game on timeout', ...);                   // 1 min clock, tickClock(61_000) → result timeout
it('undo vs engine removes two plies', ...);
it('engine replies after human move', async () => {});  // mocked client, await vi.waitFor(() => history.length === 2)
```
Write all tests in full (add optional `fen?: string` to `GameConfig` for test setups).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Turn loop: after each `playMove`, if game not over and side-to-move is engine, create `AbortController`, call `player.requestMove`, then `playMove` (guard against stale game via a `gameId` counter). `startGame` aborts previous controller. Clock starts on white's first move? → clock starts for white immediately at `startGame` (standard). **Step 4:** PASS. **Step 5:** Commit `feat(game): store, players, settings`.

### Task 6: Assets — pieces + synthesized sounds

**Files:** Create `assets/pieces/*.svg` (12), `audio/sounds.ts`, `ASSETS.md`.

- [ ] **Step 1:** Download the 12 `cburnett` SVGs from `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett/{wK,wQ,wR,wB,wN,wP,bK,bQ,bR,bB,bN,bP}.svg` via `curl -L` into `src/renderer/assets/pieces/`. Verify each is valid SVG (`head -c 100`).
- [ ] **Step 2:** `sounds.ts`: `playSound(kind: 'move'|'capture'|'check'|'end')` using a lazily created `AudioContext`; short oscillator+gain-envelope tones (move: 220 Hz thump 60 ms; capture: noise-burst + 160 Hz 90 ms; check: two-note 660/880; end: descending 3-note). Silent no-op if `AudioContext` unavailable. Respects `settingsStore.soundOn`.
- [ ] **Step 3:** `ASSETS.md` credits cburnett (Colin M.L. Burnett, GPL-2.0+/CC-BY-SA 3.0) via Lichess.
- [ ] **Step 4:** Commit `feat(assets): open-license pieces and synthesized sfx`.

### Task 7: Board UI (Board, Square, Piece, PromotionDialog)

**Files:** Create `components/Board.tsx`, `Square.tsx`, `Piece.tsx`, `PromotionDialog.tsx` (+ `.module.css`), `styles/themes.ts`.

**Interfaces:** Consumes `useGameStore`, `useSettingsStore`, `playSound`. `themes.ts` exports `BOARD_THEMES: Record<BoardTheme, { light: string; dark: string; label: string }>` applied as CSS variables on the board.

- [ ] **Step 1:** `Board` renders an 8x8 grid (responsive: `min(100%, 80vh)` square via `aspect-ratio:1`), orientation from `flipped`; coordinate labels (files/ranks) inside edge squares. Squares are absolutely-sizeable `12.5%` cells; click → `select(sq)`.
- [ ] **Step 2:** Pieces are rendered in a **separate absolutely-positioned layer** keyed by stable piece identity so Framer Motion animates position changes. Track identity by deriving from history: maintain `Map<Square, id>` updated per `MoveRecord` (handle capture removal, castling rook, en passant, promotion → new id). Each `Piece` is `motion.img` with `animate={{ left, top }}` (percent) and `transition={{ type:'spring', stiffness:420, damping:34 }}`; captured pieces exit with `AnimatePresence` scale→0/opacity→0. Selected piece lifts (`scale:1.08`, drop shadow).
- [ ] **Step 3:** `Square` overlays: last-move tint, selected tint, **legal target: 4px blue inset border** (`#2f7cf6`, small glow; capture targets get thicker ring), check: radial red glow under king. Hints only when `settings.showLegalMoves`.
- [ ] **Step 4:** `PromotionDialog` shows 4 piece buttons (Q R B N) over the board with backdrop; click `choosePromotion`; Esc/backdrop `cancelPromotion`.
- [ ] **Step 5:** `npm run typecheck`. Commit `feat(ui): animated board with legal-move hints`.

### Task 8: Panels — clock, moves, captured, menus, modals

**Files:** Create `hooks/useClockDisplay.ts`, `components/ClockPanel.tsx`, `MoveList.tsx`, `CapturedPieces.tsx`, `GameOverModal.tsx`, `NewGameMenu.tsx`, `SettingsPanel.tsx` (+ css), `utils/format.ts` (`formatTime(ms)` → `m:ss` / `0:07.3` under 10s).

- [ ] **Step 1:** `useClockDisplay(color)`: `requestAnimationFrame`-throttled (100 ms) hook returning remaining ms; also calls `tickClock(now)` once per tick from a single `App`-level interval (not per component).
- [ ] **Step 2:** `ClockPanel` (player name/level label, big time, active-side highlight, low-time red pulse under 10 s); `CapturedPieces` (material diff derived from `history`); `MoveList` (SAN pairs, auto-scroll to bottom).
- [ ] **Step 3:** `NewGameMenu`: mode cards (Local 1v2 / vs Computer), level selector (Easy/Medium/Hard), colour choice (White/Black/Random) for vs computer, time preset chips + custom (minutes 1–180, increment 0–60), Start button. `SettingsPanel`: toggles for legal moves, sound, auto-flip, board theme swatches. `GameOverModal`: result text, New Game / Rematch / Close.
- [ ] **Step 4:** Sidebar buttons: Undo, Flip, Resign, Draw, Settings, Menu.
- [ ] **Step 5:** `npm run typecheck`. Commit `feat(ui): clocks, move list, menus, modals`.

### Task 9: App shell + visual polish

**Files:** Modify `App.tsx`, `main.tsx`, `styles/global.css`.

- [ ] **Step 1:** Layout: left = board, right = sidebar (top clock, move list, bottom clock, buttons); `status==='menu'` shows `NewGameMenu` centered with app logo "B-Chess". Dark elegant palette (CSS variables), Inter/system font stack, smooth transitions, subtle noise/gradient background, focus-visible outlines.
- [ ] **Step 2:** Wire single interval `tickClock`, sound triggers on new history entry (`check` if SAN ends `+`/`#`, `capture` if captured, else `move`; `end` when game over), `autoFlip` handling.
- [ ] **Step 3:** `npm run dev`; launch Electron, play through manually with `run`/browser screenshots; fix issues.
- [ ] **Step 4:** Commit `feat(app): shell, layout, polish`.

### Task 10: Packaging, CI, docs

**Files:** Create `electron-builder.yml`, `.github/workflows/release.yml`, `README.md`.

- [ ] **Step 1:** `electron-builder.yml`: `appId: com.bchess.app`, `productName: B-Chess`, win target `nsis`, mac target `dmg` (`category: public.app-category.board-games`), `files: ['out/**']`, `directories.output: dist`; mac `identity: null` (unsigned).
- [ ] **Step 2:** GH Actions matrix (`windows-latest`, `macos-latest`), `npm ci && npm test && npm run build:win|mac`, upload artifacts.
- [ ] **Step 3:** README: install/run/build, features, structure, first-run warnings for unsigned builds, phase 2 note.
- [ ] **Step 4:** `npm run build:win` locally (unpacked `--dir` acceptable if installer step slow). Commit `chore: packaging, CI, docs`.

### Task 11: Final verification

- [ ] `npm test` all pass; `npm run typecheck` clean; `npm run build` OK; launch app, play: select/hint/move/animation, promotion, castling, clocks, flag, engine levels; confirm no console errors. Fix defects, commit.

---

## Self-Review

- Spec coverage: click-click + blue hints (T7), animations (T7), 1v2 + vs PC 3 levels (T4,T5,T8), clocks/blitz/custom (T3,T8), themes/sfx (T6,T7,T8), packaging Win/Mac (T10), phase 2 seam via `PlayerController` (T5), tests (T2-T5). No gaps.
- Type consistency: `MoveInput`, `MoveRecord`, `PlayerKind`, `Level`, `TimeControl` defined once in "Shared interfaces" and reused.
