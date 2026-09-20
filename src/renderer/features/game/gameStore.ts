import { create } from 'zustand';
import { ChessGame } from '@/core/chessGame';
import {
  opposite,
  type Color,
  type GameResult,
  type MoveInput,
  type MoveRecord,
  type PlayerKind,
  type PromotionPiece,
  type Square,
  type TimeControl,
} from '@/core/types';
import { Clock } from '@/features/clock/clock';
import { UNTIMED, toClock } from '@/features/clock/presets';
import { createPlayer, type PlayerController } from './players';

export interface GameConfig {
  white: PlayerKind;
  black: PlayerKind;
  timeControl: TimeControl;
  /** Optional start position (used by tests and future "set up position"). */
  fen?: string;
}

export interface GameState {
  status: 'menu' | 'playing' | 'over';
  config: GameConfig;
  /** Mutable rules objects; re-render is driven by `fen` / `history` changing. */
  game: ChessGame;
  clock: Clock;
  players: Record<Color, PlayerController>;
  gameId: number;

  fen: string;
  history: MoveRecord[];
  lastMove: MoveInput | null;
  result: GameResult | null;
  engineThinking: boolean;
  flipped: boolean;

  selected: Square | null;
  targets: Square[];
  pendingPromotion: { from: Square; to: Square } | null;

  startGame(config: GameConfig): void;
  select(sq: Square): void;
  choosePromotion(piece: PromotionPiece): void;
  cancelPromotion(): void;
  playMove(move: MoveInput, now?: number): boolean;
  undo(now?: number): void;
  resign(color: Color): void;
  agreeDraw(): void;
  tickClock(now: number): void;
  setFlipped(flipped: boolean): void;
  backToMenu(): void;
}

const HUMAN: PlayerKind = { type: 'human' };
const DEFAULT_CONFIG: GameConfig = { white: HUMAN, black: HUMAN, timeControl: UNTIMED };

// Only one engine request is ever in flight; a new game / undo / game end aborts it.
let engineAbort: AbortController | null = null;
const abortEngine = () => {
  engineAbort?.abort();
  engineAbort = null;
};

const noSelection: Pick<GameState, 'selected' | 'targets' | 'pendingPromotion'> = {
  selected: null,
  targets: [],
  pendingPromotion: null,
};

export const useGameStore = create<GameState>((set, get) => {
  /** Ends the game with `result`, freezing the clock and cancelling engine work. */
  const finish = (result: GameResult, now: number) => {
    abortEngine();
    get().clock.stop(now);
    set({ status: 'over', result, engineThinking: false, ...noSelection });
  };

  /** If the side to move is not human, ask its controller for a move and play it. */
  const requestNextMove = () => {
    const { status, game, players, gameId, fen } = get();
    if (status !== 'playing') return;
    const player = players[game.turn()];
    if (player.kind === 'human') return;

    abortEngine();
    const controller = new AbortController();
    engineAbort = controller;
    set({ engineThinking: true });

    player
      .requestMove(fen, controller.signal)
      .then((move) => {
        if (controller.signal.aborted || get().gameId !== gameId) return;
        set({ engineThinking: false });
        get().playMove(move);
      })
      .catch(() => {
        // Aborted (new game / undo / game over) — nothing to do.
      });
  };

  return {
    status: 'menu',
    config: DEFAULT_CONFIG,
    game: new ChessGame(),
    clock: toClock(UNTIMED),
    players: { w: createPlayer(HUMAN), b: createPlayer(HUMAN) },
    gameId: 0,

    fen: new ChessGame().fen(),
    history: [],
    lastMove: null,
    result: null,
    engineThinking: false,
    flipped: false,

    ...noSelection,

    startGame(config) {
      abortEngine();
      const game = new ChessGame(config.fen);
      const clock = toClock(config.timeControl);
      clock.start(game.turn(), Date.now());
      set({
        status: 'playing',
        config,
        game,
        clock,
        players: { w: createPlayer(config.white), b: createPlayer(config.black) },
        gameId: get().gameId + 1,
        fen: game.fen(),
        history: [],
        lastMove: null,
        result: null,
        engineThinking: false,
        // Show the board from the human's side when they play Black against the computer.
        flipped: config.white.type === 'engine' && config.black.type === 'human',
        ...noSelection,
      });
      requestNextMove();
    },

    select(sq) {
      const { status, game, players, selected, targets, pendingPromotion } = get();
      if (status !== 'playing' || pendingPromotion) return;
      if (players[game.turn()].kind !== 'human') return;

      if (selected && targets.includes(sq)) {
        if (game.isPromotion(selected, sq)) set({ pendingPromotion: { from: selected, to: sq } });
        else get().playMove({ from: selected, to: sq });
        return;
      }

      const piece = game.pieceAt(sq);
      if (piece?.color === game.turn() && sq !== selected) {
        set({ selected: sq, targets: game.legalMovesFrom(sq) });
      } else {
        set({ selected: null, targets: [] });
      }
    },

    choosePromotion(piece) {
      const { pendingPromotion } = get();
      if (pendingPromotion) get().playMove({ ...pendingPromotion, promotion: piece });
    },

    cancelPromotion() {
      set({ ...noSelection });
    },

    playMove(move, now = Date.now()) {
      const { status, game, clock } = get();
      if (status !== 'playing') return false;
      const record = game.move(move);
      if (!record) return false;

      set({
        fen: game.fen(),
        history: [...get().history, record],
        lastMove: { from: record.from, to: record.to },
        ...noSelection,
      });

      const result = game.result();
      if (result) {
        finish(result, now);
      } else {
        clock.press(game.turn(), now);
        requestNextMove();
      }
      return true;
    },

    undo(now = Date.now()) {
      const { status, game, players, clock } = get();
      if (status !== 'playing' || game.history().length === 0) return;
      abortEngine();

      game.undo();
      // Against the computer, also take back the engine's reply so it is the human's turn again.
      if (players[game.turn()].kind !== 'human' && game.history().length > 0) game.undo();

      const history = game.history();
      const last = history[history.length - 1];
      clock.stop(now); // taking a move back never refunds time
      clock.start(game.turn(), now);
      set({
        fen: game.fen(),
        history,
        lastMove: last ? { from: last.from, to: last.to } : null,
        engineThinking: false,
        ...noSelection,
      });
      requestNextMove();
    },

    resign(color) {
      if (get().status === 'playing') finish({ kind: 'resign', winner: opposite(color) }, Date.now());
    },

    agreeDraw() {
      if (get().status === 'playing') finish({ kind: 'draw', reason: 'agreement' }, Date.now());
    },

    tickClock(now) {
      const { status, clock } = get();
      if (status !== 'playing') return;
      const flagged = clock.flagged(now);
      if (flagged) finish({ kind: 'timeout', winner: opposite(flagged) }, now);
    },

    setFlipped(flipped) {
      set({ flipped });
    },

    backToMenu() {
      abortEngine();
      set({ status: 'menu', engineThinking: false, ...noSelection });
    },
  };
});
