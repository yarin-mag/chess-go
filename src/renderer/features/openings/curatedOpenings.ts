import openingsRaw from '@/assets/openings.json';

export interface CuratedOpening {
  name: string;
  eco: string;
  /** UCI moves defining this opening (its shortest known-book sequence). */
  sequence: string[];
}

interface OpeningEntry {
  eco: string;
  name: string;
}

/**
 * Well-known openings worth a beginner's attention, picked by name out of the ~3800 entries in the
 * bundled ECO dataset (most of which are narrow sub-variations, not openings on their own). Each name
 * here must match a base opening name (no ": Variation" suffix) in openings.json.
 */
const CURATED_NAMES = [
  'Italian Game',
  'Ruy Lopez',
  'Sicilian Defense',
  'French Defense',
  'Caro-Kann Defense',
  "Queen's Gambit",
  "King's Indian Defense",
  'English Opening',
  'Scotch Game',
  'Vienna Game',
  'London System',
  'Scandinavian Defense',
  'Pirc Defense',
  'Alekhine Defense',
  'Nimzo-Indian Defense',
  'Grünfeld Defense',
  'Dutch Defense',
  "King's Gambit",
  "Petrov's Defense",
  'Four Knights Game',
  'Philidor Defense',
  'Catalan Opening',
  'Slav Defense',
  'Modern Defense',
  "Bishop's Opening",
  'Center Game',
  'Danish Gambit',
];

function findShortestSequencePerName(): Map<string, CuratedOpening> {
  const byName = new Map<string, CuratedOpening>();
  for (const [sequence, entry] of Object.entries(openingsRaw as Record<string, OpeningEntry>)) {
    if (entry.name.includes(':')) continue; // a sub-variation, not a base opening
    const moves = sequence.split(' ');
    const existing = byName.get(entry.name);
    if (!existing || moves.length < existing.sequence.length) {
      byName.set(entry.name, { name: entry.name, eco: entry.eco, sequence: moves });
    }
  }
  return byName;
}

/** The curated openings, in the order listed above, each resolved to its real (shortest) book sequence. */
export const CURATED_OPENINGS: CuratedOpening[] = (() => {
  const byName = findShortestSequencePerName();
  return CURATED_NAMES.map((name) => byName.get(name)).filter((o): o is CuratedOpening => o !== undefined);
})();
