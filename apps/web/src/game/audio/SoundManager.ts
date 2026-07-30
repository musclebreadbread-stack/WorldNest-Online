import Phaser from "phaser";
import type { OverlayContext, SceneOverlay } from "../SceneOverlay";
import { MusicLoop } from "./MusicLoop";
import { SoundSynth } from "./SoundSynth";
import {
  diffCues,
  readSoundState,
  NO_WORLD_COUNTS,
  type SoundState,
  type WorldCounts,
} from "./soundDiff";
import { useAudioStore } from "../../stores/audioStore";
import { useChatStore } from "../../stores/chatStore";

/**
 * SoundManager is the audio layer, registered like any other `SceneOverlay`.
 *
 * It plays nothing of its own accord: every frame it snapshots the game state,
 * diffs it against the previous frame and plays whatever that difference implies
 * (decision D10). That is why no ECS system knows audio exists, and why muting
 * is genuinely silent rather than a volume of zero — a muted `SoundSynth`
 * creates no nodes at all.
 */
export class SoundManager implements SceneOverlay {
  private scene: Phaser.Scene;
  private synth: SoundSynth;
  private music: MusicLoop;
  private counts: WorldCounts;
  private previous: SoundState | null = null;
  private unlocked = false;

  constructor(
    scene: Phaser.Scene,
    counts: WorldCounts = NO_WORLD_COUNTS,
    synth: SoundSynth = new SoundSynth(),
  ) {
    this.scene = scene;
    this.counts = counts;
    this.synth = synth;
    this.music = new MusicLoop(synth);

    // The scene only ever boots in a browser, so this is the first point at
    // which the stored volumes can be read without a hydration mismatch.
    useAudioStore.getState().hydrate();

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.unlock, this);
    scene.input.keyboard?.on(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.unlock,
      this,
    );
  }

  update(ctx: OverlayContext): void {
    const { masterVolume, musicVolume, muted } = useAudioStore.getState();
    this.synth.setMuted(muted);
    this.synth.setVolume(masterVolume);

    const next = readSoundState(
      ctx.playerEntity,
      ctx.buildMode,
      useChatStore.getState().received,
      ctx.phase,
      this.counts,
    );
    for (const cue of diffCues(this.previous, next)) {
      this.synth.play(cue);
    }
    this.previous = next;

    this.music.update(ctx.deltaMs, ctx.phase, muted ? 0 : musicVolume);
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.unlock, this);
    this.scene.input.keyboard?.off(
      Phaser.Input.Keyboard.Events.ANY_KEY_DOWN,
      this.unlock,
      this,
    );
    this.music.destroy();
    this.synth.destroy();
  }

  /**
   * Every browser refuses to start an `AudioContext` outside a user gesture, so
   * the game is silent until the first click or keypress. That is a platform
   * rule, not a bug, and `docs/SETUP_GUIDE_KR.md` says so in the troubleshooting
   * table.
   */
  private unlock(): void {
    if (this.unlocked) return;

    this.unlocked = true;
    this.synth.resume();
  }
}
