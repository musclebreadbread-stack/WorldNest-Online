import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import type { MusicComponent } from "../components/MusicComponent";
import type { InventoryComponent } from "../components/InventoryComponent";
import type { WalletComponent } from "../components/WalletComponent";
import { canStartRhythm, completeSong, hitNote, tickRhythm } from "../music";
import { getSong } from "../music/musicDefinitions";

/** Called when a song performance is completed. */
export type MusicCompleteListener = () => void;

/**
 * MusicSystem processes the rhythm mini-game state machine.
 *
 * - Advances the song timer during the `playing` state
 * - Evaluates note hit attempts against timing windows
 * - Tracks combo, perfect/good/miss counts
 * - Awards coins on song completion
 * - Transitions through idle -> playing -> complete -> idle
 */
export class MusicSystem extends System {
  private onComplete?: MusicCompleteListener;

  constructor(onComplete?: MusicCompleteListener) {
    super(["inventory", "music", "wallet"]);
    this.onComplete = onComplete;
  }

  update(entities: Entity[], deltaTime: number): void {
    const deltaMs = deltaTime * 1000;

    for (const entity of entities) {
      const music = entity.getComponent<MusicComponent>("music")!;

      if (music.state === "playing") {
        this.updatePlaying(entity, music, deltaMs);
      }

      // Reset complete state after one frame
      if (music.state === "complete") {
        music.state = "idle";
        music.currentSongId = null;
        music.songTimer = 0;
        music.noteIndex = 0;
        music.combo = 0;
        music.maxCombo = 0;
        music.perfectCount = 0;
        music.goodCount = 0;
        music.missCount = 0;
        music.version++;
      }
    }
  }

  private updatePlaying(entity: Entity, music: MusicComponent, deltaMs: number): void {
    const inventory = entity.getComponent<InventoryComponent>("inventory")!;

    if (!canStartRhythm(inventory)) {
      music.state = "idle";
      music.version++;
      return;
    }

    const song = getSong(music.currentSongId ?? "");
    if (!song) {
      music.state = "idle";
      music.version++;
      return;
    }

    const lastTime = music.songTimer;
    music.songTimer += deltaMs;

    // Process hit request
    if (music.requestHit) {
      music.requestHit = false;
      this.processHit(music, song.notes);
    }

    // Check for missed notes (notes that passed the good window)
    this.checkMissedNotes(music, song.notes);

    // Check if the song ended
    const { songEnded } = tickRhythm(song.notes, lastTime, music.songTimer);
    if (songEnded && music.noteIndex >= song.notes.length) {
      this.finishSong(entity, music);
    }
  }

  private processHit(
    music: MusicComponent,
    notes: readonly { timing: number; lane: number }[],
  ): void {
    // Find the closest unprocessed note in the requested lane
    let bestIdx = -1;
    let bestDiff = Infinity;
    for (let i = music.noteIndex; i < notes.length; i++) {
      const note = notes[i];
      if (note.lane !== music.requestHitLane) continue;
      const diff = Math.abs(music.songTimer - note.timing);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
      // Notes are sorted by timing; if we are past the good window, stop
      if (note.timing > music.songTimer + 200) break;
    }

    if (bestIdx < 0) {
      // No valid note to hit - count as miss
      music.combo = 0;
      music.missCount++;
      return;
    }

    const result = hitNote(music.songTimer, notes[bestIdx].timing);
    if (result === "perfect") {
      music.perfectCount++;
      music.combo++;
    } else if (result === "good") {
      music.goodCount++;
      music.combo++;
    } else {
      music.missCount++;
      music.combo = 0;
    }

    if (music.combo > music.maxCombo) {
      music.maxCombo = music.combo;
    }

    // Skip processed note if it is the next in sequence
    if (bestIdx === music.noteIndex) {
      music.noteIndex++;
    }
  }

  private checkMissedNotes(
    music: MusicComponent,
    notes: readonly { timing: number; lane: number }[],
  ): void {
    // Any note whose timing + good window is past the current time is missed
    while (music.noteIndex < notes.length) {
      const note = notes[music.noteIndex];
      if (music.songTimer > note.timing + 200) {
        music.missCount++;
        music.combo = 0;
        music.noteIndex++;
      } else {
        break;
      }
    }
  }

  private finishSong(entity: Entity, music: MusicComponent): void {
    const wallet = entity.getComponent<WalletComponent>("wallet")!;
    const { score, coins } = completeSong(
      music.perfectCount,
      music.goodCount,
      music.missCount,
      music.maxCombo,
    );
    music.lastScore = score;
    wallet.coins += coins;
    music.state = "complete";
    music.version++;
    this.onComplete?.();
  }
}
