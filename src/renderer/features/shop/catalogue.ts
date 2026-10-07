import type { BoardTheme } from '@/features/settings/settingsStore';

/**
 * The Shop's catalogue — entirely local/mock. There is no payment integration anywhere in this
 * codebase (Electron + Capacitor app, no Stripe/IAP wiring), so "buying" something only ever spends the
 * in-app coin balance earned by playing (see walletStore). That's also why the design handoff's loot-box
 * regulatory warning doesn't apply here: nothing is ever purchased with real money.
 *
 * Only board skins are wired up (prices/rarities below, from the Round 3 handoff's own catalogue data) —
 * piece sets, frames and effects are speced in the handoff but have no renderable equivalent in this app
 * yet, so there's nothing honest to sell; see ShopScreen's "coming soon" for those categories.
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface BoardCatalogueEntry {
  theme: BoardTheme;
  rarity: Rarity;
  price: number;
}

export const BOARD_CATALOGUE: BoardCatalogueEntry[] = [
  { theme: 'walnut', rarity: 'uncommon', price: 400 },
  { theme: 'jade', rarity: 'uncommon', price: 450 },
  { theme: 'sapphire', rarity: 'rare', price: 900 },
  { theme: 'marble', rarity: 'rare', price: 900 },
  { theme: 'obsidian', rarity: 'epic', price: 1800 },
  { theme: 'gilded', rarity: 'legendary', price: 3000 },
];

export const boardCatalogueEntry = (theme: BoardTheme): BoardCatalogueEntry | undefined =>
  BOARD_CATALOGUE.find((e) => e.theme === theme);

/** The handoff's full odds table (common/uncommon/rare/epic/legendary = 60/25/10/4/1%) — shown as-is in
 *  the Shop for transparency, even though no "common" board exists to roll (the 4 pre-shop themes are
 *  free from day one, never a crate prize). rollCrate below renormalizes over just the tiers that have
 *  a catalogue entry, rather than pretending a 60%-weighted tier with nothing in it. */
export const CRATE_ODDS: { rarity: Rarity; percent: number }[] = [
  { rarity: 'common', percent: 60 },
  { rarity: 'uncommon', percent: 25 },
  { rarity: 'rare', percent: 10 },
  { rarity: 'epic', percent: 4 },
  { rarity: 'legendary', percent: 1 },
];

export const CRATE_PRICE = 500;

/**
 * Opens a crate: rolls a rarity tier (weighted by CRATE_ODDS, renormalized over tiers that actually have
 * a catalogue board), then picks uniformly among that tier's boards — excluding ones already in
 * `owned` when that still leaves a choice (the handoff's "no duplicates" promise), never excluding all
 * of them (a crate must always produce something). `rng` defaults to Math.random but is injectable for
 * tests.
 */
export function rollCrate(owned: BoardTheme[] = [], rng: () => number = Math.random): BoardCatalogueEntry {
  const tiers = CRATE_ODDS.filter((o) => BOARD_CATALOGUE.some((e) => e.rarity === o.rarity));
  const total = tiers.reduce((sum, t) => sum + t.percent, 0);
  let roll = rng() * total;
  let tier = tiers[tiers.length - 1].rarity;
  for (const t of tiers) {
    roll -= t.percent;
    if (roll < 0) {
      tier = t.rarity;
      break;
    }
  }

  const inTier = BOARD_CATALOGUE.filter((e) => e.rarity === tier);
  const unowned = inTier.filter((e) => !owned.includes(e.theme));
  const candidates = unowned.length > 0 ? unowned : inTier;
  return candidates[Math.floor(rng() * candidates.length)];
}
