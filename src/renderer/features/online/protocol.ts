import type { Color, MoveInput, TimeControl } from '@/core/types';
import type { EmojiKind } from '@/features/emoji/emojiScenes';

export type NetworkMessage =
  | { type: 'init'; joinerColor: Color; timeControl: TimeControl }
  | { type: 'move'; move: MoveInput; at: number }
  | { type: 'resign' }
  | { type: 'drawOffer' }
  | { type: 'drawResponse'; accepted: boolean }
  | { type: 'reaction'; key: ReactionKey }
  | { type: 'chat'; text: string };

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
  // Round 3's illustrated emoji pack (Emoji.dc.html / emojiScenes.ts) — the favourites row's curated
  // set (`r3Fav` in the handoff). These keys double as both a wire-protocol reaction key (same as every
  // other entry above) *and* an emojiScenes.ts scene id, which is how ReactionPicker/ReactionBubble know
  // to render real Emoji art for them instead of the `online:reaction_*` text fallback.
  'wink-knight', 'lol-pawn', 'blunder-scene', 'brilliant-scene', 'gg', 'thinking',
] as const;
export type ReactionKey = (typeof REACTION_KEYS)[number];

export function isKnownReaction(key: string): key is ReactionKey {
  return (REACTION_KEYS as readonly string[]).includes(key);
}

/** Maps the 6 illustrated-pack reaction keys to their emojiScenes.ts scene id — kept separate from the
 *  wire key itself (rather than requiring them to be identical strings) so a reaction key never collides
 *  with an older text-phrase key of a similar name (e.g. 'blunder-scene' vs the existing 'blunder'). */
const REACTION_EMOJI_SCENE: Partial<Record<ReactionKey, EmojiKind>> = {
  'wink-knight': 'wink-knight',
  'lol-pawn': 'lol-pawn',
  'blunder-scene': 'blunder',
  'brilliant-scene': 'brilliant',
  gg: 'gg',
  thinking: 'thinking',
};

export function emojiSceneForReaction(key: ReactionKey): EmojiKind | undefined {
  return REACTION_EMOJI_SCENE[key];
}

/** The illustrated-pack reactions, in the handoff's own favourites-row order — ReactionPicker's source
 *  of truth for which 6 buttons to show (each one real Emoji art, not a text/glyph fallback). */
export const SCENE_REACTION_KEYS = Object.keys(REACTION_EMOJI_SCENE) as ReactionKey[];

/** The emoji-glyph-valued half of REACTION_KEYS (see their `online:reaction_*` strings) — used for the
 *  chat sheet's emoji tray and the in-game favourites row. The rest (`PHRASE_REACTION_KEYS`) are the
 *  canned chat phrases ("Nice move!", "Good game", …) — same wire protocol and locale keys, just a
 *  different surface, so there's exactly one source of truth for what a reaction key displays as. */
export const EMOJI_REACTION_KEYS = ['thumbsUp', 'wow', 'yikes', 'fire', 'handshake', 'laugh', 'pawn'] as const satisfies readonly ReactionKey[];
export const PHRASE_REACTION_KEYS = REACTION_KEYS.filter(
  (k) => !(EMOJI_REACTION_KEYS as readonly string[]).includes(k),
) as Exclude<ReactionKey, (typeof EMOJI_REACTION_KEYS)[number]>[];

/** Chat messages are untrusted peer input rendered as plain text (React already escapes it — no markup
 *  injection risk), but still worth bounding: this is the one place both the send path and the receive
 *  path run text through, so a malformed/hostile/huge payload can't bloat the chat log or the wire.
 *  Returns null for anything that isn't a non-empty string once trimmed. */
export const MAX_CHAT_LENGTH = 200;
// eslint-disable-next-line no-control-regex -- intentionally stripping control chars from peer input
const CONTROL_CHARS = /[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g;

export function sanitizeChatText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(CONTROL_CHARS, '').trim().slice(0, MAX_CHAT_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}
