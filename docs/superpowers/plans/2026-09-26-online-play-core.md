# Online Play — Sub-project A (Core Play) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play a live game against a specific friend over the internet, on either the Electron app or the PWA, using a shared room code. Reconnection/persistence is a separate later sub-project.

**Architecture:** `peerjs` (real dependency, already installed and API-verified) wrapped behind a small `OnlineConnection` interface. A new `RemotePlayer` implements the existing `PlayerController` interface (the exact seam left open in phase 1) so the entire turn-taking/move-application path in `gameStore` needs no new logic — only a way to inject a pre-built controller for the network seat. A thin `useOnlineSync` hook (same shape as the existing sound-effect hooks) relays local moves out and applies incoming ones.

**Tech Stack:** React, TypeScript, Zustand, `peerjs` v1.5.5, chess.js. Everything else already in the app.

**Spec:** `docs/superpowers/specs/2026-09-26-online-play-core-design.md`

## Global Constraints

- No accounts, no servers to deploy — PeerJS's default free public broker (`0.peerjs.com:443`), unconfigured.
- `PlayerController.kind` already includes `'remote'` in its type union (written in phase 1) — do not change that type.
- Your own moves must keep flowing through the existing `select()` → `playMove()` path unchanged; only the opponent's move-arrival path is new.
- `peerConnection.ts` (the real PeerJS I/O boundary) is not unit tested beyond typechecking, matching how `engineClient.ts`/`worker.ts` were handled in phase 1 — verified instead by a real two-client run in the final task.
- `useOnlineSync` has no dedicated unit test, matching `useGameEffects`/`usePuzzleEffects` — verified live.
- CSP change goes in the one shared `src/renderer/index.html` (both builds read it).

## Shared interfaces (all tasks rely on these)

```ts
// core/types.ts (extended)
export type PlayerKind = { type: 'human' } | { type: 'engine'; level: Level } | { type: 'remote' };
export type GameResult =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'timeout'; winner: Color }
  | { kind: 'resign'; winner: Color }
  | { kind: 'draw'; reason: DrawReason }
  | { kind: 'disconnected'; winner: Color };
```

```ts
// features/online/protocol.ts
export type NetworkMessage =
  | { type: 'init'; joinerColor: Color; timeControl: TimeControl }
  | { type: 'move'; move: MoveInput; at: number }
  | { type: 'resign' }
  | { type: 'drawOffer' }
  | { type: 'drawResponse'; accepted: boolean };

export function randomRoomCode(): string; // 6 chars, A-Z and 0-9
```

```ts
// features/online/peerConnection.ts
export interface OnlineConnection {
  send(msg: NetworkMessage): void;
  onMessage(cb: (msg: NetworkMessage) => void): () => void;
  onClose(cb: () => void): () => void;
  close(): void;
}
export function hostRoom(): Promise<{ roomCode: string; connected: Promise<OnlineConnection> }>;
export function joinRoom(roomCode: string): Promise<OnlineConnection>;
```

```ts
// features/game/players.ts (extended)
export class RemotePlayer implements PlayerController {
  readonly kind: 'remote';
  constructor(connection: OnlineConnection);
  requestMove(fen: string, signal: AbortSignal): Promise<MoveInput>;
}
```

```ts
// features/game/gameStore.ts (GameConfig extended)
export interface GameConfig {
  white: PlayerKind;
  black: PlayerKind;
  timeControl: TimeControl;
  fen?: string;
  /** Present only for online games: this seat's actual controller is `player`, not derived from white/black. */
  remote?: { color: Color; player: PlayerController };
}
```

```ts
// features/online/onlineStore.ts
type OnlineStatus = 'idle' | 'hosting' | 'joining' | 'connected' | 'error';
interface OnlineState {
  status: OnlineStatus;
  roomCode: string | null;
  localColor: Color | null;
  connection: OnlineConnection | null;
  incomingDrawOffer: boolean;
  error: string | null;
  hostGame(timeControl: TimeControl): Promise<void>;
  joinGame(roomCode: string): Promise<void>;
  clearDrawOffer(): void;
  leave(): void;
}
export const useOnlineStore: UseBoundStore<StoreApi<OnlineState>>;
```

---

### Task 1: Types, protocol, room code

**Files:**
- Modify: `src/renderer/core/types.ts`
- Create: `src/renderer/features/online/protocol.ts`
- Test: `src/renderer/features/online/protocol.test.ts`

**Interfaces:** Produces `NetworkMessage`, `randomRoomCode`, and the `PlayerKind`/`GameResult` extensions exactly as in Shared Interfaces.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, expect, it } from 'vitest';
import { randomRoomCode } from './protocol';

describe('randomRoomCode', () => {
  it('is 6 characters of A-Z and 0-9', () => {
    for (let i = 0; i < 50; i++) expect(randomRoomCode()).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('is not the same every time', () => {
    const codes = new Set(Array.from({ length: 20 }, () => randomRoomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
```
- [ ] **Step 2:** Run `npx vitest run src/renderer/features/online/protocol.test.ts` → FAIL.
- [ ] **Step 3: Implement.**

In `core/types.ts`, change:
```ts
export type PlayerKind = { type: 'human' } | { type: 'engine'; level: Level };
```
to:
```ts
export type PlayerKind = { type: 'human' } | { type: 'engine'; level: Level } | { type: 'remote' };
```
and change:
```ts
export type GameResult =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'timeout'; winner: Color }
  | { kind: 'resign'; winner: Color }
  | { kind: 'draw'; reason: DrawReason };
```
to:
```ts
export type GameResult =
  | { kind: 'checkmate'; winner: Color }
  | { kind: 'timeout'; winner: Color }
  | { kind: 'resign'; winner: Color }
  | { kind: 'draw'; reason: DrawReason }
  | { kind: 'disconnected'; winner: Color };
```

New `features/online/protocol.ts`:
```ts
import type { Color, MoveInput, TimeControl } from '@/core/types';

export type NetworkMessage =
  | { type: 'init'; joinerColor: Color; timeControl: TimeControl }
  | { type: 'move'; move: MoveInput; at: number }
  | { type: 'resign' }
  | { type: 'drawOffer' }
  | { type: 'drawResponse'; accepted: boolean };

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** A short, human-shareable room code (6 chars). Not cryptographically significant — just an invite code. */
export function randomRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}
```
- [ ] **Step 4:** Run tests → PASS. `npm run typecheck` (this will surface every place a `switch`/exhaustive check over `PlayerKind` or `GameResult` needs a new case — there should be none yet, since nothing constructs `{type:'remote'}` or `{kind:'disconnected'}` until later tasks, but fix any that appear).
- [ ] **Step 5:** Commit:
```bash
git add src/renderer/core/types.ts src/renderer/features/online/protocol.ts src/renderer/features/online/protocol.test.ts
git commit -m "feat(online): protocol types and room code generator"
```

### Task 2: RemotePlayer

**Files:**
- Modify: `src/renderer/features/game/players.ts`
- Test: `src/renderer/features/game/players.test.ts` (new file — `HumanPlayer`/`EnginePlayer` were never unit tested directly; this only tests the new class)

**Interfaces:** Consumes `OnlineConnection` (Task 1's sibling `peerConnection.ts` interface — defined here structurally, since Task 3 creates the real file; this task only needs the shape). Produces `RemotePlayer` exactly as in Shared Interfaces.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, expect, it, vi } from 'vitest';
import { RemotePlayer } from './players';
import type { NetworkMessage } from '@/features/online/protocol';

function fakeConnection() {
  const handlers: ((msg: NetworkMessage) => void)[] = [];
  return {
    send: vi.fn(),
    onMessage: (cb: (msg: NetworkMessage) => void) => {
      handlers.push(cb);
      return () => {
        const i = handlers.indexOf(cb);
        if (i >= 0) handlers.splice(i, 1);
      };
    },
    onClose: () => () => {},
    close: () => {},
    emit: (msg: NetworkMessage) => handlers.forEach((h) => h(msg)),
  };
}

describe('RemotePlayer', () => {
  it('resolves requestMove when a move message arrives', async () => {
    const conn = fakeConnection();
    const player = new RemotePlayer(conn);
    const promise = player.requestMove('fen', new AbortController().signal);
    conn.emit({ type: 'move', move: { from: 'e2', to: 'e4' }, at: Date.now() });
    await expect(promise).resolves.toEqual({ from: 'e2', to: 'e4' });
  });

  it('ignores non-move messages while waiting', async () => {
    const conn = fakeConnection();
    const player = new RemotePlayer(conn);
    const promise = player.requestMove('fen', new AbortController().signal);
    conn.emit({ type: 'resign' });
    conn.emit({ type: 'move', move: { from: 'a2', to: 'a4' }, at: Date.now() });
    await expect(promise).resolves.toEqual({ from: 'a2', to: 'a4' });
  });

  it('rejects when the signal aborts', async () => {
    const conn = fakeConnection();
    const player = new RemotePlayer(conn);
    const controller = new AbortController();
    const promise = player.requestMove('fen', controller.signal);
    controller.abort();
    await expect(promise).rejects.toThrow();
  });

  it('reports kind "remote"', () => {
    expect(new RemotePlayer(fakeConnection()).kind).toBe('remote');
  });
});
```
- [ ] **Step 2:** Run `npx vitest run src/renderer/features/game/players.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Add to `players.ts` (keep `HumanPlayer`/`EnginePlayer`/`createPlayer` as they are):
```ts
import type { OnlineConnection } from '@/features/online/peerConnection';

export class RemotePlayer implements PlayerController {
  readonly kind = 'remote' as const;

  constructor(private readonly connection: OnlineConnection) {}

  requestMove(_fen: string, signal: AbortSignal): Promise<MoveInput> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(abortError());
      const unsubscribe = this.connection.onMessage((msg) => {
        if (msg.type !== 'move') return;
        unsubscribe();
        resolve(msg.move);
      });
      signal.addEventListener(
        'abort',
        () => {
          unsubscribe();
          reject(abortError());
        },
        { once: true },
      );
    });
  }
}
```
(`abortError` already exists in this file from `EnginePlayer`'s implementation — reuse it, don't redefine it.)

This creates a circular type-only relationship (`players.ts` imports a type from `peerConnection.ts`, and Task 3's `onlineStore.ts` will import `RemotePlayer` from `players.ts`) — both are type-only imports (`import type`), which is fine and doesn't create a runtime cycle.
- [ ] **Step 4:** This will fail to compile until `peerConnection.ts` exists (Task 3). For now, run only `npx vitest run src/renderer/features/game/players.test.ts` — Vitest transpiles per-file and doesn't require the full project to typecheck, so the test itself passes even though `npm run typecheck` will fail until Task 3 lands. Confirm the test run passes; defer a clean `npm run typecheck` to the end of Task 3.
- [ ] **Step 5:** Commit:
```bash
git add src/renderer/features/game/players.ts src/renderer/features/game/players.test.ts
git commit -m "feat(online): RemotePlayer implements the existing PlayerController seam"
```

### Task 3: peerConnection wrapper + onlineStore

**Files:**
- Create: `src/renderer/features/online/peerConnection.ts`
- Create: `src/renderer/features/online/onlineStore.ts`
- Test: `src/renderer/features/online/onlineStore.test.ts`

**Interfaces:** Consumes `RemotePlayer` (Task 2), `NetworkMessage`/`randomRoomCode` (Task 1). Produces `OnlineConnection`, `hostRoom`, `joinRoom`, `useOnlineStore` exactly as in Shared Interfaces.

- [ ] **Step 1: Implement `peerConnection.ts` first** (no dedicated unit test — real PeerJS I/O boundary, per Global Constraints; verified in Task 8):
```ts
import Peer, { type DataConnection } from 'peerjs';
import { randomRoomCode } from './protocol';
import type { NetworkMessage } from './protocol';

export interface OnlineConnection {
  send(msg: NetworkMessage): void;
  onMessage(cb: (msg: NetworkMessage) => void): () => void;
  onClose(cb: () => void): () => void;
  close(): void;
}

const JOIN_TIMEOUT_MS = 10_000;

function wrap(dc: DataConnection): OnlineConnection {
  return {
    send: (msg) => dc.send(msg),
    onMessage: (cb) => {
      const handler = (data: unknown) => cb(data as NetworkMessage);
      dc.on('data', handler);
      return () => dc.off('data', handler);
    },
    onClose: (cb) => {
      dc.on('close', cb);
      return () => dc.off('close', cb);
    },
    close: () => dc.close(),
  };
}

/** Creates a room others can join by code. Resolves with the code immediately, and separately once a peer connects. */
export function hostRoom(): Promise<{ roomCode: string; connected: Promise<OnlineConnection> }> {
  return new Promise((resolveCode, rejectCode) => {
    const attempt = (): void => {
      const code = randomRoomCode();
      const peer = new Peer(code);

      peer.on('open', () => {
        const connected = new Promise<OnlineConnection>((resolveConn, rejectConn) => {
          peer.on('connection', (dc) => {
            dc.on('open', () => resolveConn(wrap(dc)));
            dc.on('error', (e) => rejectConn(e));
          });
          peer.on('error', (e) => rejectConn(e));
        });
        resolveCode({ roomCode: code, connected });
      });

      peer.on('error', (e) => {
        if (e.type === 'unavailable-id') {
          peer.destroy();
          attempt(); // extremely unlikely for a 36^6-space code, but retry rather than fail
        } else {
          rejectCode(e);
        }
      });
    };
    attempt();
  });
}

/** Joins a room by its code. */
export function joinRoom(roomCode: string): Promise<OnlineConnection> {
  return new Promise((resolve, reject) => {
    const peer = new Peer();
    const timeout = setTimeout(() => {
      peer.destroy();
      reject(new Error('Could not reach that room — check the code and try again.'));
    }, JOIN_TIMEOUT_MS);

    peer.on('open', () => {
      const dc = peer.connect(roomCode.toUpperCase());
      dc.on('open', () => {
        clearTimeout(timeout);
        resolve(wrap(dc));
      });
      dc.on('error', (e) => {
        clearTimeout(timeout);
        reject(e);
      });
    });
    peer.on('error', (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
}
```
- [ ] **Step 2: Write the failing test for `onlineStore`**
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NetworkMessage } from './protocol';

function fakeConnection() {
  const handlers: ((msg: NetworkMessage) => void)[] = [];
  const closeHandlers: (() => void)[] = [];
  return {
    sent: [] as NetworkMessage[],
    send(msg: NetworkMessage) {
      this.sent.push(msg);
    },
    onMessage(cb: (msg: NetworkMessage) => void) {
      handlers.push(cb);
      return () => {};
    },
    onClose(cb: () => void) {
      closeHandlers.push(cb);
      return () => {};
    },
    close: vi.fn(),
    emit(msg: NetworkMessage) {
      handlers.forEach((h) => h(msg));
    },
    triggerClose() {
      closeHandlers.forEach((h) => h());
    },
  };
}

const conn = fakeConnection();

vi.mock('./peerConnection', () => ({
  hostRoom: vi.fn(async () => ({ roomCode: 'ABC123', connected: Promise.resolve(conn) })),
  joinRoom: vi.fn(async () => conn),
}));

vi.mock('@/features/game/gameStore', () => ({
  useGameStore: { getState: () => ({ startGame: vi.fn(), resign: vi.fn(), agreeDraw: vi.fn() }) },
}));

import { useOnlineStore } from './onlineStore';
import { useGameStore } from '@/features/game/gameStore';
import { UNTIMED } from '@/features/clock/presets';

describe('onlineStore', () => {
  afterEach(() => useOnlineStore.getState().leave());

  it('hostGame reaches connected with a room code and a local color', async () => {
    await useOnlineStore.getState().hostGame(UNTIMED);
    const s = useOnlineStore.getState();
    expect(s.status).toBe('connected');
    expect(s.roomCode).toBe('ABC123');
    expect(s.localColor).not.toBeNull();
    expect(s.connection).not.toBeNull();
  });

  it('hostGame sends an init message with the joiner\'s color and time control', async () => {
    await useOnlineStore.getState().hostGame(UNTIMED);
    const init = conn.sent.find((m) => m.type === 'init');
    expect(init).toBeDefined();
    expect((init as { joinerColor: string }).joinerColor).not.toBe(useOnlineStore.getState().localColor);
  });

  it('joinGame waits for init before becoming connected', async () => {
    const promise = useOnlineStore.getState().joinGame('ABC123');
    conn.emit({ type: 'init', joinerColor: 'b', timeControl: UNTIMED });
    await promise;
    const s = useOnlineStore.getState();
    expect(s.status).toBe('connected');
    expect(s.localColor).toBe('b');
  });

  it('marks an incoming draw offer and clears it', async () => {
    await useOnlineStore.getState().hostGame(UNTIMED);
    conn.emit({ type: 'drawOffer' });
    expect(useOnlineStore.getState().incomingDrawOffer).toBe(true);
    useOnlineStore.getState().clearDrawOffer();
    expect(useOnlineStore.getState().incomingDrawOffer).toBe(false);
  });

  it('ends the game as "disconnected" when the connection closes mid-game', async () => {
    await useOnlineStore.getState().hostGame(UNTIMED);
    const resign = vi.fn();
    conn.triggerClose();
    // The store itself doesn't call gameStore.resign for a disconnect (that's a distinct result kind,
    // applied via gameStore directly) — this test only needs to confirm the store noticed the close.
    expect(useOnlineStore.getState().status).toBe('idle');
  });

  it('leave closes the connection and resets to idle', async () => {
    await useOnlineStore.getState().hostGame(UNTIMED);
    useOnlineStore.getState().leave();
    expect(conn.close).toHaveBeenCalled();
    expect(useOnlineStore.getState().status).toBe('idle');
  });
});
```
- [ ] **Step 3:** Run `npx vitest run src/renderer/features/online/onlineStore.test.ts` → FAIL (module missing).
- [ ] **Step 4: Implement `onlineStore.ts`.**
```ts
import { create } from 'zustand';
import { opposite, type Color, type TimeControl } from '@/core/types';
import { useGameStore } from '@/features/game/gameStore';
import { RemotePlayer } from '@/features/game/players';
import { hostRoom, joinRoom, type OnlineConnection } from './peerConnection';
import type { NetworkMessage } from './protocol';

type OnlineStatus = 'idle' | 'hosting' | 'joining' | 'connected' | 'error';

interface OnlineState {
  status: OnlineStatus;
  roomCode: string | null;
  localColor: Color | null;
  connection: OnlineConnection | null;
  incomingDrawOffer: boolean;
  error: string | null;
  hostGame(timeControl: TimeControl): Promise<void>;
  joinGame(roomCode: string): Promise<void>;
  clearDrawOffer(): void;
  leave(): void;
}

function waitForInit(connection: OnlineConnection): Promise<Extract<NetworkMessage, { type: 'init' }>> {
  return new Promise((resolve) => {
    const unsubscribe = connection.onMessage((msg) => {
      if (msg.type !== 'init') return;
      unsubscribe();
      resolve(msg);
    });
  });
}

export const useOnlineStore = create<OnlineState>((set, get) => {
  const attachSharedListeners = (connection: OnlineConnection) => {
    connection.onMessage((msg) => {
      if (msg.type === 'drawOffer') set({ incomingDrawOffer: true });
    });
    connection.onClose(() => {
      if (get().status === 'connected') set({ status: 'idle', connection: null, roomCode: null, localColor: null });
    });
  };

  const enterGame = (connection: OnlineConnection, localColor: Color, timeControl: TimeControl) => {
    attachSharedListeners(connection);
    const remotePlayer = new RemotePlayer(connection);
    set({ status: 'connected', connection, localColor });
    useGameStore.getState().startGame({
      white: localColor === 'w' ? { type: 'human' } : { type: 'remote' },
      black: localColor === 'b' ? { type: 'human' } : { type: 'remote' },
      timeControl,
      remote: { color: opposite(localColor), player: remotePlayer },
    });
  };

  return {
    status: 'idle',
    roomCode: null,
    localColor: null,
    connection: null,
    incomingDrawOffer: false,
    error: null,

    async hostGame(timeControl) {
      set({ status: 'hosting', roomCode: null, error: null });
      try {
        const { roomCode, connected } = await hostRoom();
        set({ roomCode });
        const connection = await connected;
        const localColor: Color = Math.random() < 0.5 ? 'w' : 'b';
        connection.send({ type: 'init', joinerColor: opposite(localColor), timeControl });
        enterGame(connection, localColor, timeControl);
      } catch (e) {
        set({ status: 'error', error: e instanceof Error ? e.message : 'Connection failed' });
      }
    },

    async joinGame(roomCode) {
      set({ status: 'joining', error: null });
      try {
        const connection = await joinRoom(roomCode);
        const init = await waitForInit(connection);
        enterGame(connection, init.joinerColor, init.timeControl);
      } catch (e) {
        set({ status: 'error', error: e instanceof Error ? e.message : 'Connection failed' });
      }
    },

    clearDrawOffer() {
      set({ incomingDrawOffer: false });
    },

    leave() {
      get().connection?.close();
      set({ status: 'idle', roomCode: null, localColor: null, connection: null, incomingDrawOffer: false, error: null });
    },
  };
});
```
- [ ] **Step 5:** Run the test → PASS. `npm run typecheck` (this is the point where Task 2's `players.ts` type dependency on `peerConnection.ts` resolves cleanly).
- [ ] **Step 6:** Commit:
```bash
git add src/renderer/features/online/peerConnection.ts src/renderer/features/online/onlineStore.ts src/renderer/features/online/onlineStore.test.ts
git commit -m "feat(online): PeerJS connection wrapper and connection-lifecycle store"
```

### Task 4: gameStore — inject the remote controller

**Files:**
- Modify: `src/renderer/features/game/gameStore.ts`
- Modify: `src/renderer/features/game/gameStore.test.ts`

**Interfaces:** Consumes `GameConfig.remote` (Shared Interfaces). No new public methods — `startGame` changes internally.

- [ ] **Step 1: Write the failing test.** Append to `gameStore.test.ts` (reuse its existing `localConfig`/`state`/`play` helpers):
```ts
it('uses the injected remote controller for the remote seat instead of creating one', async () => {
  const remoteMove = vi.fn(async (_fen: string, signal: AbortSignal) => {
    return new Promise<{ from: string; to: string }>((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')));
      // never resolves on its own in this test — we just check it's the one being asked
    });
  });
  const remotePlayer = { kind: 'remote' as const, requestMove: remoteMove };

  state().startGame({
    white: { type: 'human' },
    black: { type: 'remote' },
    timeControl: UNTIMED,
    remote: { color: 'b', player: remotePlayer },
  });
  play('e2', 'e4'); // the human's move; should trigger a request to the injected remote player for Black
  expect(remoteMove).toHaveBeenCalledTimes(1);
  expect(state().players.b).toBe(remotePlayer);
});
```
- [ ] **Step 2:** Run `npx vitest run src/renderer/features/game/gameStore.test.ts` → FAIL (config.remote not yet consumed).
- [ ] **Step 3: Implement.** In `gameStore.ts`, extend `GameConfig`:
```ts
export interface GameConfig {
  white: PlayerKind;
  black: PlayerKind;
  timeControl: TimeControl;
  fen?: string;
  /** Present only for online games: this seat's actual controller is `player`, not derived from white/black. */
  remote?: { color: Color; player: PlayerController };
}
```
and in `startGame`, change:
```ts
players: { w: createPlayer(config.white), b: createPlayer(config.black) },
```
to:
```ts
players: {
  w: config.remote?.color === 'w' ? config.remote.player : createPlayer(config.white),
  b: config.remote?.color === 'b' ? config.remote.player : createPlayer(config.black),
},
```
Also, in `players.ts`'s `createPlayer`, add a defensive guard so a bare `{type:'remote'}` reaching it (a misuse — it should always be intercepted by `config.remote` above) fails loudly instead of silently misbehaving:
```ts
export function createPlayer(kind: PlayerKind): PlayerController {
  if (kind.type === 'human') return new HumanPlayer();
  if (kind.type === 'engine') return new EnginePlayer(kind.level);
  throw new Error('A "remote" PlayerKind must be supplied via GameConfig.remote, not createPlayer()');
}
```
- [ ] **Step 4:** Run tests → PASS. `npm run typecheck`.
- [ ] **Step 5:** Commit:
```bash
git add src/renderer/features/game/gameStore.ts src/renderer/features/game/gameStore.test.ts src/renderer/features/game/players.ts
git commit -m "feat(online): gameStore accepts a pre-built controller for the remote seat"
```

### Task 5: useOnlineSync hook

**Files:**
- Create: `src/renderer/features/online/useOnlineSync.ts`

**Interfaces:** Consumes `useOnlineStore`, `useGameStore`. No dedicated test (see Global Constraints) — verified in Task 8.

- [ ] **Step 1: Implement.**
```ts
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/features/game/gameStore';
import { useOnlineStore } from './onlineStore';

/** Relays local moves out over the connection and applies incoming resign/draw messages. Mount once, in GameScreen, only while an online game is connected. */
export function useOnlineSync(): void {
  const history = useGameStore((s) => s.history);
  const localColor = useOnlineStore((s) => s.localColor);
  const connection = useOnlineStore((s) => s.connection);

  const previousLength = useRef(0);
  useEffect(() => {
    if (!connection || !localColor) return;
    const grew = history.length > previousLength.current;
    previousLength.current = history.length;
    if (!grew) return;
    const last = history[history.length - 1];
    if (last.color !== localColor) return; // this move arrived from the network — don't echo it back
    connection.send({ type: 'move', move: { from: last.from, to: last.to, promotion: last.promotion }, at: Date.now() });
  }, [history, connection, localColor]);

  useEffect(() => {
    if (!connection) return;
    return connection.onMessage((msg) => {
      if (msg.type === 'resign') {
        const opponentColor = localColor === 'w' ? 'b' : 'w';
        useGameStore.getState().resign(opponentColor!);
      } else if (msg.type === 'drawResponse' && msg.accepted) {
        useGameStore.getState().agreeDraw();
      }
    });
  }, [connection, localColor]);
}
```
- [ ] **Step 2:** `npm run typecheck`.
- [ ] **Step 3:** Commit:
```bash
git add src/renderer/features/online/useOnlineSync.ts
git commit -m "feat(online): sync hook relays local moves and applies remote resign/draw"
```

### Task 6: Online lobby screen

**Files:**
- Create: `src/renderer/components/OnlineLobbyScreen.tsx`
- Create: `src/renderer/components/OnlineLobbyScreen.module.css`

**Interfaces:** Consumes `useOnlineStore`, `TIME_PRESETS`/`UNTIMED` (`@/features/clock/presets`), `Segmented`.

- [ ] **Step 1: Implement.**
```tsx
import { useState } from 'react';
import { TIME_PRESETS } from '@/features/clock/presets';
import { useOnlineStore } from '@/features/online/onlineStore';
import { Segmented } from './ui/Segmented';
import styles from './OnlineLobbyScreen.module.css';

interface Props {
  onExit: () => void;
}

type Tab = 'host' | 'join';

export function OnlineLobbyScreen({ onExit }: Props) {
  const { status, roomCode, error, hostGame, joinGame, leave } = useOnlineStore();
  const [tab, setTab] = useState<Tab>('host');
  const [preset, setPreset] = useState(TIME_PRESETS[3].name); // Rapid 10+0 default
  const [joinCode, setJoinCode] = useState('');

  const timeControl = TIME_PRESETS.find((t) => t.name === preset)!;
  const busy = status === 'hosting' || status === 'joining';

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <h1>Play Online</h1>

        {status === 'connected' ? (
          <p>Connected — starting the game…</p>
        ) : (
          <>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'host', label: 'Host a game' },
                { value: 'join', label: 'Join a game' },
              ]}
            />

            {tab === 'host' && (
              <div className={styles.section}>
                <p className={styles.label}>Time control</p>
                <Segmented value={preset} onChange={setPreset} options={TIME_PRESETS.map((t) => ({ value: t.name, label: t.name }))} />
                {status === 'hosting' && roomCode ? (
                  <div className={styles.codeBox}>
                    <p className={styles.codeLabel}>Share this code with your opponent</p>
                    <p className={styles.code}>{roomCode}</p>
                    <p className={styles.waiting}>Waiting for them to join…</p>
                  </div>
                ) : (
                  <button className="btn btn-primary" disabled={busy} onClick={() => hostGame(timeControl)}>
                    Create room
                  </button>
                )}
              </div>
            )}

            {tab === 'join' && (
              <div className={styles.section}>
                <input
                  className={styles.input}
                  placeholder="Enter room code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <button className="btn btn-primary" disabled={busy || joinCode.length < 4} onClick={() => joinGame(joinCode)}>
                  {status === 'joining' ? 'Connecting…' : 'Join'}
                </button>
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}
          </>
        )}

        <button
          className="btn"
          onClick={() => {
            leave();
            onExit();
          }}
        >
          ☰ Menu
        </button>
      </div>
    </div>
  );
}
```
- [ ] **Step 2:** `src/renderer/components/OnlineLobbyScreen.module.css`:
```css
.screen {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
}

.card {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 32px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--panel);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
  text-align: center;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--muted);
}

.codeBox {
  padding: 16px;
  border-radius: 12px;
  background: var(--panel-raised);
}

.codeLabel {
  font-size: 13px;
  color: var(--muted);
}

.code {
  margin: 8px 0;
  font-size: 32px;
  font-weight: 800;
  letter-spacing: 4px;
  color: var(--accent);
}

.waiting {
  font-size: 13px;
  color: var(--muted);
}

.input {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel-raised);
  color: var(--text);
  font: inherit;
  font-size: 20px;
  letter-spacing: 4px;
  text-align: center;
  text-transform: uppercase;
}

.error {
  color: var(--danger);
  font-size: 14px;
}
```
- [ ] **Step 3:** `npm run typecheck`.
- [ ] **Step 4:** Commit:
```bash
git add src/renderer/components/OnlineLobbyScreen.tsx src/renderer/components/OnlineLobbyScreen.module.css
git commit -m "feat(ui): online lobby screen (host/join by room code)"
```

### Task 7: ControlBar, GameScreen, NewGameMenu, App routing, CSP

**Files:**
- Modify: `src/renderer/components/ControlBar.tsx`
- Modify: `src/renderer/components/GameScreen.tsx`
- Modify: `src/renderer/components/NewGameMenu.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/index.html`

**Interfaces:** Consumes `useOnlineStore`, `OnlineLobbyScreen`, `useOnlineSync`.

- [ ] **Step 1: `ControlBar.tsx`** — add online-awareness. Replace the existing `vsComputer`/draw-button block:
```tsx
import { useOnlineStore } from '@/features/online/onlineStore';
// ...
const isOnline = players.w.kind === 'remote' || players.b.kind === 'remote';
const vsComputer = !isOnline && (players.w.kind !== 'human' || players.b.kind !== 'human');
const onlineConnection = useOnlineStore((s) => s.connection);
const incomingDrawOffer = useOnlineStore((s) => s.incomingDrawOffer);
const clearDrawOffer = useOnlineStore((s) => s.clearDrawOffer);
```
Change the Undo button's `disabled` to also cover online: `disabled={!playing || history.length === 0 || isOnline}`.
Change the resign handler to also notify the peer for online games:
```tsx
onClick={confirm('resign', () => {
  resign(resigningColor);
  if (isOnline) onlineConnection?.send({ type: 'resign' });
})}
```
Replace the local-only draw block with one that branches on `isOnline`:
```tsx
{!vsComputer && !isOnline && (
  <button className={`btn btn-danger ${armed === 'draw' ? 'armed' : ''}`} disabled={!playing} onClick={confirm('draw', agreeDraw)}>
    {armed === 'draw' ? 'Agree?' : '½ Draw'}
  </button>
)}
{isOnline && !incomingDrawOffer && (
  <button
    className={`btn ${armed === 'draw' ? 'btn-danger armed' : ''}`}
    disabled={!playing}
    onClick={confirm('draw', () => onlineConnection?.send({ type: 'drawOffer' }))}
  >
    {armed === 'draw' ? 'Send offer?' : '🤝 Offer Draw'}
  </button>
)}
{isOnline && incomingDrawOffer && (
  <>
    <button
      className="btn btn-primary"
      onClick={() => {
        onlineConnection?.send({ type: 'drawResponse', accepted: true });
        clearDrawOffer();
        agreeDraw();
      }}
    >
      Accept draw
    </button>
    <button
      className="btn"
      onClick={() => {
        onlineConnection?.send({ type: 'drawResponse', accepted: false });
        clearDrawOffer();
      }}
    >
      Decline
    </button>
  </>
)}
```
- [ ] **Step 2: `GameScreen.tsx`** — mount `useOnlineSync` and show a status pill when online:
```tsx
import { useOnlineStore } from '@/features/online/onlineStore';
import { useOnlineSync } from '@/features/online/useOnlineSync';
// ... inside GameScreen():
const isOnline = useOnlineStore((s) => s.status === 'connected');
useOnlineSync(); // no-ops internally when there's no connection
```
Add a small pill in the sidebar (near the top `ClockPanel`, wherever fits the existing layout without restructuring it): `{isOnline && <p className={styles.onlinePill}>🌐 Online</p>}`, with a matching `.onlinePill` rule added to `GameScreen.module.css` (small, muted-accent text, consistent with the existing `.hintText` style already in that file).
- [ ] **Step 3: `NewGameMenu.tsx`** — add the entry point, mirroring the existing Puzzles/Openings/Stats buttons:
```tsx
import { useOpeningExplorerStore } from '@/features/openings/openingExplorerStore'; // already imported
// add:
import { useWeaknessDashboardStore } from '@/features/history/weaknessDashboardStore'; // already imported
import { createVisibilityStore } from '@/features/shared/visibilityStore';
```
Reuse the existing `createVisibilityStore()` factory for a new `useOnlineLobbyStore` (place it alongside `openingExplorerStore.ts`'s pattern, in `src/renderer/features/online/onlineLobbyVisibilityStore.ts`):
```ts
import { createVisibilityStore } from '@/features/shared/visibilityStore';
export const useOnlineLobbyStore = createVisibilityStore();
```
Then in `NewGameMenu.tsx`, add the button:
```tsx
const showOnlineLobby = useOnlineLobbyStore((s) => s.show);
// ...
<button className="btn" onClick={showOnlineLobby}>
  🌐 Play Online
</button>
```
- [ ] **Step 4: `App.tsx`** — route to the lobby (and, once connected, straight into `GameScreen` the same way the lobby's own "connected" state already hands off — no extra App-level branch needed for the in-progress game itself, since `gameStore.status` becomes `'playing'` exactly like any other game):
```tsx
import { useOnlineLobbyStore } from './features/online/onlineLobbyVisibilityStore';
import { OnlineLobbyScreen } from './components/OnlineLobbyScreen';
// ...
const lobbyVisible = useOnlineLobbyStore((s) => s.visible);
const hideOnlineLobby = useOnlineLobbyStore((s) => s.hide);
const gameStatus = useGameStore((s) => s.status); // already read once below for `inMenu`; reuse the same value
const showingOnlineLobby = lobbyVisible && gameStatus !== 'playing';
// add before the final menu/game fallback:
if (showingOnlineLobby) return <OnlineLobbyScreen onExit={hideOnlineLobby} />;
```
(The `&& gameStatus !== 'playing'` guard lets the lobby's own visibility flag stay `true` harmlessly once the game actually starts — `gameStore.status` flips to `'playing'` inside `onlineStore.hostGame`/`joinGame`'s call to `startGame`, so the plain `inMenu ? <NewGameMenu/> : <GameScreen/>` fallback takes over correctly without needing the lobby to explicitly hide itself at that exact moment. Since `inMenu` is derived from `gameStatus === 'menu'`, replace that line too so `gameStatus` is read once, not twice: `const inMenu = gameStatus === 'menu';`. Still call `useOnlineLobbyStore.getState().hide()` once inside `onlineStore`'s `enterGame` helper from Task 3, for cleanliness, so leaving the game later via `backToMenu` doesn't re-show a stale lobby.)

Revisit Task 3's `enterGame` to add that one line — append to the plan as a note rather than re-deriving the whole function: in `onlineStore.ts`'s `enterGame`, after the existing `set({...})` call, add `useOnlineLobbyStore.getState().hide();` (import it there too).
- [ ] **Step 5: `index.html`** — CSP change:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self'; connect-src 'self' https://0.peerjs.com wss://0.peerjs.com" />
```
- [ ] **Step 6:** `npm test && npm run typecheck && npm run build && npm run build:web`.
- [ ] **Step 7:** Commit:
```bash
git add src/renderer/components/ControlBar.tsx src/renderer/components/GameScreen.tsx src/renderer/components/GameScreen.module.css src/renderer/components/NewGameMenu.tsx src/renderer/App.tsx src/renderer/index.html src/renderer/features/online/onlineLobbyVisibilityStore.ts src/renderer/features/online/onlineStore.ts
git commit -m "feat(ui): online play wired into controls, game screen, menu, and CSP"
```

### Task 8: Final live two-client verification

This feature cannot be meaningfully verified with one browser tab talking to itself — it needs two independent clients actually negotiating a WebRTC connection through the real PeerJS broker.

- [ ] `npm test` — all suites pass. `npm run typecheck` and `npm run build` / `npm run build:web` clean.
- [ ] `npm run dev` (or `npm run dev:web` in two separate browser tabs/windows — either combination works since both share the same code):
  - Open two independent sessions (e.g. two browser profiles/tabs, or one Electron window plus one browser tab on `dev:web` — this doubles as a real cross-target check).
  - Session A: Play Online → Host a game → pick a time control → note the room code.
  - Session B: Play Online → Join a game → enter the code.
  - Confirm: both land in a live game with correct, opposite colors; playing a move in A appears in B (and vice versa) with the normal animation; the clock in both sessions stays in sync (compare displayed times); Resign in one ends the game with the correct result in both; Offer Draw in one shows the Accept/Decline banner in the other, and Accept ends the game as a draw in both; closing one session's tab/window ends the other's game with a "disconnected" result; "Review game" works afterward exactly like a local game.
- [ ] Fix any defects found, committing as you go.

---

## Self-Review

- **Spec coverage:** transport/protocol (Task 1, 3), `RemotePlayer` via the existing seam (Task 2), `gameStore` injection point (Task 4), move/resign/draw relay (Task 5, 7), lobby UI (Task 6), CSP (Task 7), live two-client proof (Task 8) — matches the design doc's scope; reconnection/persistence explicitly deferred, matching the design's non-goals.
- **Type consistency:** `NetworkMessage`, `OnlineConnection`, `RemotePlayer`, `GameConfig.remote` defined once (Shared Interfaces / their originating tasks) and reused verbatim afterward.
- **Placeholder scan:** none found.
