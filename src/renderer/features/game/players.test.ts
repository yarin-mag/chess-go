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
