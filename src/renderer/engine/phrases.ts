import type { ExplanationTag } from './explain';
import type { Tier } from './classify';

type PhraseKey = `${ExplanationTag}:${Tier}` | ExplanationTag;

const PHRASES: Partial<Record<PhraseKey, string[]>> = {
  hangsPiece: ['{san} leaves a piece hanging — your opponent can just take it for free.'],
  missedMate: ['{san} misses a forced checkmate that was on the board.'],
  walksIntoMate: ['{san} allows a forced checkmate against you.'],
  goodTrade: ['{san} is a fair trade — the material given up is matched by what you win back.'],
  developsPiece: ['{san} brings a new piece into the game — good development.'],
  ignoresCenter: ["{san} doesn't fight for the center; central pawns and pieces control more of the board."],
  keepsAdvantage: ['{san} keeps hold of your advantage.'],
  throwsAwayAdvantage: ['{san} throws away an advantage you had.'],
  solid: ['{san} is a perfectly reasonable move.'],
  'solid:best': ['{san} is exactly what the engine would play here.'],
  'solid:brilliant': ['{san} is a brilliant sacrifice the engine confirms is sound.'],
};

/**
 * Longer, one-paragraph version of each tag — the "why", not just the "what". Shown on demand (behind an
 * expand control / modal) rather than inline, since these run several sentences.
 */
const REASONS: Partial<Record<PhraseKey, string[]>> = {
  hangsPiece: [
    "{san} leaves a piece on a square the opponent can capture for less than it's worth, or for free. Before moving, check whether the piece's new square (or a square it stops defending) is attacked by an enemy piece — and count the defenders as carefully as the attackers, since a piece is only truly hanging if it's attacked more times than it's defended by pieces of equal or lesser value.",
  ],
  missedMate: [
    "{san} was played instead of a forced sequence that would have delivered checkmate right away. When the opponent's king is short on escape squares, it's worth spending a few extra seconds checking every check and capture for a forced mating line before settling for a merely good move.",
  ],
  walksIntoMate: [
    "{san} allows the opponent to force checkmate no matter how you respond afterward. Whenever your own king has few escape squares, double-check every one of the opponent's checks and captures before committing to a move — a single overlooked line is enough to lose the game on the spot.",
  ],
  goodTrade: [
    "{san} trades pieces of roughly equal value. Trading is a tool for simplifying the position — it helps most when you're already ahead in material (fewer pieces on the board makes a lead harder to fight back from) or when it removes your opponent's most active piece.",
  ],
  developsPiece: [
    '{san} brings a piece out from its starting square toward the center, where it influences more squares and joins the game faster. In the opening, aim to develop a new piece each move rather than moving the same one twice, and get your king castled to safety before starting anything sharp.',
  ],
  ignoresCenter: [
    "{san} doesn't contest the central squares (d4, d5, e4, e5). Pieces posted in or aimed at the center control more of the board than pieces on the edge, which makes it easier to shift the fight to either wing later. Try meeting a central pawn push with one of your own, or developing a piece toward the center instead.",
  ],
  keepsAdvantage: [
    "{san} holds on to the edge you already had — the position afterward is still evaluated in your favor by roughly the same margin. Converting an advantage is often about patience: avoid unnecessary risks, keep improving your worst-placed piece, and let the opponent run out of good options.",
  ],
  throwsAwayAdvantage: [
    '{san} gives back some or all of an advantage you had built up — usually from an unnecessary trade, a rushed attack, or missing the opponent\'s best reply. Take an extra moment before playing a move that "feels" active to check what it actually allows.',
  ],
  solid: [
    "{san} is a safe, reasonable move here — it doesn't hang material or give anything away. Not every move needs to be the single best option an engine finds; consistently avoiding mistakes is what wins most games below the very top level.",
  ],
  'solid:best': [
    "{san} is the move the engine itself would play — the top-ranked choice out of every legal option in this position. That doesn't mean it's the only good move, just the one that gives away the least (or wins the most).",
  ],
  'solid:brilliant': [
    "{san} is a sacrifice the engine confirms is objectively sound — material was given up on purpose, but the resulting position is at least as good thanks to a follow-up (a mating attack, winning back more material, or a dominant position) that outweighs what was given.",
  ],
};

/** Deterministic per-move pick among a tag's templates, so revisiting a move keeps the same wording. */
function pick(map: Partial<Record<PhraseKey, string[]>>, tag: ExplanationTag, tier: Tier, san: string, seed: number): string {
  const templates = map[`${tag}:${tier}` as PhraseKey] ?? map[tag] ?? map.solid!;
  const template = templates[((seed % templates.length) + templates.length) % templates.length];
  return template.replace('{san}', san);
}

export function phraseFor(tag: ExplanationTag, tier: Tier, san: string, seed: number): string {
  return pick(PHRASES, tag, tier, san, seed);
}

/** The longer "why" behind a tag — same move/tag/seed as {@link phraseFor} always returns matching text. */
export function reasonFor(tag: ExplanationTag, tier: Tier, san: string, seed: number): string {
  return pick(REASONS, tag, tier, san, seed);
}
