import { t } from '@/i18n';
import type { Color, GameResult, Level } from '@/core/types';
import type { GameConfig } from './gameStore';

export const colorName = (c: Color): string => t(`common:${c === 'w' ? 'white' : 'black'}`);

export const levelName = (level: Level): string => t(`common:${level}`);

/** Name shown next to a side's clock. */
export function playerLabel(config: GameConfig, color: Color): string {
  const kind = color === 'w' ? config.white : config.black;
  if (kind.type === 'engine') return t('game:playerComputer', { level: levelName(kind.level) });
  const vsComputer = config.white.type === 'engine' || config.black.type === 'engine';
  return vsComputer ? t('game:playerYou') : colorName(color);
}

const DRAW_REASON_KEY = {
  stalemate: 'drawStalemate',
  insufficient: 'drawInsufficient',
  threefold: 'drawThreefold',
  fifty: 'drawFifty',
  agreement: 'drawAgreement',
} as const;

const VICTORY_KEY = {
  checkmate: 'victoryCheckmate',
  timeout: 'victoryTimeout',
  resign: 'victoryResign',
  disconnected: 'victoryDisconnected',
} as const;

export function describeResult(result: GameResult): { title: string; detail: string } {
  if (result.kind === 'draw') return { title: t('game:resultDraw'), detail: t(`game:${DRAW_REASON_KEY[result.reason]}`) };
  return { title: t('game:resultWinner', { color: colorName(result.winner) }), detail: t(`game:${VICTORY_KEY[result.kind]}`) };
}
