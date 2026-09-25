import type { Level, MoveInput } from '@/core/types';
import { analyzeMove, type MoveGrade } from './analyze';
import { findBestMove } from './search';

export type EngineRequest =
  | { id: number; kind: 'bestMove'; fen: string; level: Level }
  | { id: number; kind: 'grade'; fen: string; move: MoveInput };

export interface EngineResponse {
  id: number;
  bestMove?: MoveInput;
  grade?: MoveGrade;
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
    else ctx.postMessage({ id: data.id, grade: analyzeMove(data.fen, data.move) });
  } catch (e) {
    ctx.postMessage({ id: data.id, error: e instanceof Error ? e.message : String(e) });
  }
};
