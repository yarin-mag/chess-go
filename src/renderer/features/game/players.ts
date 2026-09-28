import { ChessGame } from '@/core/chessGame';
import type { Level, MoveInput, PlayerKind } from '@/core/types';
import { requestEngineMove } from '@/engine/engineClient';
import type { OnlineConnection } from '@/features/online/peerConnection';

/**
 * Anything that can supply moves for one side. This is the seam for phase 2:
 * a `RemotePlayer` (network) implements the same interface as the engine.
 *
 * Human players have kind 'human': their moves arrive through the board UI
 * (`gameStore.select`), so the store never calls `requestMove` on them.
 */
export interface PlayerController {
  readonly kind: 'human' | 'engine' | 'remote';
  requestMove(fen: string, signal: AbortSignal): Promise<MoveInput>;
}

/** Engines answer instantly on easy positions; a short pause makes the game feel natural. */
const MIN_THINK_MS = 500;

const abortError = () => new DOMException('Move request aborted', 'AbortError');

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

class HumanPlayer implements PlayerController {
  readonly kind = 'human';

  requestMove(): Promise<MoveInput> {
    return Promise.reject(new Error('Human moves come from the board UI'));
  }
}

class EnginePlayer implements PlayerController {
  readonly kind = 'engine';

  constructor(private readonly level: Level) {}

  async requestMove(fen: string, signal: AbortSignal): Promise<MoveInput> {
    const [move] = await Promise.all([this.computeMove(fen), delay(MIN_THINK_MS, signal)]);
    if (signal.aborted) throw abortError();
    return move;
  }

  private async computeMove(fen: string): Promise<MoveInput> {
    try {
      return await requestEngineMove(fen, this.level);
    } catch (error) {
      console.error('Engine failed, playing a random legal move instead', error);
      const moves = new ChessGame(fen).legalMoves();
      return moves[Math.floor(Math.random() * moves.length)];
    }
  }
}

export class RemotePlayer implements PlayerController {
  readonly kind = 'remote' as const;
  /** The sender's own timestamp on the most recently resolved move — gameStore presses the clock with
      this instead of the receiver's own Date.now(), so the two clients agree on the mover's elapsed time
      regardless of network latency. */
  lastAt: number | null = null;

  constructor(private readonly connection: OnlineConnection) {}

  requestMove(_fen: string, signal: AbortSignal): Promise<MoveInput> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(abortError());
      const unsubscribe = this.connection.onMessage((msg) => {
        if (msg.type !== 'move') return;
        unsubscribe();
        this.lastAt = msg.at;
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

export function createPlayer(kind: PlayerKind): PlayerController {
  if (kind.type === 'human') return new HumanPlayer();
  if (kind.type === 'engine') return new EnginePlayer(kind.level);
  throw new Error('A "remote" PlayerKind must be supplied via GameConfig.remote, not createPlayer()');
}
