import { useSettingsStore } from '@/features/settings/settingsStore';
import type { EmojiKind } from '@/features/emoji/emojiScenes';

export type SoundKind = 'move' | 'capture' | 'check' | 'end' | 'wrong';

interface Tone {
  freq: number;
  /** Seconds from the start of the sound. */
  at: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
}

const SOUNDS: Record<SoundKind, Tone[]> = {
  move: [{ freq: 240, at: 0, duration: 0.07, type: 'triangle', volume: 0.25 }],
  capture: [
    { freq: 170, at: 0, duration: 0.1, type: 'square', volume: 0.12 },
    { freq: 320, at: 0, duration: 0.05, type: 'triangle', volume: 0.2 },
  ],
  check: [
    { freq: 660, at: 0, duration: 0.09, type: 'sine', volume: 0.25 },
    { freq: 880, at: 0.09, duration: 0.12, type: 'sine', volume: 0.25 },
  ],
  end: [
    { freq: 523, at: 0, duration: 0.14, type: 'sine', volume: 0.25 },
    { freq: 392, at: 0.14, duration: 0.14, type: 'sine', volume: 0.25 },
    { freq: 262, at: 0.28, duration: 0.3, type: 'sine', volume: 0.25 },
  ],
  wrong: [
    { freq: 220, at: 0, duration: 0.1, type: 'sawtooth', volume: 0.15 },
    { freq: 165, at: 0.09, duration: 0.16, type: 'sawtooth', volume: 0.15 },
  ],
};

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    ctx = null; // audio unavailable: play nothing
  }
  return ctx;
}

/** Plays a short synthesized effect. No-op when sound is off or unavailable. */
export function playSound(kind: SoundKind): void {
  if (!useSettingsStore.getState().soundOn) return;
  const audio = getContext();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume();

  const start = audio.currentTime;
  for (const tone of SOUNDS[kind]) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const t0 = start + tone.at;
    osc.type = tone.type ?? 'sine';
    osc.frequency.value = tone.freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(tone.volume ?? 0.2, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + tone.duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0);
    osc.stop(t0 + tone.duration + 0.02);
  }
}

/** Which mood sting (see REACTION_STINGS below) each illustrated-pack scene plays — ported from the
 *  design handoff's `sfx()`. Unlisted scenes fall back to 'pop', same as the handoff. Only scenes this
 *  app actually sends as reactions (see protocol.ts's SCENE_REACTION_KEYS) need to be listed, but the
 *  full mood grouping is kept so a future addition just needs a line here, not a new mood. */
const REACTION_MOOD: Partial<Record<EmojiKind, 'sad' | 'angry' | 'laugh' | 'shine' | 'tick'>> = {
  'crying-king': 'sad', checkmated: 'sad', flagged: 'sad', 'resign-flag': 'sad', why: 'sad', 'trapped-bishop': 'sad', 'double-check': 'sad', stalemate: 'sad',
  'angry-knight': 'angry', 'rage-quit': 'angry', tilted: 'angry', 'pawn-storm': 'angry', 'back-rank': 'angry', desperado: 'angry', rematch: 'angry',
  'lol-pawn': 'laugh', 'wink-knight': 'laugh', gg: 'laugh', 'wp-knights': 'laugh', thanks: 'laugh', 'free-pawn': 'laugh', 'knight-hop': 'laugh', bongcloud: 'laugh',
  brilliant: 'shine', promoted: 'shine', promote: 'shine', 'mate-win': 'shine', champion: 'shine', solved: 'shine', outpost: 'shine', 'queen-sac': 'shine', 'ice-cold': 'shine',
  'time-trouble': 'tick', blitz: 'tick', thinking: 'tick', premove: 'tick', afk: 'tick', 'sleepy-rook': 'tick',
};

/** [oscillator type, frequencies (0 = a rest), seconds between notes]. Ported 1:1 from the handoff. */
const MOOD_STINGS: Record<'sad' | 'angry' | 'laugh' | 'shine' | 'tick' | 'pop', [OscillatorType, number[], number]> = {
  sad: ['sine', [520, 440, 330, 220], 0.16],
  angry: ['sawtooth', [140, 120, 150, 110], 0.09],
  laugh: ['triangle', [660, 880, 740, 990, 830, 1100], 0.07],
  shine: ['triangle', [1046, 1318, 1568, 2093], 0.09],
  tick: ['square', [1400, 0, 1400, 0, 1400], 0.06],
  pop: ['sine', [600, 900], 0.08],
};

/** A rising whoosh (same for every mood) followed by a short mood-specific note sequence — the "reaction
 *  sent" sting from the design handoff, ported to this module's existing oscillator/gain-envelope
 *  approach instead of duplicating one. No-op when sound is off or audio is unavailable, same as playSound. */
export function playReactionSound(scene: EmojiKind): void {
  if (!useSettingsStore.getState().soundOn) return;
  const audio = getContext();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume();

  const t0 = audio.currentTime + 0.02;
  const whoosh = audio.createOscillator();
  const whooshGain = audio.createGain();
  whoosh.type = 'sine';
  whoosh.frequency.setValueAtTime(220, t0);
  whoosh.frequency.exponentialRampToValueAtTime(880, t0 + 0.22);
  whooshGain.gain.setValueAtTime(0.0001, t0);
  whooshGain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.05);
  whooshGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
  whoosh.connect(whooshGain).connect(audio.destination);
  whoosh.start(t0);
  whoosh.stop(t0 + 0.26);

  const [type, freqs, gap] = MOOD_STINGS[REACTION_MOOD[scene] ?? 'pop'];
  freqs.forEach((freq, i) => {
    if (!freq) return; // a rest, e.g. the 'tick' mood's silent beats
    const t = t0 + 0.28 + i * gap;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const peak = REACTION_MOOD[scene] === 'angry' ? 0.06 : 0.12;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + gap * 1.6);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + gap * 1.8);
  });
}
