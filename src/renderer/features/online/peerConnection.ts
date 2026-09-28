import Peer, { type DataConnection } from 'peerjs';
import { randomRoomCode } from './protocol';
import type { NetworkMessage } from './protocol';

export interface OnlineConnection {
  send(msg: NetworkMessage): void;
  onMessage(cb: (msg: NetworkMessage) => void): () => void;
  onClose(cb: () => void): () => void;
  close(): void;
}

export const JOIN_TIMEOUT_MS = 10_000;

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

const cancelledError = () => new Error('Cancelled');

/**
 * Creates a room others can join by code. Resolves with the code immediately, and separately once a peer
 * connects. `signal` lets the caller give up — e.g. the player left the lobby, or started a different
 * game — without leaking the broker registration/websocket for a room nobody will ever join.
 */
export function hostRoom(signal?: AbortSignal): Promise<{ roomCode: string; connected: Promise<OnlineConnection> }> {
  return new Promise((resolveCode, rejectCode) => {
    if (signal?.aborted) return rejectCode(cancelledError());

    const attempt = (): void => {
      const code = randomRoomCode();
      const peer = new Peer(code);
      signal?.addEventListener('abort', () => peer.destroy(), { once: true });

      peer.on('open', () => {
        if (signal?.aborted) return; // destroy() above already tore the peer down
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
        if (signal?.aborted) return;
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

/** Joins a room by its code. `signal` cancels a still-pending attempt (see `hostRoom`). */
export function joinRoom(roomCode: string, signal?: AbortSignal): Promise<OnlineConnection> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(cancelledError());

    const peer = new Peer();
    const timeout = setTimeout(() => {
      peer.destroy();
      reject(new Error('Could not reach that room — check the code and try again.'));
    }, JOIN_TIMEOUT_MS);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        peer.destroy();
        reject(cancelledError());
      },
      { once: true },
    );

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
