import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Color, MoveInput } from '@/core/types';
import type { Tier } from '@/engine/classify';
import type { ExplanationTag } from '@/engine/explain';
import type { MoveAnalysis } from '@/features/review/analyzeGame';
import type { GameConfig } from '@/features/game/gameStore';

// Full saved games (fenBefore-replayable) run to MAX_SAVED_GAMES=100 in savedGamesStore; a vault entry is
// much smaller per-record, but still capped so localStorage never grows unbounded across months of play.
export const MAX_VAULT_ENTRIES = 60;

export interface VaultEntry {
  id: string;
  sourceGameId: string;
  ply: number;
  fenBefore: string;
  bestMove: MoveInput;
  bestSan: string;
  playedSan: string;
  tier: Tier;
  tags: ExplanationTag[];
  capturedAt: string; // ISO timestamp
}

interface BlunderVaultState {
  entries: VaultEntry[];
  solvedIds: string[];
  hasBackfilled: boolean;
  addEntries(entries: VaultEntry[]): void;
  markSolved(id: string): void;
  /** An unsolved entry if one exists, otherwise any entry, otherwise null (vault empty). */
  pickNext(): VaultEntry | null;
  /** Records that the one-time backfill (see backfillVault.ts) has run, so it's never attempted again —
   *  even if it found nothing to add (an empty vault after backfill must not look "not yet backfilled"). */
  markBackfilled(): void;
  clear(): void;
}

/** Which color(s) the human player controlled — a computer's or a remote opponent's own blunders never
 *  belong in "the player's own mistakes". Local human-vs-human keeps both sides. */
export function humanColorsOf(config: Pick<GameConfig, 'white' | 'black' | 'remote'>): Color[] {
  if (config.remote) return [config.remote.color];
  const colors: Color[] = [];
  if (config.white.type === 'human') colors.push('w');
  if (config.black.type === 'human') colors.push('b');
  return colors;
}

type ExtractableMove = Pick<MoveAnalysis, 'ply' | 'fenBefore' | 'bestMove' | 'bestSan' | 'move' | 'tier' | 'tags'>;

/** A blunder/mistake worth practicing, pulled from one game's already-computed review analysis —
 *  restricted to moves one of `humanColors` actually played (never the computer's or an opponent's). */
export function extractVaultEntries(sourceGameId: string, analysis: ExtractableMove[], humanColors: Color[]): VaultEntry[] {
  return analysis
    .filter((a) => (a.tier === 'blunder' || a.tier === 'mistake') && humanColors.includes(a.move.color))
    .map((a) => ({
      id: `${sourceGameId}-${a.ply}`,
      sourceGameId,
      ply: a.ply,
      fenBefore: a.fenBefore,
      bestMove: a.bestMove,
      bestSan: a.bestSan,
      playedSan: a.move.san,
      tier: a.tier,
      tags: a.tags,
      capturedAt: new Date().toISOString(),
    }));
}

export const useBlunderVaultStore = create<BlunderVaultState>()(
  persist(
    (set, get) => ({
      entries: [],
      solvedIds: [],
      hasBackfilled: false,

      addEntries(newEntries) {
        const { entries, solvedIds } = get();
        const seenFens = new Set(entries.map((e) => e.fenBefore));
        const deduped = newEntries.filter((e) => !seenFens.has(e.fenBefore));
        // also dedupe within the incoming batch itself
        const trulyNew: VaultEntry[] = [];
        const batchFens = new Set<string>();
        for (const e of deduped) {
          if (batchFens.has(e.fenBefore)) continue;
          batchFens.add(e.fenBefore);
          trulyNew.push(e);
        }
        if (trulyNew.length === 0) return;
        // Prepended "most recent first" — a batch's own later entries are the more recently captured
        // ones (extractVaultEntries emits them in ascending ply order), so reverse the batch before
        // prepending it, or the batch's *earliest* entry would end up looking like the newest.
        const kept = [...trulyNew.reverse(), ...entries].slice(0, MAX_VAULT_ENTRIES);
        // An id the cap just evicted must not linger in solvedIds forever — otherwise a *future* entry
        // that happens to reuse that id (see gameStore's sourceGameId) would look pre-solved, and
        // solvedIds itself would grow without the bound entries has.
        const keptIds = new Set(kept.map((e) => e.id));
        set({ entries: kept, solvedIds: solvedIds.filter((id) => keptIds.has(id)) });
      },

      markSolved(id) {
        const { solvedIds } = get();
        if (!solvedIds.includes(id)) set({ solvedIds: [...solvedIds, id] });
      },

      pickNext() {
        const { entries, solvedIds } = get();
        if (entries.length === 0) return null;
        return entries.find((e) => !solvedIds.includes(e.id)) ?? entries[0];
      },

      markBackfilled() {
        set({ hasBackfilled: true });
      },

      clear() {
        set({ entries: [], solvedIds: [], hasBackfilled: false });
      },
    }),
    { name: 'b-chess-blunder-vault', storage: createJSONStorage(() => localStorage) },
  ),
);
