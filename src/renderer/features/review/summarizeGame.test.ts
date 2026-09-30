import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { summarizeGame } from './summarizeGame';
import type { MoveAnalysis } from './analyzeGame';
import type { Tier } from '@/engine/classify';
import type { ExplanationTag } from '@/engine/explain';

afterEach(async () => {
  if (i18n.language !== 'en') await i18n.changeLanguage('en');
});

type Fixture = Pick<MoveAnalysis, 'ply' | 'tier' | 'tags'>;
const move = (ply: number, tier: Tier, tags: ExplanationTag[] = []): Fixture => ({ ply, tier, tags });

describe('summarizeGame', () => {
  it('returns nothing for an empty analysis', () => {
    expect(summarizeGame([])).toEqual([]);
  });

  it('names a clean game when nothing rises above good', () => {
    const analysis = [move(0, 'good'), move(1, 'best'), move(2, 'good')];
    expect(summarizeGame(analysis)).toEqual(['Clean game — no real mistakes to point out.']);
  });

  it('names the single roughest phase when only one clears the sample threshold', () => {
    // 5 opening-phase moves (ply < 10), 3 of them mistakes/blunders; nothing else.
    const analysis = [
      move(0, 'blunder', ['hangsPiece']),
      move(1, 'mistake', ['hangsPiece']),
      move(2, 'mistake'),
      move(3, 'good'),
      move(4, 'good'),
    ];
    const summary = summarizeGame(analysis);
    // stats:phase_opening is capitalized ("Opening"), same established convention as the rest of the
    // i18n content (see weaknessStats.test.ts's own locale-switch test).
    expect(summary[0]).toBe('Your roughest patch was the Opening phase.');
  });

  it('names multiple rough phases, joined with · , when more than one clears the threshold', () => {
    const analysis = [
      move(0, 'blunder'), move(1, 'mistake'), move(2, 'blunder'), // opening: 3 mistakes/blunders
      move(30, 'blunder'), move(31, 'mistake'), move(32, 'blunder'), // endgame: 3 mistakes/blunders
    ];
    const summary = summarizeGame(analysis);
    expect(summary[0]).toBe('You had trouble in a few phases: Opening · Endgame.');
  });

  it('adds a top-mistake sentence naming the most frequent tag among the mistakes', () => {
    const analysis = [
      move(0, 'blunder', ['hangsPiece']),
      move(1, 'mistake', ['hangsPiece']),
      move(2, 'mistake', ['hangsPiece']),
    ];
    const summary = summarizeGame(analysis);
    expect(summary).toContain('Most often it came down to leaving a piece hanging.');
  });

  it('adds a brilliancy callout when at least one brilliant move exists, alongside a rough-phase note', () => {
    const analysis = [
      move(0, 'blunder'), move(1, 'mistake'), move(2, 'blunder'),
      move(10, 'brilliant'),
    ];
    const summary = summarizeGame(analysis);
    expect(summary).toContain('You also found at least one brilliant move — nice work.');
  });

  it('applies correct Spanish grammatical agreement for the single-rough-phase sentence', async () => {
    await i18n.changeLanguage('es');
    const analysis = [move(0, 'blunder'), move(1, 'mistake'), move(2, 'blunder'), move(3, 'good'), move(4, 'good')];
    expect(summarizeGame(analysis)[0]).toBe('Tu momento más flojo fue en la fase de Apertura.');
  });
});
