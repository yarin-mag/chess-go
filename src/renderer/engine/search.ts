import { Chess, type Move } from 'chess.js';
import type { Level, MoveInput, PieceType, PromotionPiece } from '@/core/types';
import { evaluate, PIECE_VALUE } from './evaluate';
import { LEVELS, type LevelConfig } from './levels';

const MATE = 100_000;
const QUIESCENCE_DEPTH = 4;

class TimeUp extends Error {}

interface ScoredMove {
  move: Move;
  score: number;
}

const toInput = (m: Move): MoveInput => ({
  from: m.from,
  to: m.to,
  promotion: m.promotion as PromotionPiece | undefined,
});

/** Most-valuable-victim / least-valuable-attacker ordering so alpha-beta prunes early. */
function orderScore(m: Move): number {
  let s = 0;
  if (m.captured) s += 10 * PIECE_VALUE[m.captured as PieceType] - PIECE_VALUE[m.piece as PieceType];
  if (m.promotion) s += PIECE_VALUE[m.promotion as PieceType];
  return s;
}

const orderedMoves = (chess: Chess): Move[] =>
  chess.moves({ verbose: true }).sort((a, b) => orderScore(b) - orderScore(a));

class Searcher {
  private deadline = Infinity;

  constructor(
    private readonly chess: Chess,
    private readonly cfg: LevelConfig,
  ) {}

  /** Static score from the side-to-move's perspective. */
  private staticScore(): number {
    return (this.chess.turn() === 'w' ? 1 : -1) * evaluate(this.chess);
  }

  private checkTime(): void {
    if (Date.now() > this.deadline) throw new TimeUp();
  }

  private quiesce(alpha: number, beta: number, depth: number): number {
    this.checkTime();
    const standPat = this.staticScore();
    if (depth === 0 || standPat >= beta) return standPat;
    let best = standPat;
    alpha = Math.max(alpha, standPat);

    for (const m of orderedMoves(this.chess)) {
      if (!m.captured && !m.promotion) continue;
      this.chess.move(m);
      const score = -this.quiesce(-beta, -alpha, depth - 1);
      this.chess.undo();
      if (score > best) best = score;
      if (best >= beta) break;
      alpha = Math.max(alpha, best);
    }
    return best;
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number): number {
    this.checkTime();
    const moves = orderedMoves(this.chess);
    if (moves.length === 0) return this.chess.isCheck() ? -(MATE - ply) : 0;
    if (depth === 0) return this.cfg.quiescence ? this.quiesce(alpha, beta, QUIESCENCE_DEPTH) : this.staticScore();

    let best = -Infinity;
    for (const m of moves) {
      this.chess.move(m);
      const score = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      this.chess.undo();
      if (score > best) best = score;
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }

  /**
   * Scores every root move at a fixed depth (best first). With `exact` every move gets a true score
   * (needed for noise / random picks); otherwise later moves are searched with a narrowed window.
   * Throws TimeUp if the deadline passes mid-iteration.
   */
  private searchRoot(moves: Move[], depth: number, exact: boolean): ScoredMove[] {
    const scored: ScoredMove[] = [];
    let alpha = -Infinity;
    for (const move of moves) {
      this.chess.move(move);
      // Draw-by-rule positions are worth 0, so the engine avoids repetition when ahead.
      const score = this.chess.isDraw() ? 0 : -this.negamax(depth - 1, -Infinity, exact ? Infinity : -alpha, 1);
      this.chess.undo();
      scored.push({ move, score });
      if (!exact) alpha = Math.max(alpha, score);
    }
    return scored.sort((a, b) => b.score - a.score);
  }

  /** Iterative deepening: keeps the result of the deepest fully-completed iteration. */
  search(): ScoredMove[] {
    const exact = this.cfg.randomTopN > 1 || this.cfg.noise > 0;
    const startedAt = Date.now();
    let moves = orderedMoves(this.chess);
    let result: ScoredMove[] = [];

    for (let depth = 1; depth <= this.cfg.depth; depth++) {
      // Depth 1 must always finish so a move exists; deeper iterations must fit the time budget.
      this.deadline = depth === 1 ? Infinity : startedAt + this.cfg.timeMs;
      try {
        result = this.searchRoot(moves, depth, exact);
      } catch (e) {
        if (e instanceof TimeUp) break;
        throw e;
      }
      moves = result.map((r) => r.move); // best-first ordering for the next iteration
      if (Math.abs(result[0].score) > MATE - 100) break; // forced mate found
    }
    return result;
  }
}

/** Picks a move for the position at the given difficulty. Synchronous; run it in a worker. */
export function findBestMove(fen: string, level: Level): MoveInput {
  const cfg = LEVELS[level];
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) throw new Error('No legal moves');
  if (legal.length === 1) return toInput(legal[0]);

  const scored = new Searcher(chess, cfg).search();

  if (cfg.noise > 0) {
    for (const s of scored) s.score += (Math.random() * 2 - 1) * cfg.noise;
    scored.sort((a, b) => b.score - a.score);
  }
  if (cfg.randomTopN > 1 && Math.random() < cfg.randomChance) {
    const pool = scored.slice(0, cfg.randomTopN);
    return toInput(pool[Math.floor(Math.random() * pool.length)].move);
  }
  return toInput(scored[0].move);
}
