import { ChessGame } from './chessGame';
import type { MoveInput, MoveRecord } from './types';

/** Replays a sequence of moves from `startFen` (or the standard start position), returning each ply's record. */
export function replayMoves(startFen: string | undefined, moves: MoveInput[]): MoveRecord[] {
  const game = new ChessGame(startFen);
  const history: MoveRecord[] = [];
  for (const move of moves) {
    const record = game.move(move);
    if (!record) break; // an illegal move ends the replay early rather than throwing
    history.push(record);
  }
  return history;
}

/** Replays a sequence of UCI moves ("e2e4", "e7e8q", ...). See `replayMoves`. */
export function replayUci(startFen: string | undefined, uciMoves: string[]): MoveRecord[] {
  return replayMoves(
    startFen,
    uciMoves.map((uci) => ({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? (uci[4] as MoveInput['promotion']) : undefined,
    })),
  );
}
