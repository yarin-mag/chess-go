import type { Level, MoveInput } from '@/core/types';
import { findBestMove } from './search';

export interface EngineRequest {
  id: number;
  fen: string;
  level: Level;
}
export interface EngineResponse {
  id: number;
  move?: MoveInput;
  error?: string;
}

// The renderer tsconfig uses the DOM lib, so describe the worker global minimally.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<EngineRequest>) => void) | null;
  postMessage: (msg: EngineResponse) => void;
};

ctx.onmessage = ({ data }) => {
  try {
    ctx.postMessage({ id: data.id, move: findBestMove(data.fen, data.level) });
  } catch (e) {
    ctx.postMessage({ id: data.id, error: e instanceof Error ? e.message : String(e) });
  }
};
