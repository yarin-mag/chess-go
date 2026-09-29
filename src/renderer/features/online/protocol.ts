import type { Color, MoveInput, TimeControl } from '@/core/types';

export type NetworkMessage =
  | { type: 'init'; joinerColor: Color; timeControl: TimeControl }
  | { type: 'move'; move: MoveInput; at: number }
  | { type: 'resign' }
  | { type: 'drawOffer' }
  | { type: 'drawResponse'; accepted: boolean }
  | { type: 'reaction'; key: ReactionKey };

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** A short, human-shareable room code (6 chars). Not cryptographically significant — just an invite code. */
export function randomRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

/**
 * The only valid `reaction.key` values — emoji + canned chess phrases, never freeform typing. Both the
 * send path (onlineStore.sendReaction) and the receive path (useOnlineSync) check isKnownReaction before
 * a reaction reaches the wire or the screen, so a malformed/hostile peer message can't inject arbitrary text.
 * The wire carries only the key; each side looks up its own locale's `online:reaction_<key>` display text —
 * that's what lets two clients on different locales each see the reaction in their own language.
 */
export const REACTION_KEYS = [
  'thumbsUp', 'wow', 'yikes', 'fire', 'handshake', 'laugh', 'pawn',
  'niceMove', 'wowText', 'blunder', 'brilliant', 'check', 'goodGame', 'oops', 'wellPlayed',
] as const;
export type ReactionKey = (typeof REACTION_KEYS)[number];

export function isKnownReaction(key: string): key is ReactionKey {
  return (REACTION_KEYS as readonly string[]).includes(key);
}
