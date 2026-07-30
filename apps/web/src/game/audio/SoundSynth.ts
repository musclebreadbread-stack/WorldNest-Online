import { SOUND_SPECS, type SoundCue, type SoundSpec } from "./soundSpecs";

/**
 * How the synth obtains its `AudioContext`. Injected so the tests can drive the
 * whole class with a double — there is no audio device in CI, and constructing a
 * real context there either throws or leaks a hardware handle.
 */
export type AudioContextFactory = () => AudioContext;

/** A single voice: a `SoundSpec` plus optional scheduling and scaling. */
export interface ToneRequest extends SoundSpec {
  /** Context time to start at. Defaults to "as soon as possible". */
  startAt?: number;
  /** Extra scale on top of the master volume; `MusicLoop` uses it for music. */
  gainScale?: number;
}

/** Envelope attack, long enough to avoid a click, short enough to feel instant. */
const ATTACK_MS = 12;

/**
 * `exponentialRampToValueAtTime` cannot target 0, so the release ramps to a
 * value below hearing instead.
 */
const SILENCE = 0.0001;

/**
 * SoundSynth turns a `SoundCue` into WebAudio nodes.
 *
 * The context is created lazily, on the first `play` or `resume`, because every
 * browser's autoplay policy refuses to start one outside a user gesture — a
 * context built at scene boot would sit `suspended` forever. Nothing here knows
 * about the game: cue selection is `SoundManager`'s job.
 */
export class SoundSynth {
  private factory: AudioContextFactory;
  private context: AudioContext | null = null;
  private volume = 1;
  private muted = false;

  constructor(factory: AudioContextFactory = createDefaultContext) {
    this.factory = factory;
  }

  /** Play a catalogue cue immediately. */
  play(cue: SoundCue): void {
    this.playTone(SOUND_SPECS[cue]);
  }

  /** Play an arbitrary voice, optionally scheduled ahead of the clock. */
  playTone(tone: ToneRequest): void {
    const gain = tone.gain * this.volume * (tone.gainScale ?? 1);
    if (this.muted || gain <= 0) return;

    const context = this.ensureContext();
    if (!context) return;

    const startAt = Math.max(tone.startAt ?? context.currentTime, context.currentTime);
    const endAt = startAt + tone.durationMs / 1000;

    const oscillator = context.createOscillator();
    oscillator.type = tone.waveform;
    oscillator.frequency.setValueAtTime(tone.frequency, startAt);
    if (tone.endFrequency !== undefined) {
      oscillator.frequency.linearRampToValueAtTime(tone.endFrequency, endAt);
    }

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(SILENCE, startAt);
    envelope.gain.linearRampToValueAtTime(gain, startAt + ATTACK_MS / 1000);
    envelope.gain.exponentialRampToValueAtTime(SILENCE, endAt);

    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt);
    // Voices are one-shot; drop the graph as soon as it has finished sounding
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }

  /** Master volume, 0..1. Applied to every voice scheduled from now on. */
  setVolume(volume: number): void {
    this.volume = clamp01(volume);
  }

  /** Silence everything. A muted synth creates no nodes at all. */
  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  /**
   * Called from the first pointer or key event. This is the one place a context
   * may legitimately be created, so it creates one if `play` has not yet.
   */
  resume(): void {
    const context = this.ensureContext();
    if (context?.state === "suspended") void context.resume();
  }

  /**
   * Context clock, or `null` while no context exists — deliberately *not* a
   * creation point, so `MusicLoop` stays silent until a gesture has unlocked
   * audio instead of scheduling into a context nobody can hear.
   */
  now(): number | null {
    return this.context?.currentTime ?? null;
  }

  /** Release the audio device. Safe to call twice. */
  destroy(): void {
    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") void context.close();
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;

    try {
      this.context = this.factory();
    } catch {
      // No audio device, or a policy refusal: the game stays playable in silence
      this.context = null;
    }
    return this.context;
  }
}

function createDefaultContext(): AudioContext {
  return new AudioContext();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
