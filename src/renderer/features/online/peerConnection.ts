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
