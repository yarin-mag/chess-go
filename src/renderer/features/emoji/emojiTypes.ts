export type EmojiPieceLetter = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
export type EmojiEyeStyle = 'dot' | 'big' | 'happy' | 'sleepy' | 'x' | 'star' | 'heart' | 'shades';
export type EmojiMouthStyle = 'smile' | 'grin' | 'laugh' | 'frown' | 'o' | 'teeth' | 'tongue';
export type EmojiFxKind = 'text' | 'drop' | 'puff' | 'arrow' | 'flag' | 'clock' | 'confetti';

/** One piece "actor" in a scene — a recolored piece silhouette (always the white SVG, hue-rotated; see
 *  emojiScenesData's `h`) optionally wearing a face built from CSS shapes. */
export interface EmojiActor {
  p: EmojiPieceLetter;
  x: number;
  y: number;
  /** Size in a 100x100 scene box. */
  s: number;
  /** Hue-rotate degrees applied to the (white) piece silhouette — this is what gives each actor its color. */
  h: number;
  sat?: number;
  rot?: number;
  flip?: 1;
  op?: number;
  /** false hides the face entirely (used for a faded "ghost" actor behind the main one). */
  face?: false;
  eyes?: EmojiEyeStyle;
  /** Right eye style, when it differs from the left (`eyes`) — e.g. a wink. */
  eyeR?: EmojiEyeStyle;
  m?: EmojiMouthStyle;
  angry?: 1;
  worried?: 1;
  tears?: 1;
  blush?: 1;
}

/** A soft radial-gradient pool under an actor (e.g. the dark puddle under a checkmated king). */
export interface EmojiUnder {
  x: number;
  y: number;
  w: number;
  h: number;
  c: string;
}

/** A decorative mark layered over the scene (speech-bubble text, sweat drops, an arrow, …). */
export interface EmojiFx {
  t: EmojiFxKind;
  x: number;
  y: number;
  rot?: number;
  fs?: number;
  v?: string;
  c?: string;
  w?: number;
}

export interface EmojiScene {
  a: EmojiActor[];
  u?: EmojiUnder[];
  f?: EmojiFx[];
}
