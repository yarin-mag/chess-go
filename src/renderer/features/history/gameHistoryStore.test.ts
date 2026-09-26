import { beforeEach, describe, expect, it } from 'vitest';
import { useGameHistoryStore } from './gameHistoryStore';

describe('gameHistoryStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameHistoryStore.setState({ games: [] });
  });

  it('records a game with a fresh id and timestamp', () => {
    useGameHistoryStore.getState().recordGame([{ ply: 0, tier: 'best', tags: ['solid'] }]);
    const games = useGameHistoryStore.getState().games;
    expect(games).toHaveLength(1);
    expect(games[0].moves).toHaveLength(1);
    expect(games[0].id).toBeTruthy();
    expect(games[0].playedAt).toBeTruthy();
  });

  it('keeps the most recent games first', () => {
    useGameHistoryStore.getState().recordGame([{ ply: 0, tier: 'best', tags: [] }]);
    useGameHistoryStore.getState().recordGame([{ ply: 0, tier: 'blunder', tags: [] }]);
    expect(useGameHistoryStore.getState().games[0].moves[0].tier).toBe('blunder');
  });

  it('caps the number of stored games so localStorage never grows unbounded', () => {
    for (let i = 0; i < 250; i++) useGameHistoryStore.getState().recordGame([{ ply: 0, tier: 'best', tags: [] }]);
    expect(useGameHistoryStore.getState().games.length).toBeLessThanOrEqual(200);
  });

  it('clearHistory empties the log', () => {
    useGameHistoryStore.getState().recordGame([{ ply: 0, tier: 'best', tags: [] }]);
    useGameHistoryStore.getState().clearHistory();
    expect(useGameHistoryStore.getState().games).toHaveLength(0);
  });
});
