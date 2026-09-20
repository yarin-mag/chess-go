# B-Chess — Phase 1 Design

Cross-platform (Windows/macOS) desktop chess game. Electron + TypeScript. All tooling free/open source.

## Scope

**Phase 1 (this spec):** local 1v2 on one PC, play vs computer (Easy/Medium/Hard), configurable clocks (incl. blitz), click-to-move with legal-move hints, smooth animations.

**Phase 2 (out of scope, but architecture must not block it):** online multiplayer.

## Stack

| Concern | Choice |
| --- | --- |
| Shell / build | Electron 44, `electron-vite` 3, Vite 6 |
| UI | React 19, plain CSS modules + CSS variables (themes) |
| Animation | Framer Motion (`layout` / `animate`) |
| State | Zustand |
| Rules | `chess.js` |
| AI | Own alpha-beta engine in a Web Worker |
| Tests | Vitest |
| Packaging | `electron-builder` (NSIS `.exe`, `.dmg`), GitHub Actions matrix |

## Architecture

```
src/
  main/        Electron main process: window creation only
  preload/     minimal contextBridge (none needed yet; kept for phase 2)
  renderer/
    core/      Pure TS, no React. Types, chess adapter, move helpers.
    engine/    AI: evaluate.ts, search.ts, levels.ts, worker.ts, engineClient.ts
    features/
      game/    gameStore (Zustand), GameController interface + implementations
      clock/   clock logic (pure) + presets
      settings/ settingsStore (persisted to localStorage)
    components/ Board, Square, Piece, Clock, MoveList, CapturedPieces,
                PromotionDialog, GameOverModal, NewGameMenu, SettingsPanel
    styles/    global.css, themes.ts
    assets/    pieces (SVG), sounds
```

Dependency rule: `components → features → core`. `core` and `clock` logic import nothing from React/Electron and are unit tested.

### Key interfaces

```ts
// core/types.ts
type Color = 'w' | 'b';
interface MoveInfo { from: Square; to: Square; san: string; promotion?: PieceType; captured?: PieceType; }

// features/game/controller.ts  — the phase 2 seam
interface PlayerController {
  /** Resolves with the move this player wants to play for the given position. */
  requestMove(fen: string, signal: AbortSignal): Promise<MoveInput>;
}
```

- `HumanPlayer`: move comes from board clicks (store resolves the pending promise).
- `EnginePlayer`: delegates to `engineClient` (worker) at chosen level.
- Phase 2 adds `RemotePlayer` (network transport). Game store loop is unchanged.

### Game flow
`gameStore` owns: chess.js instance, move history, status, clocks, players `{w, b}`. On each turn the store asks the side-to-move's `PlayerController` for a move; humans resolve via UI. Turn passes → clock switches → increment applied.

### Clock
Pure `Clock` class: `{ remainingMs: {w,b}, incrementMs, active }` with `tick(now)`, `switchTo(color, now)`. Uses timestamps (not counting intervals) so it is drift-free. UI re-renders via `requestAnimationFrame`/100ms interval. Time reaching 0 → `flag` loss. Presets: Bullet 1+0, Blitz 3+2, Blitz 5+0, Rapid 10+0, Rapid 15+10, Untimed, Custom (minutes 1–180, increment 0–60 s).

### AI levels
- **Easy:** depth 1, 30% chance to play a random legal move among top 4.
- **Medium:** depth 3, small eval noise.
- **Hard:** depth 4 with quiescence search, move ordering (MVV-LVA), iterative deepening with time cap (~2s).
Evaluation: material + piece-square tables + mobility bonus. Runs in a Web Worker so UI never blocks. Engine exposes `bestMove(fen, level): Promise<MoveInput>`.

### UI behaviour
- Click piece → selected; legal destination squares get a **blue border** (toggle "Show legal moves", default ON). Click destination → move. Click other own piece → reselect. Click empty/illegal → deselect.
- Drag-and-drop is not required; click-click only in phase 1.
- Piece motion animated (spring slide); captured piece fades/scales out; castling animates both pieces.
- Last-move highlight, king-in-check red glow, promotion dialog, game-over modal (checkmate, stalemate, draw types, timeout, resignation).
- 1v2 mode: optional "auto-flip board each move" setting (default off).
- Sound effects (move, capture, check, end); toggle in settings.
- Themes: 4 boards (Classic wood, Green, Blue, Dark). Piece set: open-license SVGs (Lichess `cburnett`, GPL-2+/CC-BY-SA; attribution in `ASSETS.md` and About).

### Error handling
- Illegal move attempt: ignored silently (deselect). Engine failure/timeouts: fall back to a random legal move and log. Worker crash: recreate worker.

### Testing
Vitest unit tests: clock (tick, increment, flag), engine (finds mate-in-1, avoids hanging queen at Medium+, returns legal moves at all levels), game store (turn order, undo, game over states). Manual smoke via `npm run dev`.

### Packaging / Install
`npm install`, `npm run dev` (dev), `npm run build:win` / `npm run build:mac` (installers in `dist/`). `.github/workflows/release.yml` builds both on tag push. Unsigned builds (no cost); README documents first-run warnings.

## Non-goals (phase 1)
Online play, accounts, PGN import/export, opening books, analysis, drag-and-drop.
