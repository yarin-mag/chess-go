// src/renderer/features/glossary/glossaryTerms.ts
/** Each entry has a `term_<key>`/`def_<key>` pair in glossary.json, all three locales. */
export const GLOSSARY_KEYS = [
  'enPassant', 'castlingKingside', 'castlingQueenside', 'check', 'checkmate', 'stalemate',
  'fork', 'pin', 'skewer', 'discoveredAttack', 'doubleAttack', 'zugzwang', 'zwischenzug',
  'fianchetto', 'outpost', 'isolatedPawn', 'passedPawn', 'doubledPawns', 'backRankMate',
  'perpetualCheck', 'opposition', 'tempo', 'development', 'material', 'centipawn',
  'overloadedPiece', 'smotheredMate', 'enPrise', 'tactic', 'sacrifice',
] as const;
export type GlossaryKey = (typeof GLOSSARY_KEYS)[number];
