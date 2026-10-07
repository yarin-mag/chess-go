import { ANCH, EMOJI_SCENES } from './emojiScenesData.generated';
import type { EmojiScene } from './emojiTypes';

export { ANCH, EMOJI_SCENES };
export type { EmojiScene };

export type EmojiKind = keyof typeof EMOJI_SCENES;

export const EMOJI_KINDS = Object.keys(EMOJI_SCENES) as EmojiKind[];

/** Matches the handoff's own fallback (`S[kind] || S['lol-pawn']`) for an unrecognized kind — a
 *  malformed/hostile peer value, or simply typo'd, never crashes the renderer. */
export const DEFAULT_EMOJI_KIND: EmojiKind = 'lol-pawn';

export function emojiScene(kind: string): EmojiScene {
  return EMOJI_SCENES[kind as EmojiKind] ?? EMOJI_SCENES[DEFAULT_EMOJI_KIND];
}
