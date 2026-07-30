import type { DayPhase } from "@worldnest/game-engine";
import type { SoundSynth } from "./SoundSynth";

/**
 * Background music, synthesised like everything else (decision D9).
 *
 * A short four-chord progression, one chord per bar, in one of two keys chosen by
 * the day phase. It is deliberately a slow pad rather than a melody: a tune this
 * short would be maddening after ten minutes, whereas sustained thirds read as
 * weather. Nothing is streamed, downloaded or licensed.
 */

/** Bright for daylight, low for the evening. */
export type MusicMood = "bright" | "low";

export const PHASE_MOODS: Record<DayPhase, MusicMood> = {
  dawn: "bright",
  day: "bright",
  dusk: "low",
  night: "low",
};

export function moodForPhase(phase: DayPhase): MusicMood {
  return PHASE_MOODS[phase];
}

/**
 * One chord per bar, as frequencies in Hz.
 *
 * `bright` is C-major triads around middle C; `low` is the same shapes an octave
 * down in A-minor, which is what makes dusk feel like dusk without a key change
 * the player can name.
 */
export const MUSIC_PROGRESSIONS: Record<MusicMood, readonly (readonly number[])[]> = {
  bright: [
    [261.63, 329.63, 392.0], // C major
    [349.23, 440.0, 523.25], // F major
    [392.0, 493.88, 587.33], // G major
    [329.63, 392.0, 493.88], // E minor
  ],
  low: [
    [110.0, 130.81, 164.81], // A minor
    [146.83, 174.61, 220.0], // D minor
    [130.81, 164.81, 196.0], // C major
    [123.47, 146.83, 185.0], // B diminished
  ],
};

/** How long each chord is held before the next one starts. */
export const CHORD_INTERVAL_MS = 2400;

/** Extra ring after the next chord begins, so the pad never gaps. */
const CHORD_TAIL_MS = 700;

const CHORD_WAVEFORM: OscillatorType = "sine";

/** Peak gain of a chord's root, before the music and master volumes. */
const CHORD_GAIN = 0.09;

/** Upper voices are quieter, so a chord reads as one pad and not three beeps. */
const VOICE_FALLOFF = 0.7;

export class MusicLoop {
  private synth: SoundSynth;
  private mood: MusicMood | null = null;
  private chordIndex = 0;
  /** Primed so the first update after a mood change plays immediately. */
  private sinceChordMs = CHORD_INTERVAL_MS;

  constructor(synth: SoundSynth) {
    this.synth = synth;
  }

  /**
   * Advance the progression. Call once per frame with the frame's delta, the
   * current day phase and the effective music volume (0 while muted).
   */
  update(deltaMs: number, phase: DayPhase, volume: number): void {
    const mood = moodForPhase(phase);
    if (mood !== this.mood) {
      // A new key starts at its root rather than mid-progression
      this.mood = mood;
      this.chordIndex = 0;
      this.sinceChordMs = CHORD_INTERVAL_MS;
    }

    this.sinceChordMs += deltaMs;
    if (this.sinceChordMs < CHORD_INTERVAL_MS) return;

    this.sinceChordMs = 0;
    // `now()` is null until a gesture has unlocked the context; the progression
    // still advances so the music does not restart from the root on first click.
    if (volume > 0 && this.synth.now() !== null) this.playChord(mood, volume);
    this.chordIndex = (this.chordIndex + 1) % MUSIC_PROGRESSIONS[mood].length;
  }

  destroy(): void {
    this.mood = null;
  }

  private playChord(mood: MusicMood, volume: number): void {
    const chord = MUSIC_PROGRESSIONS[mood][this.chordIndex];
    const startAt = this.synth.now() ?? 0;

    chord.forEach((frequency, voice) => {
      this.synth.playTone({
        waveform: CHORD_WAVEFORM,
        frequency,
        durationMs: CHORD_INTERVAL_MS + CHORD_TAIL_MS,
        gain: CHORD_GAIN * VOICE_FALLOFF ** voice,
        gainScale: volume,
        startAt,
      });
    });
  }
}
