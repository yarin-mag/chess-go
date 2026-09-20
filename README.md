# B-Chess

A smooth, cross-platform (Windows / macOS) desktop chess game built with Electron, React and TypeScript.

## Features (phase 1)

- Click a piece, then click where it goes. Pieces glide with spring animations.
- **Legal-move hints:** after selecting a piece, its legal squares get blue borders (toggle in Settings, on by default).
- Play **vs the computer** (Easy / Medium / Hard) or **2 players on the same PC**.
- **Clocks:** Untimed, Bullet, Blitz, Rapid presets, or a custom time + increment.
- Move list, captured pieces, undo, flip board, resign, draw (local play), promotion picker.
- 4 board themes and synthesized sound effects.

Online multiplayer is planned for phase 2 (see [Architecture](#architecture)).

## Getting started

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev        # run the app with hot reload
npm test           # unit tests
npm run typecheck
```

### Build installers

```bash
npm run build:win  # Windows installer (.exe) in dist/
npm run build:mac  # macOS disk image (.dmg) in dist/ (run on a Mac)
```

The GitHub Actions workflow (`.github/workflows/release.yml`) builds both on every `v*` tag.

Builds are **unsigned** (signing needs paid certificates). On first launch:
- **Windows:** SmartScreen shows "Windows protected your PC" → *More info* → *Run anyway*.
- **macOS:** right-click the app → *Open* → *Open*.

## Architecture

```
src/
  main/           Electron main process (creates the window)
  preload/        Bridge to the renderer (empty until phase 2)
  renderer/
    core/         Pure TS: types, chess.js adapter, piece tracking (no UI)
    engine/       AI: evaluation + alpha-beta search, runs in a Web Worker
    features/
      clock/      Drift-free clock and time presets
      game/       Zustand game store + PlayerController implementations
      settings/   Persisted preferences
    components/   React UI (Board, Piece, Square, panels, dialogs, ui/ primitives)
    hooks/        Clock display, sounds and other game effects
    audio/        Synthesized sound effects
    styles/       Global CSS and board themes
```

Rules: `components → features → core`. `core`, `clock` and `engine` never import React or Electron, so they are unit-tested in plain Node.

**Phase 2 seam:** every side is played through a `PlayerController` (`features/game/players.ts`). Humans move via the board, the computer via the engine worker. An online opponent is a new `PlayerController` that reads and writes moves over the network; the game loop does not change.

## Credits

See [ASSETS.md](ASSETS.md). Chess pieces: "cburnett" set (GPL-2.0+ / CC BY-SA 3.0) via Lichess.
