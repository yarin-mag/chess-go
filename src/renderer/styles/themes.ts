import type { BoardTheme } from '@/features/settings/settingsStore';

export interface BoardColors {
  label: string;
  light: string;
  dark: string;
}

export const BOARD_THEMES: Record<BoardTheme, BoardColors> = {
  classic: { label: 'Classic', light: '#f0d9b5', dark: '#b58863' },
  green: { label: 'Forest', light: '#eeeed2', dark: '#769656' },
  blue: { label: 'Ocean', light: '#dee3e6', dark: '#8ca2ad' },
  dark: { label: 'Midnight', light: '#7d8796', dark: '#4b5563' },
  // Shop skins (Phase 3) — colors from the Round 3 design handoff's own `T` theme map, so a purchased
  // board matches its shop preview exactly.
  gilded: { label: 'Gilded', light: '#efe2c4', dark: '#b68235' },
  walnut: { label: 'Walnut', light: '#d9b38c', dark: '#7a5230' },
  marble: { label: 'Marble', light: '#ecebe7', dark: '#a8a39b' },
  obsidian: { label: 'Obsidian', light: '#5b5650', dark: '#2d2b2b' },
  sapphire: { label: 'Sapphire', light: '#d3dae8', dark: '#4a5f8c' },
  jade: { label: 'Jade', light: '#dfe9df', dark: '#5f8a72' },
};

/** Always available, no purchase needed — this is exactly BOARD_THEMES' original key set, before the
 *  shop existed. Settings' theme picker shows only these (equipping a Shop skin happens in the Shop,
 *  where ownership is checked — Settings has no concept of "owned"). */
export const DEFAULT_BOARD_THEMES: BoardTheme[] = ['classic', 'green', 'blue', 'dark'];

/** Shop-only skins — must be unlocked via inventoryStore before they can be equipped. */
export const SHOP_BOARD_THEMES: BoardTheme[] = ['gilded', 'walnut', 'marble', 'obsidian', 'sapphire', 'jade'];
