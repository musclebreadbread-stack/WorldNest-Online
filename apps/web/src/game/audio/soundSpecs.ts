/**
 * Every sound the game can make, described as data.
 *
 * There is not a single binary asset in this repository — `BootScene` already
 * draws every texture programmatically — so the audio follows the same rule and
 * is synthesised from these envelopes at runtime (decision D9). No asset
 * pipeline, no licensing question, and the whole table is unit-testable because
 * it imports nothing from WebAudio.
 *
 * The audience is 10-18, so every cue is short, soft and gentle: sine and
 * triangle waves under a quarter of a second, never a buzz or an alarm.
 */

/** A thing that happened and is worth hearing. */
export type SoundCue =
  | "pickup"
  | "harvest"
  | "plant"
  | "build"
  | "deny"
  | "ui"
  | "dialogue"
  | "quest"
  | "shop";

/**
 * One oscillator voice with a gain envelope.
 *
 * `endFrequency` makes the note glide, which is what separates a friendly
 * "collected something" chirp from a flat beep. `gain` is the peak of the
 * envelope before the master volume is applied, so it stays well below 1.
 */
export interface SoundSpec {
  waveform: OscillatorType;
  frequency: number;
  endFrequency?: number;
  durationMs: number;
  gain: number;
}

export const SOUND_SPECS: Record<SoundCue, SoundSpec> = {
  // Rising chirp: something landed in the inventory
  pickup: {
    waveform: "triangle",
    frequency: 660,
    endFrequency: 988,
    durationMs: 120,
    gain: 0.18,
  },
  // Falling thud: a tile gave up its yield
  harvest: {
    waveform: "sine",
    frequency: 440,
    endFrequency: 330,
    durationMs: 170,
    gain: 0.2,
  },
  // Soft rise: a seed went into the ground
  plant: {
    waveform: "sine",
    frequency: 392,
    endFrequency: 523,
    durationMs: 180,
    gain: 0.16,
  },
  // Low knock: a structure was placed
  build: {
    waveform: "triangle",
    frequency: 294,
    endFrequency: 220,
    durationMs: 200,
    gain: 0.22,
  },
  // Gentle descent, deliberately not a buzzer: the action was not possible
  deny: {
    waveform: "sine",
    frequency: 233,
    endFrequency: 175,
    durationMs: 220,
    gain: 0.14,
  },
  // The quietest cue, because panels and chat fire it most often
  ui: {
    waveform: "sine",
    frequency: 880,
    durationMs: 90,
    gain: 0.12,
  },
  dialogue: {
    waveform: "triangle",
    frequency: 523,
    endFrequency: 587,
    durationMs: 130,
    gain: 0.14,
  },
  quest: {
    waveform: "triangle",
    frequency: 587,
    endFrequency: 880,
    durationMs: 260,
    gain: 0.2,
  },
  shop: {
    waveform: "sine",
    frequency: 698,
    endFrequency: 880,
    durationMs: 150,
    gain: 0.16,
  },
};

/** Every cue, in table order. Handy for tests and for a settings preview. */
export const SOUND_CUES = Object.keys(SOUND_SPECS) as SoundCue[];
