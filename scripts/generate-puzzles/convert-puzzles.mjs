import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';

const [, , srcPath, outPath] = process.argv;
const candidates = JSON.parse(readFileSync(srcPath, 'utf-8'));

const puzzles = [];
let rejected = 0;

for (const c of candidates) {
  try {
    const chess = new Chess(c.fen);
    const [setupMove, ...solution] = c.moves;
    // The first move is the opponent's setup move (already played in the real game); apply it so the
    // stored FEN is the actual position the puzzle-solver sees.
    const setup = chess.move({ from: setupMove.slice(0, 2), to: setupMove.slice(2, 4), promotion: setupMove[4] });
    if (!setup) throw new Error('illegal setup move');

    // Validate the whole solution replays legally from here (catches any data/format surprises).
    const replay = new Chess(chess.fen());
    for (const uci of solution) {
      const m = replay.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      if (!m) throw new Error(`illegal solution move ${uci}`);
    }

    puzzles.push({
      id: c.id,
      fen: chess.fen(),
      solution,
      rating: c.rating,
      stage: c.stage,
      themes: c.themes,
    });
  } catch (e) {
    rejected++;
  }
}

puzzles.sort((a, b) => a.stage - b.stage || a.rating - b.rating);

console.error(`kept ${puzzles.length}, rejected ${rejected}`);
writeFileSync(outPath, JSON.stringify(puzzles));
