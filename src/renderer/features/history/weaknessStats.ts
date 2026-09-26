import type { Tier } from '@/engine/classify';
import type { ExplanationTag } from '@/engine/explain';

/** One recorded move, stripped down to just what stats need — no FEN/best-move/text kept around. */
export interface RecordedMove {
  ply: number;
  tier: Tier;
  tags: ExplanationTag[];
}

export interface RecordedGame {
  id: string;
  playedAt: string; // ISO timestamp
  moves: RecordedMove[];
}

export type GamePhase = 'opening' | 'middlegame' | 'endgame';

const OPENING_PLIES = 10;
const MIDDLEGAME_PLIES = 30;

export function phaseOf(ply: number): GamePhase {
  if (ply < OPENING_PLIES) return 'opening';
  if (ply < MIDDLEGAME_PLIES) return 'middlegame';
  return 'endgame';
}

const isMistakeOrWorse = (tier: Tier): boolean => tier === 'mistake' || tier === 'blunder';

/** Every move across every recorded game, flattened. */
function allMoves(games: RecordedGame[]): RecordedMove[] {
  return games.flatMap((g) => g.moves);
}

export function tierCounts(games: RecordedGame[]): Record<Tier, number> {
  const counts: Record<Tier, number> = { brilliant: 0, best: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  for (const move of allMoves(games)) counts[move.tier]++;
  return counts;
}

export interface PhaseStat {
  phase: GamePhase;
  totalMoves: number;
  mistakeCount: number;
  /** mistakeCount / totalMoves, 0 when there are no moves in this phase yet. */
  mistakeRate: number;
}

/** Blunder/mistake rate per phase of the game — the raw material for "you struggle most in the endgame." */
export function phaseBreakdown(games: RecordedGame[]): PhaseStat[] {
  const phases: GamePhase[] = ['opening', 'middlegame', 'endgame'];
  return phases.map((phase) => {
    const moves = allMoves(games).filter((m) => phaseOf(m.ply) === phase);
    const mistakeCount = moves.filter((m) => isMistakeOrWorse(m.tier)).length;
    return {
      phase,
      totalMoves: moves.length,
      mistakeCount,
      mistakeRate: moves.length > 0 ? mistakeCount / moves.length : 0,
    };
  });
}

export interface TagFrequency {
  tag: ExplanationTag;
  count: number;
}

/** How often each explanation tag showed up on a mistake or blunder, most frequent first. */
export function tagFrequency(games: RecordedGame[]): TagFrequency[] {
  const counts = new Map<ExplanationTag, number>();
  for (const move of allMoves(games)) {
    if (!isMistakeOrWorse(move.tier)) continue;
    for (const tag of move.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

const MIN_SAMPLE_SIZE = 5; // don't call out a phase as "your weakness" from one or two moves

/** The single most useful sentence this data can offer, or null if there isn't enough of it yet. */
export function biggestWeakness(games: RecordedGame[]): string | null {
  const phases = phaseBreakdown(games).filter((p) => p.totalMoves >= MIN_SAMPLE_SIZE);
  const tags = tagFrequency(games);
  if (phases.length === 0) return null;

  const worstPhase = phases.reduce((a, b) => (b.mistakeRate > a.mistakeRate ? b : a));
  if (worstPhase.mistakeCount === 0) return null;

  const percent = Math.round(worstPhase.mistakeRate * 100);
  const phaseText = `You struggle most in the ${worstPhase.phase} (${percent}% of moves there are mistakes or worse)`;
  if (tags.length === 0) return `${phaseText}.`;
  return `${phaseText}, most often ${TAG_PHRASE[tags[0].tag] ?? tags[0].tag} (${tags[0].count} times).`;
}

const TAG_PHRASE: Partial<Record<ExplanationTag, string>> = {
  hangsPiece: 'leaving a piece hanging',
  missedMate: 'missing a forced mate',
  walksIntoMate: 'walking into a forced mate',
  ignoresCenter: 'ignoring the center',
  throwsAwayAdvantage: 'throwing away an advantage',
};
