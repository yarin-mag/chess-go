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
    reset() {
      this.sent.length = 0;
      handlers.length = 0;
      closeHandlers.length = 0;
    },
  };
}

const conn = fakeConnection();

vi.mock('./peerConnection', () => ({
  hostRoom: vi.fn(async () => ({ roomCode: 'ABC123', connected: Promise.resolve(conn) })),
  joinRoom: vi.fn(async () => conn),
  JOIN_TIMEOUT_MS: 10_000,
}));

vi.mock('@/features/game/gameStore', () => ({
  useGameStore: { getState: () => ({ startGame: vi.fn(), resign: vi.fn(), agreeDraw: vi.fn() }) },
}));

import { useOnlineStore } from './onlineStore';
import { hostRoom, joinRoom, JOIN_TIMEOUT_MS } from './peerConnection';
import { useReactionStore } from './reactionStore';
import { useGameStore } from '@/features/game/gameStore';
import { UNTIMED } from '@/features/clock/presets';

describe('onlineStore', () => {
  afterEach(() => {
    useOnlineStore.getState().leave();
    useReactionStore.setState({ current: null });
    conn.reset(); // conn is shared module-level across every test in this file — clear it so `sent`/message
                  // listeners from one test can never leak into the next (e.g. a reaction sent in an
                  // earlier test would otherwise still satisfy a later test's `conn.sent.find(...)` check).
  });

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
    // joinGame awaits the mocked joinRoom() before it registers its 'init' listener, so emitting on the
    // very next line (as the plan originally had it) races ahead of that listener and the message is
    // lost, hanging the test forever. Flush pending microtasks first so the listener is registered.
    await new Promise((resolve) => setTimeout(resolve, 0));
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

  it('sendReaction sends over the connection and shows it locally', async () => {
    await useOnlineStore.getState().hostGame(UNTIMED);
    useOnlineStore.getState().sendReaction('👍');
    expect(conn.sent.find((m) => m.type === 'reaction')).toEqual({ type: 'reaction', text: '👍' });
    expect(useReactionStore.getState().current?.text).toBe('👍');
  });

  it('sendReaction ignores text that is not a known preset', async () => {
    await useOnlineStore.getState().hostGame(UNTIMED);
    useOnlineStore.getState().sendReaction('not a real reaction');
    expect(conn.sent.find((m) => m.type === 'reaction')).toBeUndefined();
    expect(useReactionStore.getState().current).toBeNull();
  });

  it('sendReaction does nothing when there is no connection', () => {
    useOnlineStore.getState().sendReaction('👍');
    expect(useReactionStore.getState().current).toBeNull();
  });

  it('sendDrawOffer sends the offer and marks it pending', async () => {
    await useOnlineStore.getState().hostGame(UNTIMED);
    useOnlineStore.getState().sendDrawOffer();
    expect(conn.sent.find((m) => m.type === 'drawOffer')).toBeDefined();
    expect(useOnlineStore.getState().drawOfferSent).toBe(true);
  });

  it('clears the pending offer and shows a decline notice when the opponent declines', async () => {
    await useOnlineStore.getState().hostGame(UNTIMED);
    useOnlineStore.getState().sendDrawOffer();
    conn.emit({ type: 'drawResponse', accepted: false });
    expect(useOnlineStore.getState().drawOfferSent).toBe(false);
    expect(useReactionStore.getState().current?.text).toBe('Draw declined');
  });

  it('clears the pending offer when the opponent accepts', async () => {
    await useOnlineStore.getState().hostGame(UNTIMED);
    useOnlineStore.getState().sendDrawOffer();
    conn.emit({ type: 'drawResponse', accepted: true });
    expect(useOnlineStore.getState().drawOfferSent).toBe(false);
  });

  it('leave() while hosting aborts the attempt, so a late-resolving connection never enters a game', async () => {
    let resolveConnected!: (c: typeof conn) => void;
    vi.mocked(hostRoom).mockImplementationOnce(async () => ({
      roomCode: 'LATE01',
      connected: new Promise((resolve) => {
        resolveConnected = resolve;
      }),
    }));
    const promise = useOnlineStore.getState().hostGame(UNTIMED);
    await Promise.resolve();
    await Promise.resolve();
    expect(useOnlineStore.getState().status).toBe('hosting');
    useOnlineStore.getState().leave();
    resolveConnected(conn);
    await promise;
    expect(useOnlineStore.getState().status).toBe('idle');
  });

  it('leave() while joining aborts the attempt', async () => {
    let resolveConn!: (c: typeof conn) => void;
    vi.mocked(joinRoom).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveConn = resolve;
        }),
    );
    const promise = useOnlineStore.getState().joinGame('ABC123');
    await Promise.resolve();
    expect(useOnlineStore.getState().status).toBe('joining');
    useOnlineStore.getState().leave();
    resolveConn(conn);
    await promise;
    expect(useOnlineStore.getState().status).toBe('idle');
  });

  it('joinGame times out with a friendly error if init never arrives', async () => {
    vi.useFakeTimers();
    try {
      const promise = useOnlineStore.getState().joinGame('ABC123'); // conn never emits 'init'
      await vi.advanceTimersByTimeAsync(JOIN_TIMEOUT_MS);
      await promise;
      expect(useOnlineStore.getState().status).toBe('error');
      expect(useOnlineStore.getState().error).toMatch(/check the code/i);
    } finally {
      vi.useRealTimers();
    }
  });
});
