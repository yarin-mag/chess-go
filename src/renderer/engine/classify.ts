export type Tier = 'brilliant' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/**
 * Grades a played move by how many centipawns it lost compared to the engine's best move.
 * `sacrificedMaterial` marks a best move that gives up material outright (a real sacrifice) as 'brilliant'.
 */
export function classify(centipawnLoss: number, isBestMove: boolean, sacrificedMaterial: boolean): Tier {
  if (isBestMove) return sacrificedMaterial ? 'brilliant' : 'best';
  if (centipawnLoss < 50) return 'good';
  if (centipawnLoss < 100) return 'inaccuracy';
  if (centipawnLoss < 300) return 'mistake';
  return 'blunder';
}
