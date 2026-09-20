import type { Color, GameResult, Level } from '@/core/types';
import type { GameConfig } from './gameStore';

export const colorName = (c: Color): string => (c === 'w' ? 'White' : 'Black');

export const levelName = (level: Level): string => level[0].toUpperCase() + level.slice(1);

/** Name shown next to a side's clock. */
export function playerLabel(config: GameConfig, color: Color): string {
  const kind = color === 'w' ? config.white : config.black;
  if (kind.type === 'engine') return `Computer · ${levelName(kind.level)}`;
  const vsComputer = config.white.type === 'engine' || config.black.type === 'engine';
  return vsComputer ? 'You' : colorName(color);
}

const DRAW_REASONS = {
  stalemate: 'Stalemate',
  insufficient: 'Insufficient material',
  threefold: 'Threefold repetition',
  fifty: 'Fifty-move rule',
  agreement: 'Draw by agreement',
} as const;

export function describeResult(result: GameResult): { title: string; detail: string } {
  if (result.kind === 'draw') return { title: 'Draw', detail: DRAW_REASONS[result.reason] };
  const reason = { checkmate: 'by checkmate', timeout: 'on time', resign: 'by resignation' }[result.kind];
  return { title: `${colorName(result.winner)} wins`, detail: `Victory ${reason}` };
}
