import { beforeEach, describe, expect, it } from 'vitest';
import type { GameConfig } from '@/features/game/gameStore';
import type { MoveRecord } from '@/core/types';
import { useSavedGamesStore } from './savedGamesStore';

const HUMAN = { type: 'human' as const };
const config: GameConfig = { white: HUMAN, black: HUMAN, timeControl: { name: 'Untimed', minutes: 0, incrementSec: 0 } };
const move = { san: 'e4', from: 'e2', to: 'e4', color: 'w', piece: 'p', flags: 'b', fen: 'x' } as unknown as MoveRecord;
const result = { kind: 'resign' as const, winner: 'w' as const };

describe('savedGamesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useSavedGamesStore.setState({ games: [] });
  });

  it('saves a game with a fresh id and timestamp', () => {
    useSavedGamesStore.getState().saveGame(config, [move], result);
    const games = useSavedGamesStore.getState().games;
    expect(games).toHaveLength(1);
    expect(games[0].history).toHaveLength(1);
    expect(games[0].id).toBeTruthy();
    expect(games[0].playedAt).toBeTruthy();
    expect(games[0].config).toBe(config);
    expect(games[0].result).toBe(result);
  });

  it('returns the id it just assigned, so callers can reference this exact saved game', () => {
    const id = useSavedGamesStore.getState().saveGame(config, [move], result);
    expect(useSavedGamesStore.getState().games[0].id).toBe(id);
  });

  it('keeps the most recent games first', () => {
    useSavedGamesStore.getState().saveGame(config, [move], result);
    const second = { ...result, winner: 'b' as const };
    useSavedGamesStore.getState().saveGame(config, [move], second);
    expect(useSavedGamesStore.getState().games[0].result).toBe(second);
  });

  it('caps the number of stored games so localStorage never grows unbounded', () => {
    for (let i = 0; i < 150; i++) useSavedGamesStore.getState().saveGame(config, [move], result);
    expect(useSavedGamesStore.getState().games.length).toBeLessThanOrEqual(100);
  });

  it('deleteGame removes just that entry', () => {
    useSavedGamesStore.getState().saveGame(config, [move], result);
    const id = useSavedGamesStore.getState().games[0].id;
    useSavedGamesStore.getState().saveGame(config, [move], result);
    useSavedGamesStore.getState().deleteGame(id);
    expect(useSavedGamesStore.getState().games.find((g) => g.id === id)).toBeUndefined();
    expect(useSavedGamesStore.getState().games).toHaveLength(1);
  });

  it('clearSaved empties the log', () => {
    useSavedGamesStore.getState().saveGame(config, [move], result);
    useSavedGamesStore.getState().clearSaved();
    expect(useSavedGamesStore.getState().games).toHaveLength(0);
  });
});
