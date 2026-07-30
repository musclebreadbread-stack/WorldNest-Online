import { describe, it, expect, beforeEach } from "vitest";
import { SOUND_CUES, SOUND_SPECS } from "../game/audio/soundSpecs";
import { SoundSynth } from "../game/audio/SoundSynth";
import {
  AUDIO_STORAGE_KEY,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_MUSIC_VOLUME,
  clampVolume,
  readStoredAudio,
  useAudioStore,
} from "../stores/audioStore";
import { fakeContextFactory } from "./helpers/fakeAudio";

const WAVEFORMS = ["sine", "square", "sawtooth", "triangle"];

describe("SOUND_SPECS", () => {
  it("should describe every cue with an audible, gentle envelope", () => {
    expect(SOUND_CUES.length).toBeGreaterThan(0);

    for (const cue of SOUND_CUES) {
      const spec = SOUND_SPECS[cue];
      expect(WAVEFORMS, cue).toContain(spec.waveform);
      expect(spec.durationMs, cue).toBeGreaterThan(0);
      expect(spec.gain, cue).toBeGreaterThan(0);
      expect(spec.gain, cue).toBeLessThanOrEqual(1);
      expect(spec.frequency, cue).toBeGreaterThan(0);
    }
  });

  it("should keep every glide target positive and every cue short", () => {
    for (const cue of SOUND_CUES) {
      const spec = SOUND_SPECS[cue];
      if (spec.endFrequency !== undefined) {
        expect(spec.endFrequency, cue).toBeGreaterThan(0);
      }
      // Cues punctuate an action; anything longer would overlap the next one
      expect(spec.durationMs, cue).toBeLessThanOrEqual(500);
    }
  });
});

describe("SoundSynth", () => {
  it("should not create a context until the first play", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);

    expect(factory.created).toBe(0);
    expect(synth.now()).toBeNull();

    synth.play("ui");

    expect(factory.created).toBe(1);
    expect(synth.now()).toBe(0);
  });

  it("should reuse the one context for every later cue", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);

    synth.play("ui");
    synth.play("pickup");
    synth.play("build");

    expect(factory.created).toBe(1);
    expect(factory.context!.oscillators).toHaveLength(3);
  });

  it("should build an oscillator into a gain into the destination", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);

    synth.play("pickup");

    const context = factory.context!;
    expect(context.oscillators).toHaveLength(1);
    expect(context.gains).toHaveLength(1);

    const [oscillator] = context.oscillators;
    const [envelope] = context.gains;
    expect(oscillator.type).toBe(SOUND_SPECS.pickup.waveform);
    expect(oscillator.connectedTo).toBe(envelope);
    expect(envelope.connectedTo).toBe(context.destination);
  });

  it("should schedule a stop at the end of the cue's duration", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);
    factory.startAt(2);

    synth.play("harvest");

    const [oscillator] = factory.context!.oscillators;
    expect(oscillator.startedAt).toBe(2);
    expect(oscillator.stoppedAt).toBeCloseTo(2 + SOUND_SPECS.harvest.durationMs / 1000);
  });

  it("should glide to the end frequency and hold a flat cue's pitch", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);

    synth.play("pickup");
    synth.play("ui");

    const [gliding, flat] = factory.context!.oscillators;
    expect(gliding.frequency.setValues[0].value).toBe(SOUND_SPECS.pickup.frequency);
    expect(gliding.frequency.ramps[0].value).toBe(SOUND_SPECS.pickup.endFrequency);
    expect(flat.frequency.setValues[0].value).toBe(SOUND_SPECS.ui.frequency);
    expect(flat.frequency.ramps).toHaveLength(0);
  });

  it("should create no nodes at all while muted", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);

    synth.setMuted(true);
    synth.play("pickup");

    expect(factory.created).toBe(0);

    synth.setMuted(false);
    synth.play("pickup");

    expect(factory.context!.oscillators).toHaveLength(1);
  });

  it("should scale the scheduled peak gain by the master volume", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);

    synth.setVolume(0.5);
    synth.play("build");

    const peak = factory.context!.gains[0].gain.ramps[0].value;
    expect(peak).toBeCloseTo(SOUND_SPECS.build.gain * 0.5);
  });

  it("should treat zero and out-of-range volumes as silence", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);

    synth.setVolume(0);
    synth.play("build");
    synth.setVolume(-3);
    synth.play("build");
    synth.setVolume(Number.NaN);
    synth.play("build");

    expect(factory.created).toBe(0);

    // Above 1 clamps down rather than clipping the output
    synth.setVolume(4);
    synth.play("build");
    expect(factory.context!.gains[0].gain.ramps[0].value).toBeCloseTo(
      SOUND_SPECS.build.gain,
    );
  });

  it("should apply an extra gain scale to a scheduled tone", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);

    synth.playTone({
      waveform: "sine",
      frequency: 440,
      durationMs: 500,
      gain: 0.4,
      gainScale: 0.25,
      startAt: 3,
    });

    const context = factory.context!;
    expect(context.gains[0].gain.ramps[0].value).toBeCloseTo(0.1);
    expect(context.oscillators[0].startedAt).toBe(3);
  });

  it("should never schedule a tone in the past", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);
    synth.play("ui");
    factory.startAt(10);

    synth.playTone({
      waveform: "sine",
      frequency: 440,
      durationMs: 100,
      gain: 0.2,
      startAt: 1,
    });

    expect(factory.context!.oscillators[1].startedAt).toBe(10);
  });

  it("should resume a suspended context and create one if play never ran", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);
    factory.suspend();

    synth.resume();

    expect(factory.created).toBe(1);
    expect(factory.context!.resumed).toBe(1);
    expect(factory.context!.state).toBe("running");

    // Already running: nothing more to do
    synth.resume();
    expect(factory.context!.resumed).toBe(1);
  });

  it("should stay silent and keep working when the context cannot be created", () => {
    const synth = new SoundSynth(() => {
      throw new Error("no audio device");
    });

    expect(() => synth.play("ui")).not.toThrow();
    expect(synth.now()).toBeNull();
  });

  it("should close the context on destroy and tolerate a second call", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);
    synth.play("ui");

    synth.destroy();
    synth.destroy();

    expect(factory.context!.closed).toBe(1);
    expect(synth.now()).toBeNull();
  });

  it("should release the voice graph once the oscillator ends", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);
    synth.play("plant");

    const context = factory.context!;
    context.oscillators[0].onended?.();

    expect(context.oscillators[0].disconnected).toBe(1);
    expect(context.gains[0].disconnected).toBe(1);
  });
});

describe("audioStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAudioStore.setState({
      masterVolume: DEFAULT_MASTER_VOLUME,
      musicVolume: DEFAULT_MUSIC_VOLUME,
      muted: false,
      hydrated: false,
    });
  });

  it("should start on the defaults so the prerendered markup matches", () => {
    const state = useAudioStore.getState();
    expect(state.masterVolume).toBe(DEFAULT_MASTER_VOLUME);
    expect(state.musicVolume).toBe(DEFAULT_MUSIC_VOLUME);
    expect(state.muted).toBe(false);
    expect(state.hydrated).toBe(false);
  });

  it("should clamp and persist each volume", () => {
    useAudioStore.getState().setMasterVolume(1.5);
    useAudioStore.getState().setMusicVolume(-1);

    const state = useAudioStore.getState();
    expect(state.masterVolume).toBe(1);
    expect(state.musicVolume).toBe(0);
    expect(JSON.parse(window.localStorage.getItem(AUDIO_STORAGE_KEY)!)).toEqual({
      masterVolume: 1,
      musicVolume: 0,
      muted: false,
    });
  });

  it("should toggle and explicitly set mute", () => {
    useAudioStore.getState().toggleMuted();
    expect(useAudioStore.getState().muted).toBe(true);

    useAudioStore.getState().toggleMuted();
    expect(useAudioStore.getState().muted).toBe(false);

    useAudioStore.getState().setMuted(true);
    expect(useAudioStore.getState().muted).toBe(true);
    expect(
      JSON.parse(window.localStorage.getItem(AUDIO_STORAGE_KEY)!).muted,
    ).toBe(true);
  });

  it("should adopt the stored settings on hydrate", () => {
    window.localStorage.setItem(
      AUDIO_STORAGE_KEY,
      JSON.stringify({ masterVolume: 0.2, musicVolume: 0.1, muted: true }),
    );

    useAudioStore.getState().hydrate();

    const state = useAudioStore.getState();
    expect(state.masterVolume).toBe(0.2);
    expect(state.musicVolume).toBe(0.1);
    expect(state.muted).toBe(true);
    expect(state.hydrated).toBe(true);
  });

  it("should fall back to the defaults for missing or corrupt storage", () => {
    expect(readStoredAudio()).toEqual({
      masterVolume: DEFAULT_MASTER_VOLUME,
      musicVolume: DEFAULT_MUSIC_VOLUME,
      muted: false,
    });

    window.localStorage.setItem(AUDIO_STORAGE_KEY, "{not json");
    expect(readStoredAudio().masterVolume).toBe(DEFAULT_MASTER_VOLUME);

    window.localStorage.setItem(
      AUDIO_STORAGE_KEY,
      JSON.stringify({ masterVolume: "loud", muted: "yes" }),
    );
    expect(readStoredAudio()).toEqual({
      masterVolume: DEFAULT_MASTER_VOLUME,
      musicVolume: DEFAULT_MUSIC_VOLUME,
      muted: false,
    });
  });

  it("should clamp volumes read back from storage", () => {
    window.localStorage.setItem(
      AUDIO_STORAGE_KEY,
      JSON.stringify({ masterVolume: 9, musicVolume: -9, muted: false }),
    );

    expect(readStoredAudio().masterVolume).toBe(1);
    expect(readStoredAudio().musicVolume).toBe(0);
    expect(clampVolume(0.42)).toBe(0.42);
  });
});
