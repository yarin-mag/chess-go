import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_THEMES } from '@/styles/themes';
import { useInventoryStore } from './inventoryStore';

describe('inventoryStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useInventoryStore.setState({ ownedBoardThemes: [...DEFAULT_BOARD_THEMES] });
  });

  it('owns every pre-shop default theme from the start', () => {
    for (const theme of DEFAULT_BOARD_THEMES) expect(useInventoryStore.getState().owns(theme)).toBe(true);
  });

  it('does not own a shop theme until unlocked', () => {
    expect(useInventoryStore.getState().owns('gilded')).toBe(false);
  });

  it('unlock grants ownership', () => {
    useInventoryStore.getState().unlock('gilded');
    expect(useInventoryStore.getState().owns('gilded')).toBe(true);
  });

  it('unlock is idempotent — unlocking twice does not duplicate the entry', () => {
    useInventoryStore.getState().unlock('walnut');
    useInventoryStore.getState().unlock('walnut');
    expect(useInventoryStore.getState().ownedBoardThemes.filter((t) => t === 'walnut')).toHaveLength(1);
  });
});
