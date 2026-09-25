import openings from '@/assets/openings.json';

export interface Opening {
  eco: string;
  name: string;
}

const BOOK = openings as Record<string, Opening>;

/** Longest-prefix match: tries the full sequence, then drops moves off the end until one is known. */
export function lookupOpening(uciSequence: string[]): Opening | null {
  for (let len = uciSequence.length; len > 0; len--) {
    const key = uciSequence.slice(0, len).join(' ');
    if (BOOK[key]) return BOOK[key];
  }
  return null;
}
