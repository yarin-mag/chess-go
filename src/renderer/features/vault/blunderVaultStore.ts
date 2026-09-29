import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MoveInput } from '@/core/types';
import type { Tier } from '@/engine/classify';
import type { ExplanationTag } from '@/engine/explain';
import type { MoveAnalysis } from '@/features/review/analyzeGame';

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
  addEntries(entries: VaultEntry[]): void;
  markSolved(id: string): void;
  /** An unsolved entry if one exists, otherwise any entry, otherwise null (vault empty). */
  pickNext(): VaultEntry | null;
  clear(): void;
}

/** A blunder/mistake worth practicing, pulled from one game's already-computed review analysis. */
export function extractVaultEntries(sourceGameId: string, analysis: MoveAnalysis[]): VaultEntry[] {
  return analysis
    .filter((a) => a.tier === 'blunder' || a.tier === 'mistake')
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

      addEntries(newEntries) {
        const { entries } = get();
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
        set({ entries: [...trulyNew.reverse(), ...entries].slice(0, MAX_VAULT_ENTRIES) });
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

      clear() {
        set({ entries: [], solvedIds: [] });
      },
    }),
    { name: 'b-chess-blunder-vault', storage: createJSONStorage(() => localStorage) },
  ),
);
