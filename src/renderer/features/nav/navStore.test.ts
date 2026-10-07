import { describe, expect, it } from 'vitest';
import { useNavStore } from './navStore';

describe('navStore', () => {
  it('defaults to the home tab', () => {
    expect(useNavStore.getState().tab).toBe('home');
  });

  it('setTab switches the active tab', () => {
    useNavStore.getState().setTab('shop');
    expect(useNavStore.getState().tab).toBe('shop');
    useNavStore.getState().setTab('home');
  });
});
