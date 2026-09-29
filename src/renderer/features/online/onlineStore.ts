import { create } from 'zustand';
import { t } from '@/i18n';
import { opposite, type Color, type TimeControl } from '@/core/types';
import { useGameStore } from '@/features/game/gameStore';
import { RemotePlayer } from '@/features/game/players';
import { useOnlineLobbyStore } from './onlineLobbyVisibilityStore';
import { hostRoom, joinRoom, JOIN_TIMEOUT_MS, ROOM_UNREACHABLE, type OnlineConnection } from './peerConnection';
import { isKnownReaction, type NetworkMessage, type ReactionKey } from './protocol';
import { useReactionStore } from './reactionStore';

type OnlineStatus = 'idle' | 'hosting' | 'joining' | 'connected' | 'error';

interface OnlineState {
  status: OnlineStatus;
  roomCode: string | null;
  localColor: Color | null;
  connection: OnlineConnection | null;
  incomingDrawOffer: boolean;
  /** True from the moment we send a drawOffer until the opponent responds (accept ends the game anyway;
   *  decline clears this and pops a "Draw declined" notice). */
  drawOfferSent: boolean;
  error: string | null;
  hostGame(timeControl: TimeControl): Promise<void>;
  joinGame(roomCode: string): Promise<void>;
  clearDrawOffer(): void;
  sendDrawOffer(): void;
  sendReaction(key: ReactionKey): void;
  leave(): void;
}

function waitForInit(connection: OnlineConnection, signal: AbortSignal): Promise<Extract<NetworkMessage, { type: 'init' }>> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Cancelled'));
    let unsubscribe: () => void = () => {};
    // The host's `init` is expected within moments of the data channel opening; if it never arrives
    // (host crashed/reloaded/buggy), don't hang the joiner forever — match joinRoom's own timeout.
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(ROOM_UNREACHABLE));
    }, JOIN_TIMEOUT_MS);
    unsubscribe = connection.onMessage((msg) => {
      if (msg.type !== 'init') return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(msg);
    });
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        unsubscribe();
        reject(new Error('Cancelled'));
      },
      { once: true },
    );
  });
}

/** Never surfaces raw English (PeerJS's own error text, or anything else) to the UI — only these two. */
function describeConnectionError(e: unknown): string {
  const key = e instanceof Error && e.message === ROOM_UNREACHABLE ? 'errorRoomUnreachable' : 'errorConnectionFailed';
  return t(`online:${key}`);
}

// The in-flight host/join attempt, if any — aborted by leave() so a user who backs out of the lobby (or
// starts a different game) doesn't leave a room registered on the broker, or a connection that resolves
// after they've moved on and silently drops them into a game they thought they'd cancelled.
let inFlight: AbortController | null = null;

export const useOnlineStore = create<OnlineState>((set, get) => {
  const attachSharedListeners = (connection: OnlineConnection) => {
    connection.onMessage((msg) => {
      if (msg.type === 'drawOffer') {
        set({ incomingDrawOffer: true });
      } else if (msg.type === 'drawResponse') {
        set({ drawOfferSent: false });
        if (!msg.accepted) useReactionStore.getState().show(t('online:drawDeclined'));
      }
    });
    connection.onClose(() => {
      if (get().status === 'connected') set({ status: 'idle', connection: null, roomCode: null, localColor: null });
    });
  };

  const enterGame = (connection: OnlineConnection, localColor: Color, timeControl: TimeControl) => {
    attachSharedListeners(connection);
    const remotePlayer = new RemotePlayer(connection);
    set({ status: 'connected', connection, localColor });
    useOnlineLobbyStore.getState().hide(); // leaving the game later via backToMenu shouldn't re-show a stale lobby
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
    drawOfferSent: false,
    error: null,

    async hostGame(timeControl) {
      inFlight?.abort();
      const controller = new AbortController();
      inFlight = controller;
      set({ status: 'hosting', roomCode: null, error: null });
      try {
        const { roomCode, connected } = await hostRoom(controller.signal);
        if (controller.signal.aborted) return;
        set({ roomCode });
        const connection = await connected;
        if (controller.signal.aborted) {
          connection.close();
          return;
        }
        const localColor: Color = Math.random() < 0.5 ? 'w' : 'b';
        connection.send({ type: 'init', joinerColor: opposite(localColor), timeControl });
        enterGame(connection, localColor, timeControl);
      } catch (e) {
        if (controller.signal.aborted) return; // expected — leave() caused this
        set({ status: 'error', error: describeConnectionError(e) });
      } finally {
        if (inFlight === controller) inFlight = null;
      }
    },

    async joinGame(roomCode) {
      inFlight?.abort();
      const controller = new AbortController();
      inFlight = controller;
      set({ status: 'joining', error: null });
      try {
        const connection = await joinRoom(roomCode, controller.signal);
        if (controller.signal.aborted) {
          connection.close();
          return;
        }
        const init = await waitForInit(connection, controller.signal);
        if (controller.signal.aborted) return;
        enterGame(connection, init.joinerColor, init.timeControl);
      } catch (e) {
        if (controller.signal.aborted) return;
        set({ status: 'error', error: describeConnectionError(e) });
      } finally {
        if (inFlight === controller) inFlight = null;
      }
    },

    clearDrawOffer() {
      set({ incomingDrawOffer: false });
    },

    sendDrawOffer() {
      const { connection } = get();
      if (!connection) return;
      connection.send({ type: 'drawOffer' });
      set({ drawOfferSent: true });
    },

    sendReaction(key) {
      const { connection } = get();
      if (!connection || !isKnownReaction(key)) return;
      connection.send({ type: 'reaction', key });
      // the sender sees their own reaction pop too, not just the receiver — shown in the sender's own locale
      useReactionStore.getState().show(t(`online:reaction_${key}`));
    },

    leave() {
      inFlight?.abort();
      inFlight = null;
      get().connection?.close();
      set({
        status: 'idle',
        roomCode: null,
        localColor: null,
        connection: null,
        incomingDrawOffer: false,
        drawOfferSent: false,
        error: null,
      });
    },
  };
});
