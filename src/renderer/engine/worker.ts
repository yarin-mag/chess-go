import type { Level, MoveInput } from '@/core/types';
import { analyzeMove, findBestMoveForPosition, type BestMoveResult, type MoveGrade } from './analyze';
import { findBestMove } from './search';

export type EngineRequest =
  | { id: number; kind: 'bestMove'; fen: string; level: Level }
  | { id: number; kind: 'grade'; fen: string; move: MoveInput }
  | { id: number; kind: 'hint'; fen: string };

export interface EngineResponse {
  id: number;
  bestMove?: MoveInput;
  grade?: MoveGrade;
  hint?: BestMoveResult;
  error?: string;
}

// The renderer tsconfig uses the DOM lib, so describe the worker global minimally.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<EngineRequest>) => void) | null;
  postMessage: (msg: EngineResponse) => void;
};

ctx.onmessage = ({ data }) => {
  try {
    if (data.kind === 'bestMove') ctx.postMessage({ id: data.id, bestMove: findBestMove(data.fen, data.level) });
    else if (data.kind === 'grade') ctx.postMessage({ id: data.id, grade: analyzeMove(data.fen, data.move) });
    else ctx.postMessage({ id: data.id, hint: findBestMoveForPosition(data.fen) });
  } catch (e) {
    ctx.postMessage({ id: data.id, error: e instanceof Error ? e.message : String(e) });
  }
};
