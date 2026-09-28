import { create } from 'zustand';
import { opposite, type Color, type TimeControl } from '@/core/types';
import { useGameStore } from '@/features/game/gameStore';
import { RemotePlayer } from '@/features/game/players';
import { useOnlineLobbyStore } from './onlineLobbyVisibilityStore';
import { hostRoom, joinRoom, type OnlineConnection } from './peerConnection';
import { isKnownReaction, type NetworkMessage } from './protocol';
import { useReactionStore } from './reactionStore';

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
  sendReaction(text: string): void;
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

    sendReaction(text) {
      const { connection } = get();
      if (!connection || !isKnownReaction(text)) return;
      connection.send({ type: 'reaction', text });
      useReactionStore.getState().show(text); // the sender sees their own reaction pop too, not just the receiver
    },

    leave() {
      get().connection?.close();
      set({ status: 'idle', roomCode: null, localColor: null, connection: null, incomingDrawOffer: false, error: null });
    },
  };
});
