import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isOnlineGame, useGameStore, type GameConfig } from './gameStore';
import { UNTIMED } from '@/features/clock/presets';
import { useSavedGamesStore } from '@/features/history/savedGamesStore';
import { enqueueBackgroundAnalysis } from '@/features/vault/backgroundAnalysisQueue';
import { enqueueOfflineResult } from '@/features/sync/offlineQueueStore';
import { useAuthStore } from '@/features/auth/authStore';

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

vi.mock('@/features/vault/backgroundAnalysisQueue', () => ({
  enqueueBackgroundAnalysis: vi.fn(),
  abortBackgroundAnalysis: vi.fn(),
}));

vi.mock('@/features/sync/offlineQueueStore', () => ({ enqueueOfflineResult: vi.fn() }));

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
    useAuthStore.setState({ status: 'signedOut', accountId: null, clerkUserId: null, hasEverAuthenticated: false });
    vi.mocked(enqueueOfflineResult).mockClear();
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

  it('enqueues an offline-sync record for the finished game when signed in', () => {
    useAuthStore.setState({ status: 'signedIn', accountId: 'acct-1', clerkUserId: 'u1', hasEverAuthenticated: true });
    state().startGame(localConfig());
    play('f2', 'f3');
    play('e7', 'e5');
    play('g2', 'g4');
    play('d8', 'h4'); // checkmate
    expect(enqueueOfflineResult).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'vsComputer' }),
    );
  });

  it('does not enqueue anything when signed out', () => {
    useAuthStore.setState({ status: 'signedOut', accountId: null, clerkUserId: null, hasEverAuthenticated: false });
    state().startGame(localConfig());
    play('f2', 'f3');
    play('e7', 'e5');
    play('g2', 'g4');
    play('d8', 'h4');
    expect(enqueueOfflineResult).not.toHaveBeenCalled();
  });

  it('enqueues background analysis keyed to the real saved-game id, restricted to the humans who played', () => {
    state().startGame(localConfig()); // local human-vs-human — both colors are "the player"
    play('f2', 'f3');
    play('e7', 'e5');
    play('g2', 'g4');
    play('d8', 'h4'); // checkmate
    const savedId = useSavedGamesStore.getState().games[0].id;
    expect(enqueueBackgroundAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ sourceGameId: savedId, humanColors: ['w', 'b'] }),
    );
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

  it('flips the board when the local online player is black', () => {
    // White is the remote side here, and it's White's turn at game start, so startGame immediately asks
    // this controller for a move — it must return a promise (a never-resolving one is fine for this test).
    const remotePlayer = { kind: 'remote' as const, requestMove: vi.fn(() => new Promise<never>(() => {})) };
    state().startGame({
      white: { type: 'remote' },
      black: { type: 'human' },
      timeControl: UNTIMED,
      remote: { color: 'w', player: remotePlayer }, // remote is white → the local human is black
    });
    expect(state().flipped).toBe(true);
  });

  it('handleDisconnect ends the game with the given winner, if still playing', () => {
    state().startGame(localConfig());
    state().handleDisconnect('w');
    expect(state().status).toBe('over');
    expect(state().result).toEqual({ kind: 'disconnected', winner: 'w' });
  });

  it('handleDisconnect does nothing once the game has already ended', () => {
    state().startGame(localConfig());
    state().resign('w');
    state().handleDisconnect('b');
    expect(state().result).toEqual({ kind: 'resign', winner: 'b' });
  });

  it('isOnlineGame is true when either seat is remote, false otherwise', () => {
    expect(isOnlineGame({ w: { kind: 'human' } as never, b: { kind: 'remote' } as never })).toBe(true);
    expect(isOnlineGame({ w: { kind: 'remote' } as never, b: { kind: 'human' } as never })).toBe(true);
    expect(isOnlineGame({ w: { kind: 'human' } as never, b: { kind: 'human' } as never })).toBe(false);
    expect(isOnlineGame({ w: { kind: 'engine' } as never, b: { kind: 'human' } as never })).toBe(false);
  });

  it("presses the clock using the remote move's own timestamp, not the receiver's Date.now()", async () => {
    const turnStart = 1_000_000;
    vi.setSystemTime(turnStart);
    let resolveMove!: (move: { from: string; to: string }) => void;
    const remotePlayer = {
      kind: 'remote' as const,
      lastAt: turnStart + 3_000, // the mover took 3s
      requestMove: vi.fn(() => new Promise<{ from: string; to: string }>((resolve) => (resolveMove = resolve))),
    };
    state().startGame({
      white: { type: 'remote' },
      black: { type: 'human' },
      timeControl: { name: 'Test', minutes: 5, incrementSec: 0 },
      remote: { color: 'w', player: remotePlayer },
    });
    // Advance real (fake) system time to when the message actually arrives, simulating that those 3s
    // really passed for both peers — otherwise the receiver's own Date.now() would still read turnStart
    // and clamp the claimed elapsed time back down to 0, which is correct in that case (next test) but
    // not what this test is checking.
    vi.setSystemTime(turnStart + 3_000);
    resolveMove({ from: 'e2', to: 'e4' });
    await vi.advanceTimersByTimeAsync(0);
    expect(state().clock.remaining('w', turnStart)).toBe(5 * 60_000 - 3_000);
  });

  it("clamps a remote timestamp that precedes the turn's own start, so a skewed/malicious peer can't gain time", async () => {
    const turnStart = 1_000_000;
    vi.setSystemTime(turnStart);
    const remotePlayer = {
      kind: 'remote' as const,
      lastAt: turnStart - 10_000, // claims to have moved before their own clock even started
      requestMove: vi.fn(async () => ({ from: 'e2', to: 'e4' })),
    };
    state().startGame({
      white: { type: 'remote' },
      black: { type: 'human' },
      timeControl: { name: 'Test', minutes: 5, incrementSec: 0 },
      remote: { color: 'w', player: remotePlayer },
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(state().clock.remaining('w', turnStart)).toBe(5 * 60_000);
  });

  it('does not flip the board when the local online player is white', () => {
    const remotePlayer = { kind: 'remote' as const, requestMove: vi.fn() };
    state().startGame({
      white: { type: 'human' },
      black: { type: 'remote' },
      timeControl: UNTIMED,
      remote: { color: 'b', player: remotePlayer }, // remote is black → the local human is white
    });
    expect(state().flipped).toBe(false);
  });
});
