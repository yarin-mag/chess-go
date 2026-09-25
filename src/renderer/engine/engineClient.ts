import type { Level, MoveInput } from '@/core/types';
import type { MoveGrade } from './analyze';
import type { EngineRequest, EngineResponse } from './worker';

interface Pending {
  resolve: (value: MoveInput | MoveGrade) => void;
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
    if (data.error) p.reject(new Error(data.error));
    else if (data.bestMove) p.resolve(data.bestMove);
    else if (data.grade) p.resolve(data.grade);
    else p.reject(new Error('Engine returned an empty response'));
  };
  worker.onerror = () => failAll('Engine worker crashed');
  return worker;
}

// A plain `Omit<EngineRequest, 'id'>` collapses the union to its common properties; distributing
// over each member keeps `level` and `move` intact for their respective request kinds.
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

function send<T extends MoveInput | MoveGrade>(request: WithoutId<EngineRequest>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve: resolve as (v: MoveInput | MoveGrade) => void, reject });
    getWorker().postMessage({ id, ...request } as EngineRequest);
  });
}

/** Asks the background engine for a move. Rejects if the worker fails; callers should fall back. */
export function requestEngineMove(fen: string, level: Level): Promise<MoveInput> {
  return send<MoveInput>({ kind: 'bestMove', fen, level });
}

/** Grades a played move against the engine's best move at that position (used for post-game review). */
export function requestMoveGrade(fen: string, move: MoveInput): Promise<MoveGrade> {
  return send<MoveGrade>({ kind: 'grade', fen, move });
}
