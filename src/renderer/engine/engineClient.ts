import type { Level, MoveInput } from '@/core/types';
import type { EngineRequest, EngineResponse } from './worker';

interface Pending {
  resolve: (m: MoveInput) => void;
  reject: (e: Error) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function failAll(reason: string): void {
  for (const p of pending.values()) p.reject(new Error(reason));
  pending.clear();
  worker?.terminate();
  worker = null; // recreated lazily on the next request
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<EngineResponse>) => {
    const p = pending.get(data.id);
    if (!p) return;
    pending.delete(data.id);
    if (data.move) p.resolve(data.move);
    else p.reject(new Error(data.error ?? 'Engine returned no move'));
  };
  worker.onerror = () => failAll('Engine worker crashed');
  return worker;
}

/** Asks the background engine for a move. Rejects if the worker fails; callers should fall back. */
export function requestEngineMove(fen: string, level: Level): Promise<MoveInput> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    const req: EngineRequest = { id, fen, level };
    getWorker().postMessage(req);
  });
}
