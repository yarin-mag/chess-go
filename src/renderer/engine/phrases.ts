import { t } from '@/i18n';
import type { ExplanationTag } from './explain';
import type { Tier } from './classify';

// i18next keys don't colon-nest the way the old `${tag}:${tier}` template type did — tier-qualified
// entries use an underscore suffix instead (see tutor.json's phrase_solid_best/phrase_solid_brilliant).
function keyFor(prefix: 'phrase' | 'reason', tag: ExplanationTag, tier: Tier): string {
  const qualified = `tutor:${prefix}_${tag}_${tier}`;
  return t(qualified, { defaultValue: '' }) ? qualified : `tutor:${prefix}_${tag}`;
}

/** Deterministic per-move pick — kept for API compatibility, though every tag now has exactly one template. */
function pick(prefix: 'phrase' | 'reason', tag: ExplanationTag, tier: Tier, san: string, _seed: number): string {
  return t(keyFor(prefix, tag, tier), { san });
}

export function phraseFor(tag: ExplanationTag, tier: Tier, san: string, seed: number): string {
  return pick('phrase', tag, tier, san, seed);
}

/** The longer "why" behind a tag — same move/tag/seed as {@link phraseFor} always returns matching text. */
export function reasonFor(tag: ExplanationTag, tier: Tier, san: string, seed: number): string {
  return pick('reason', tag, tier, san, seed);
}
