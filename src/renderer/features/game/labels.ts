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

/** Which color the local human played, for games where that's unambiguous (vs-computer, online — either
 *  config.remote or exactly one side is `{type:'human'}`). A local two-human hotseat game has no single
 *  "the player", so this falls back to White's perspective rather than guessing which side "you" means. */
export function humanPerspectiveColor(config: GameConfig): Color {
  if (config.remote) return config.remote.color === 'w' ? 'b' : 'w';
  if (config.white.type === 'human' && config.black.type !== 'human') return 'w';
  if (config.black.type === 'human' && config.white.type !== 'human') return 'b';
  return 'w';
}

/** W/L/D from the local human's own perspective (see humanPerspectiveColor) — the letter SavedGames/Me
 *  show next to each row, and what GameOverModal uses to say "You won" instead of "White wins". */
export function resultLetter(config: GameConfig, result: GameResult): 'W' | 'L' | 'D' {
  if (result.kind === 'draw') return 'D';
  return result.winner === humanPerspectiveColor(config) ? 'W' : 'L';
}
