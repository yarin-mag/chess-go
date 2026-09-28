import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore, type GameConfig } from './gameStore';
import { UNTIMED } from '@/features/clock/presets';

// Stub the worker-backed engine: always answer with the first legal move.
vi.mock('@/engine/engineClient', () => ({
  requestEngineMove: vi.fn(async (fen: string) => {
    const { ChessGame } = await import('@/core/chessGame');
    return new ChessGame(fen).legalMoves()[0];
  }),
  requestMoveHint: vi.fn(async (fen: string) => {
    const { scoreRootMoves } = await import('@/engine/search');
    const { ANALYSIS_LEVEL } = await import('@/engine/analyzeLevel');
    const [best] = scoreRootMoves(fen, ANALYSIS_LEVEL);
    return { bestMove: best.move, bestSan: best.san, bestScore: best.score };
  }),
}));

const human = { type: 'human' } as const;
const localConfig = (over: Partial<GameConfig> = {}): GameConfig => ({
  white: human,
  black: human,
  timeControl: UNTIMED,
  ...over,
});

const play = (from: string, to: string) => {
  useGameStore.getState().select(from);
  useGameStore.getState().select(to);
};
const state = () => useGameStore.getState();

describe('gameStore', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    state().backToMenu();
    vi.useRealTimers();
  });

  it('alternates turns and records history', () => {
    state().startGame(localConfig());
    play('e2', 'e4');
    expect(state().history).toHaveLength(1);
    expect(state().game.turn()).toBe('b');
    expect(state().lastMove).toEqual({ from: 'e2', to: 'e4' });
  });

  it("ignores the opponent's pieces and illegal targets", () => {
    state().startGame(localConfig());
    state().select('e7');
    expect(state().selected).toBeNull();
    state().select('e2');
    expect(state().targets.sort()).toEqual(['e3', 'e4']);
    state().select('e5');
    expect(state().history).toHaveLength(0);
    expect(state().selected).toBeNull();
  });

  it('reselects another own piece and deselects on second click', () => {
    state().startGame(localConfig());
    state().select('e2');
    state().select('d2');
    expect(state().selected).toBe('d2');
    state().select('d2');
    expect(state().selected).toBeNull();
  });

  it('opens the promotion dialog, then completes the move', () => {
    state().startGame(localConfig({ fen: '8/P7/8/8/8/8/k6K/8 w - - 0 1' }));
    play('a7', 'a8');
    expect(state().pendingPromotion).toEqual({ from: 'a7', to: 'a8' });
    expect(state().history).toHaveLength(0);
    state().choosePromotion('q');
    expect(state().history[0].san).toContain('=Q');
    expect(state().pendingPromotion).toBeNull();
  });

  it("ends the game on checkmate (fool's mate)", () => {
    state().startGame(localConfig());
    play('f2', 'f3');
    play('e7', 'e5');
    play('g2', 'g4');
    play('d8', 'h4');
    expect(state().status).toBe('over');
    expect(state().result).toEqual({ kind: 'checkmate', winner: 'b' });
  });

  it('ends the game when a clock flags', () => {
    state().startGame(localConfig({ timeControl: { name: 'test', minutes: 1, incrementSec: 0 } }));
    state().tickClock(Date.now() + 30_000);
    expect(state().status).toBe('playing');
    state().tickClock(Date.now() + 61_000);
    expect(state().result).toEqual({ kind: 'timeout', winner: 'b' });
  });

  it('resign and draw by agreement end the game', () => {
    state().startGame(localConfig());
    state().resign('w');
    expect(state().result).toEqual({ kind: 'resign', winner: 'b' });
    state().startGame(localConfig());
    state().agreeDraw();
    expect(state().result).toEqual({ kind: 'draw', reason: 'agreement' });
  });

  it('the engine replies after the human moves', async () => {
    state().startGame(localConfig({ black: { type: 'engine', level: 'easy' } }));
    play('e2', 'e4');
    expect(state().engineThinking).toBe(true);
    await vi.advanceTimersByTimeAsync(700);
    expect(state().history).toHaveLength(2);
    expect(state().game.turn()).toBe('w');
    expect(state().engineThinking).toBe(false);
  });

  it('human cannot move while the engine is thinking', async () => {
    state().startGame(localConfig({ black: { type: 'engine', level: 'easy' } }));
    play('e2', 'e4');
    state().select('d7');
    expect(state().selected).toBeNull();
    await vi.advanceTimersByTimeAsync(700);
  });

  it('undo against the engine removes both plies', async () => {
    state().startGame(localConfig({ black: { type: 'engine', level: 'easy' } }));
    play('e2', 'e4');
    await vi.advanceTimersByTimeAsync(700);
    state().undo();
    expect(state().history).toHaveLength(0);
    expect(state().game.turn()).toBe('w');
  });

  it('undo in local play removes one ply', () => {
    state().startGame(localConfig());
    play('e2', 'e4');
    play('e7', 'e5');
    state().undo();
    expect(state().history).toHaveLength(1);
    expect(state().game.turn()).toBe('b');
  });

  it('engine moves first when the human plays black', async () => {
    state().startGame(localConfig({ white: { type: 'engine', level: 'easy' } }));
    expect(state().flipped).toBe(true);
    await vi.advanceTimersByTimeAsync(700);
    expect(state().history).toHaveLength(1);
  });

  it('requestHint finds the engine best move for the side to move', async () => {
    // A back-rank mate-in-1 position, so the hint is unambiguous.
    state().startGame(localConfig({ fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1' }));
    await state().requestHint();
    expect(state().hint).not.toBeNull();
    expect(state().hint?.move).toMatchObject({ from: 'a1', to: 'a8' });
  });

  it('clears the hint once a move is played', async () => {
    state().startGame(localConfig({ fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1' }));
    await state().requestHint();
    expect(state().hint).not.toBeNull();
    play('a1', 'a8');
    expect(state().hint).toBeNull();
  });

  it('does not offer a hint when it is the computer\'s turn', async () => {
    state().startGame(localConfig({ black: { type: 'engine', level: 'easy' } }));
    play('e2', 'e4'); // now it's the engine's turn
    await state().requestHint();
    expect(state().hint).toBeNull();
  });

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
});
