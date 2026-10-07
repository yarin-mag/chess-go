import { beforeEach, describe, expect, it } from 'vitest';
import { useWalletStore } from './walletStore';

describe('walletStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useWalletStore.setState({ coins: 0 });
  });

  it('starts at zero', () => {
    expect(useWalletStore.getState().coins).toBe(0);
  });

  it('earn adds to the balance', () => {
    useWalletStore.getState().earn(25);
    useWalletStore.getState().earn(10);
    expect(useWalletStore.getState().coins).toBe(35);
  });

  it('ignores a non-positive earn amount', () => {
    useWalletStore.getState().earn(10);
    useWalletStore.getState().earn(0);
    useWalletStore.getState().earn(-5);
    expect(useWalletStore.getState().coins).toBe(10);
  });

  it('spend succeeds and deducts when the balance covers it', () => {
    useWalletStore.getState().earn(100);
    const ok = useWalletStore.getState().spend(40);
    expect(ok).toBe(true);
    expect(useWalletStore.getState().coins).toBe(60);
  });

  it('spend fails and leaves the balance untouched when it does not cover the cost', () => {
    useWalletStore.getState().earn(10);
    const ok = useWalletStore.getState().spend(40);
    expect(ok).toBe(false);
    expect(useWalletStore.getState().coins).toBe(10);
  });
});
