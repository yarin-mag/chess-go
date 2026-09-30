import { t } from '@/i18n';
import { phaseBreakdown, tagFrequency, tierCounts, TAG_PHRASE_KEY, type RecordedGame } from '@/features/history/weaknessStats';
import type { MoveAnalysis } from './analyzeGame';

// A phase needs at least this many moves *in this one game* before the summary comments on it — lower
// than weaknessStats' cross-game MIN_SAMPLE_SIZE (5) since a single game's opening/middlegame/endgame
// split is naturally smaller than an aggregate across many games.
const MIN_PHASE_SAMPLE = 3;

function asRecordedGame(analysis: Pick<MoveAnalysis, 'ply' | 'tier' | 'tags'>[]): RecordedGame {
  return { id: 'current', playedAt: '', moves: analysis.map((a) => ({ ply: a.ply, tier: a.tier, tags: a.tags })) };
}

/**
 * A short natural-language recap of one game's review, built from the same phase/tag machinery My Stats
 * already uses (`phaseBreakdown`/`tagFrequency`/`tierCounts`) — scoped to this one game instead of the
 * whole play history.
 */
export function summarizeGame(analysis: Pick<MoveAnalysis, 'ply' | 'tier' | 'tags'>[]): string[] {
  if (analysis.length === 0) return [];

  const game = asRecordedGame(analysis);
  const tiers = tierCounts([game]);
  const phases = phaseBreakdown([game]).filter((p) => p.totalMoves >= MIN_PHASE_SAMPLE);
  const tags = tagFrequency([game]);
  const roughPhases = phases.filter((p) => p.mistakeCount > 0).sort((a, b) => b.mistakeRate - a.mistakeRate);

  const sentences: string[] = [];
  // Gated on the real tier counts, not on `roughPhases` — a phase bucket below MIN_PHASE_SAMPLE can hide
  // a real blunder/mistake (e.g. the game's only mistake is its very last move, in a 1-move endgame
  // bucket), and "Clean game" must never be shown while a real mistake sits in the move list above it.
  const hasMistakes = tiers.mistake + tiers.blunder > 0;

  if (!hasMistakes) {
    sentences.push(t('stats:summaryClean'));
  } else if (roughPhases.length === 1) {
    sentences.push(t('stats:summaryOneRoughPhase', { phase: t(`stats:phase_${roughPhases[0].phase}`) }));
  } else if (roughPhases.length > 1) {
    const phaseNames = roughPhases.map((p) => t(`stats:phase_${p.phase}`)).join(' · ');
    sentences.push(t('stats:summaryMultipleRoughPhases', { phases: phaseNames }));
  }
  // else: real mistakes exist but none cleared a phase's sample threshold — no phase-specific sentence,
  // but the top-mistake sentence below still fires.

  if (hasMistakes && tags.length > 0) {
    const tagKey = TAG_PHRASE_KEY[tags[0].tag];
    if (tagKey) sentences.push(t('stats:summaryTopMistake', { tagPhrase: t(`stats:${tagKey}`) }));
  }

  if (tiers.brilliant > 0) sentences.push(t('stats:summaryHadBrilliancy'));

  return sentences;
}
