# Online Play — Sub-project A: Core Play — Design

Play a live game against a specific friend over the internet, from either the Electron app or the PWA —
same renderer source, so this works on both once built once. Reconnection/persistence across an app
restart is explicitly **out of scope** here (sub-project B, after this ships and is proven).

## Transport

`peerjs` v1.5.x (MIT, free), used only through a small wrapper (`features/online/peerConnection.ts`) so
nothing else in the app touches the library directly:

```ts
export interface OnlineConnection {
  send(msg: NetworkMessage): void;
  onMessage(cb: (msg: NetworkMessage) => void): () => void; // returns an unsubscribe function
  onClose(cb: () => void): () => void;
  close(): void;
}

export function hostRoom(): Promise<{ roomCode: string; connected: Promise<OnlineConnection> }>;
export function joinRoom(roomCode: string): Promise<OnlineConnection>;
```

- `hostRoom()`: `new Peer(code)` where `code` is a random 6-character `[A-Z0-9]` string (regenerated and
  retried on the rare `unavailable-id` error). Returns the code immediately (to show the host) plus a
  promise that resolves once `peer.on('connection', ...)` fires.
- `joinRoom(code)`: `new Peer()` (no custom ID needed), then `peer.connect(code)`; resolves once the
  `DataConnection`'s `open` event fires, rejects on `peer.on('error', ...)` (bad/unknown code, or network
  failure) after a bounded timeout (10s).
- Uses PeerJS's default free public broker (`0.peerjs.com:443`) — no configuration, no account.

## Protocol

```ts
export type NetworkMessage =
  | { type: 'init'; joinerColor: Color; timeControl: TimeControl }
  | { type: 'move'; move: MoveInput; at: number } // `at` = sender's Date.now()
  | { type: 'resign' }
  | { type: 'drawOffer' }
  | { type: 'drawResponse'; accepted: boolean };
```

The host decides colors (coin flip) and time control, and is the only side that sends `init`, immediately
after the connection opens. Every `move` message carries the sender's own timestamp; **both** clients call
`clock.press(nextColor, msg.at)` using that shared value, so the two independently-running `Clock`
instances (already built, unchanged) never drift apart — no separate clock-sync message needed.

## Reusing the phase-1 seam

`PlayerController.kind` already includes `'remote'` in its type (written in phase 1 specifically for this).
A new `RemotePlayer` implements it:

```ts
export class RemotePlayer implements PlayerController {
  readonly kind = 'remote';
  constructor(connection: OnlineConnection);
  requestMove(fen: string, signal: AbortSignal): Promise<MoveInput>; // resolves when a 'move' message arrives
}
```

Your own moves already flow through the existing click → `select()` → `playMove()` path — **unchanged**.
The opponent's moves arrive over the network and resolve `RemotePlayer.requestMove()`, which
`gameStore`'s existing turn loop (`requestNextMove`) already knows how to consume, identically to how it
consumes an engine's move today.

`GameConfig` gains one optional field so `startGame` can use a specific pre-built controller instead of
constructing one from a `PlayerKind`:

```ts
export interface GameConfig {
  white: PlayerKind;
  black: PlayerKind;
  timeControl: TimeControl;
  fen?: string;
  remote?: { color: Color; player: RemotePlayer }; // present only for online games
}
```

`core/types.ts` additions: `PlayerKind` gains `{ type: 'remote' }`; `GameResult` gains
`{ kind: 'disconnected'; winner: Color }`.

## Sync hook

`features/online/useOnlineSync.ts` (same shape as the existing `useGameEffects`/`usePuzzleEffects`
hooks): mounted in `GameScreen` whenever `onlineStore.status === 'connected'`.

- Watches `gameStore.history` growth; when the newest move's `.color` matches the **local** seat (never
  the remote one), sends `{ type: 'move', move, at: Date.now() }`.
- Listens for incoming `resign` → `gameStore.resign(remoteColor)`; `drawOffer` → sets a small local
  "incoming offer" flag the UI reads; `drawResponse` → if accepted, `gameStore.agreeDraw()`.
- Listens for `connection.onClose` → if the game is still `'playing'`, ends it with
  `{ kind: 'disconnected', winner: localColor }` (the side still connected didn't do anything wrong).

Resigning/offering a draw yourself is a **user-initiated** action, not a passive state change — those are
sent directly at the click site (`ControlBar`), which already orchestrates more than one store today (see
its existing `startReview` call).

## UI

- `OnlineLobbyScreen.tsx`: Host tab (shows the generated code large + "Copy", spinner until connected) /
  Join tab (text input + Join button). On connect, `onlineStore` calls `gameStore.startGame(...)` with the
  `remote` field set, and the screen hands off to the normal `GameScreen` (routed the same way
  Puzzle/Review/Openings already insert themselves ahead of the plain menu/game check in `App.tsx`).
- `GameScreen` sidebar: a small "🌐 Online" status pill next to the existing player labels.
- `ControlBar`: for an online game (`players.w.kind === 'remote' || players.b.kind === 'remote'`) —
  Undo is disabled entirely (you can't unilaterally take back a move against a real opponent); Resign
  also sends `{ type: 'resign' }`; "½ Draw" becomes "Offer Draw" (sends `drawOffer`) instead of instantly
  agreeing, and a banner appears for the receiving side ("Opponent offers a draw — Accept / Decline"),
  sending `drawResponse` either way.
- `NewGameMenu`: a "🌐 Play Online" entry point, opening the lobby.

Once the game ends (any reason, including `disconnected`), "Review game" already works completely
unchanged — it only ever needed `{ startFen, history }`.

## CSP

`index.html`'s CSP currently has no `connect-src` override (falls back to `default-src 'self'`), which
blocks the WebSocket PeerJS uses to reach its broker. Add:
`connect-src 'self' https://0.peerjs.com wss://0.peerjs.com;` — required in the one shared `index.html`
(so both the Electron and web builds get it, same as every other shared asset).

## Error handling

- Bad/unknown room code, broker unreachable, or the 10s join timeout → lobby shows a plain error message,
  offers "Try again."
- Mid-game disconnect → the `disconnected` result, same modal/flow as any other game-over reason.
- The engine worker, puzzle trainer, and all offline features are entirely unaffected — this is additive.

## Non-goals (this sub-project)

Reconnection after a drop, surviving the app being closed, spectating, in-game chat, matchmaking with
strangers (invite-code only, one game at a time).
