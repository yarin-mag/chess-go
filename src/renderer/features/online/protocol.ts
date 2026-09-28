import type { Color, MoveInput, TimeControl } from '@/core/types';

export type NetworkMessage =
  | { type: 'init'; joinerColor: Color; timeControl: TimeControl }
  | { type: 'move'; move: MoveInput; at: number }
  | { type: 'resign' }
  | { type: 'drawOffer' }
  | { type: 'drawResponse'; accepted: boolean }
  | { type: 'reaction'; text: string };

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** A short, human-shareable room code (6 chars). Not cryptographically significant — just an invite code. */
export function randomRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

/**
 * The only valid `reaction.text` values — emoji + canned chess phrases, never freeform typing. Both the
 * send path (onlineStore.sendReaction) and the receive path (useOnlineSync) check isKnownReaction before
 * a reaction reaches the wire or the screen, so a malformed/hostile peer message can't inject arbitrary text.
 */
export const REACTIONS: readonly string[] = [
  '👍', '😮', '😱', '🔥', '🤝', '😂', '♟️',
  'Nice move!', 'Wow!', 'Blunder!', 'Brilliant!', 'Check!', 'Good game', 'Oops', 'Well played',
];

export function isKnownReaction(text: string): boolean {
  return REACTIONS.includes(text);
}
