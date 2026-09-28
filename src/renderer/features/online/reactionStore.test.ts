import { describe, expect, it } from 'vitest';
import { useReactionStore } from './reactionStore';

describe('reactionStore', () => {
  it('show sets the current reaction', () => {
    useReactionStore.getState().show('👍');
    expect(useReactionStore.getState().current?.text).toBe('👍');
  });

  it('show gives each call a distinct key, even for the same text twice', () => {
    useReactionStore.getState().show('👍');
    const firstKey = useReactionStore.getState().current?.key;
    useReactionStore.getState().show('👍');
    expect(useReactionStore.getState().current?.key).not.toBe(firstKey);
  });

  it('clear resets to null', () => {
    useReactionStore.getState().show('👍');
    useReactionStore.getState().clear();
    expect(useReactionStore.getState().current).toBeNull();
  });
});
