import { describe, it, expect, beforeEach } from "vitest";
import type {
  DialogueComponent,
  InventoryComponent,
  StatsComponent,
} from "@worldnest/game-engine";
import { addItem, openDialogue } from "@worldnest/game-engine";
import { SOUND_CUES, SOUND_SPECS } from "../game/audio/soundSpecs";
import { SoundSynth } from "../game/audio/SoundSynth";
import {
  CHORD_INTERVAL_MS,
  MUSIC_PROGRESSIONS,
  MusicLoop,
  moodForPhase,
} from "../game/audio/MusicLoop";
import {
  ENERGY_DROP_EPSILON,
  diffCues,
  readSoundState,
  type SoundState,
} from "../game/audio/soundDiff";
import {
  createGameWorld,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
} from "../game/createGameWorld";
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

const QUIET: SoundState = {
  inventoryVersion: 4,
  energy: 80,
  buildMode: false,
  chatCount: 2,
  dialogueVersion: 6,
  shopVersion: 3,
  questVersion: 2,
  refusalCount: 1,
  phase: "day",
};

describe("diffCues", () => {
  it("should emit nothing for the first snapshot of a session", () => {
    // At boot the restored inventory and energy differ from every default, so a
    // naive diff would fire a burst of cues over the loading screen.
    expect(diffCues(null, QUIET)).toEqual([]);
  });

  it("should emit nothing when nothing changed", () => {
    expect(diffCues(QUIET, { ...QUIET })).toEqual([]);
  });

  it("should emit pickup for an inventory version bump", () => {
    expect(diffCues(QUIET, { ...QUIET, inventoryVersion: 5 })).toEqual(["pickup"]);
  });

  it("should ignore an inventory version that went backwards", () => {
    expect(diffCues(QUIET, { ...QUIET, inventoryVersion: 1 })).toEqual([]);
  });

  it("should emit harvest for an energy drop", () => {
    expect(diffCues(QUIET, { ...QUIET, energy: 70 })).toEqual(["harvest"]);
  });

  it("should ignore energy regenerating and floating-point noise", () => {
    expect(diffCues(QUIET, { ...QUIET, energy: 90 })).toEqual([]);
    expect(
      diffCues(QUIET, { ...QUIET, energy: QUIET.energy - ENERGY_DROP_EPSILON / 2 }),
    ).toEqual([]);
  });

  it("should layer harvest and pickup when a tile pays out", () => {
    // Harvesting spends energy and adds an item in the same frame
    expect(
      diffCues(QUIET, { ...QUIET, energy: 72, inventoryVersion: 5 }),
    ).toEqual(["harvest", "pickup"]);
  });

  it("should emit ui for a build-mode toggle in either direction", () => {
    expect(diffCues(QUIET, { ...QUIET, buildMode: true })).toEqual(["ui"]);
    expect(
      diffCues({ ...QUIET, buildMode: true }, { ...QUIET, buildMode: false }),
    ).toEqual(["ui"]);
  });

  it("should emit ui for a chat arrival but not for the log shrinking", () => {
    expect(diffCues(QUIET, { ...QUIET, chatCount: 3 })).toEqual(["ui"]);
    expect(diffCues(QUIET, { ...QUIET, chatCount: 1 })).toEqual([]);
  });

  it("should emit ui only once when build mode and chat both change", () => {
    expect(
      diffCues(QUIET, { ...QUIET, buildMode: true, chatCount: 9 }),
    ).toEqual(["ui"]);
  });

  it("should emit dialogue for a conversation opening, moving on or ending", () => {
    expect(diffCues(QUIET, { ...QUIET, dialogueVersion: 7 })).toEqual(["dialogue"]);
    // A version can only go up; nothing to say if it did not
    expect(diffCues(QUIET, { ...QUIET, dialogueVersion: 6 })).toEqual([]);
  });

  it("should emit shop for a trade or for the shop panel opening", () => {
    expect(diffCues(QUIET, { ...QUIET, shopVersion: 4 })).toEqual(["shop"]);
    expect(diffCues(QUIET, { ...QUIET, shopVersion: 3 })).toEqual([]);
  });

  it("should emit quest for a quest taken on, progressed or handed in", () => {
    expect(diffCues(QUIET, { ...QUIET, questVersion: 3 })).toEqual(["quest"]);
    expect(diffCues(QUIET, { ...QUIET, questVersion: 2 })).toEqual([]);
  });

  it("should emit deny for a request the engine turned down", () => {
    expect(diffCues(QUIET, { ...QUIET, refusalCount: 2 })).toEqual(["deny"]);
    expect(diffCues(QUIET, { ...QUIET, refusalCount: 1 })).toEqual([]);
  });

  it("should not emit anything for a phase change on its own", () => {
    // The phase steers the music's key; it is not an event worth a chime
    expect(diffCues(QUIET, { ...QUIET, phase: "night" })).toEqual([]);
  });
});

describe("readSoundState", () => {
  const BOOTSTRAP = {
    playerId: "user-1",
    username: "Tester",
    spawnX: DEFAULT_SPAWN_X,
    spawnY: DEFAULT_SPAWN_Y,
  };

  it("should read the live inventory version and energy off the player", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const inventory = playerEntity.getComponent<InventoryComponent>("inventory")!;
    const stats = playerEntity.getComponent<StatsComponent>("stats")!;

    const before = readSoundState(playerEntity, false, 0, "day");
    expect(before.inventoryVersion).toBe(inventory.version);
    expect(before.energy).toBe(stats.energy);
    expect(before.dialogueVersion).toBe(0);

    addItem(inventory, "wood", 1);
    stats.energy -= 10;

    const after = readSoundState(playerEntity, true, 3, "dusk");
    expect(after.inventoryVersion).toBeGreaterThan(before.inventoryVersion);
    expect(diffCues(before, after)).toEqual(["harvest", "pickup", "ui"]);
    expect(after.buildMode).toBe(true);
    expect(after.chatCount).toBe(3);
    expect(after.phase).toBe("dusk");
  });

  it("should hear a conversation through the dialogue component's version", () => {
    const { playerEntity } = createGameWorld(BOOTSTRAP);
    const dialogue = playerEntity.getComponent<DialogueComponent>("dialogue")!;

    const before = readSoundState(playerEntity, false, 0, "day");
    openDialogue(dialogue, "villager_pip", "pip_welcome");
    const after = readSoundState(playerEntity, false, 0, "day");

    expect(after.dialogueVersion).toBe(dialogue.version);
    expect(diffCues(before, after)).toEqual(["dialogue"]);
  });
});

describe("MusicLoop", () => {
  it("should pick a bright key for daylight and a low one for the evening", () => {
    expect(moodForPhase("dawn")).toBe("bright");
    expect(moodForPhase("day")).toBe("bright");
    expect(moodForPhase("dusk")).toBe("low");
    expect(moodForPhase("night")).toBe("low");
  });

  it("should hold four chords per key, each below the other", () => {
    for (const mood of ["bright", "low"] as const) {
      const progression = MUSIC_PROGRESSIONS[mood];
      expect(progression, mood).toHaveLength(4);

      for (const chord of progression) {
        expect(chord.length, mood).toBeGreaterThanOrEqual(3);
        for (const frequency of chord) {
          expect(frequency, mood).toBeGreaterThan(0);
        }
      }
    }

    // The evening key really is lower, which is the whole point of two moods
    expect(MUSIC_PROGRESSIONS.low[0][0]).toBeLessThan(MUSIC_PROGRESSIONS.bright[0][0]);
  });

  it("should stay silent until a gesture has unlocked the context", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);
    const music = new MusicLoop(synth);

    music.update(CHORD_INTERVAL_MS, "day", 1);

    expect(factory.created).toBe(0);
  });

  it("should schedule one voice per note of a chord, once per bar", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);
    synth.resume();
    const music = new MusicLoop(synth);

    music.update(16, "day", 1);
    const voices = MUSIC_PROGRESSIONS.bright[0].length;
    expect(factory.context!.oscillators).toHaveLength(voices);

    // Mid-bar frames add nothing
    music.update(CHORD_INTERVAL_MS / 2, "day", 1);
    expect(factory.context!.oscillators).toHaveLength(voices);

    music.update(CHORD_INTERVAL_MS, "day", 1);
    expect(factory.context!.oscillators.length).toBeGreaterThan(voices);
  });

  it("should walk the progression and wrap back to the root", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);
    synth.resume();
    const music = new MusicLoop(synth);
    const progression = MUSIC_PROGRESSIONS.bright;

    for (let bar = 0; bar < progression.length + 1; bar++) {
      music.update(CHORD_INTERVAL_MS, "day", 1);
    }

    const root = progression[0][0];
    const roots = factory.context!.oscillators.filter(
      (o) => o.frequency.setValues[0].value === root,
    );
    // The root chord was played on the first bar and again after wrapping
    expect(roots).toHaveLength(2);
  });

  it("should restart at the root when the day phase changes key", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);
    synth.resume();
    const music = new MusicLoop(synth);

    music.update(CHORD_INTERVAL_MS, "day", 1);
    music.update(CHORD_INTERVAL_MS, "day", 1);
    const before = factory.context!.oscillators.length;

    music.update(16, "night", 1);

    const played = factory.context!.oscillators.slice(before);
    expect(played.map((o) => o.frequency.setValues[0].value)).toEqual([
      ...MUSIC_PROGRESSIONS.low[0],
    ]);
  });

  it("should create no nodes at zero music volume but keep the beat", () => {
    const factory = fakeContextFactory();
    const synth = new SoundSynth(factory.create);
    synth.resume();
    const music = new MusicLoop(synth);

    music.update(CHORD_INTERVAL_MS, "day", 0);
    expect(factory.context!.oscillators).toHaveLength(0);

    // The bar still advanced, so the music picks up mid-progression rather than
    // restarting every time the player nudges the slider
    music.update(CHORD_INTERVAL_MS, "day", 1);
    const played = factory.context!.oscillators.map(
      (o) => o.frequency.setValues[0].value,
    );
    expect(played).toEqual([...MUSIC_PROGRESSIONS.bright[1]]);
  });

  it("should scale the chord gain by the music volume", () => {
    const loud = fakeContextFactory();
    const quiet = fakeContextFactory();
    const loudMusic = new MusicLoop(unlocked(loud));
    const quietMusic = new MusicLoop(unlocked(quiet));

    loudMusic.update(CHORD_INTERVAL_MS, "day", 1);
    quietMusic.update(CHORD_INTERVAL_MS, "day", 0.25);

    const loudPeak = loud.context!.gains[0].gain.ramps[0].value;
    const quietPeak = quiet.context!.gains[0].gain.ramps[0].value;
    expect(quietPeak).toBeCloseTo(loudPeak * 0.25);
  });

  it("should hold each chord past the start of the next one", () => {
    const factory = fakeContextFactory();
    const music = new MusicLoop(unlocked(factory));

    music.update(CHORD_INTERVAL_MS, "day", 1);

    const [voice] = factory.context!.oscillators;
    // A gap between bars would make the pad pulse instead of drone
    expect(voice.stoppedAt! - voice.startedAt!).toBeGreaterThan(
      CHORD_INTERVAL_MS / 1000,
    );
  });
});

/** A synth whose context has already been unlocked by a "gesture". */
function unlocked(factory: ReturnType<typeof fakeContextFactory>): SoundSynth {
  const synth = new SoundSynth(factory.create);
  synth.resume();
  return synth;
}
