import { useSettingsStore } from '@/features/settings/settingsStore';

export type SoundKind = 'move' | 'capture' | 'check' | 'end';

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
