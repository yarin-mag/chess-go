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

/** Deterministic per-move pick among a tag's templates, so revisiting a move keeps the same wording. */
export function phraseFor(tag: ExplanationTag, tier: Tier, san: string, seed: number): string {
  const templates = PHRASES[`${tag}:${tier}` as PhraseKey] ?? PHRASES[tag] ?? PHRASES.solid!;
  const template = templates[((seed % templates.length) + templates.length) % templates.length];
  return template.replace('{san}', san);
}
