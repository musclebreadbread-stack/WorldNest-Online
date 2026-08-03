import { Component } from "../ecs/Component";
import type { InstrumentType, RhythmNote } from "../music";
import type { MusicState, PerformanceScore } from "../music/musicState";

/**
 * Music / rhythm mini-game state for an entity.
 *
 * Tracks the current phase, song progress, combo state, and performance
 * metrics. Pure data by design: all transitions live in `musicOps.ts`
 * and `MusicSystem.ts`.
 */
export class MusicComponent extends Component {
  /** Current phase of the music state machine. */
  public state: MusicState;
  /** Active song id when playing. */
  public currentSongId: string | null;
  /** Milliseconds elapsed since song start. */
  public songTimer: number;
  /** Index of the next note to evaluate. */
  public noteIndex: number;
  /** Current consecutive hit streak. */
  public combo: number;
  /** Highest combo reached in the current song. */
  public maxCombo: number;
  /** Running performance counters. */
  public perfectCount: number;
  public goodCount: number;
  public missCount: number;
  /** Instrument the player is using. */
  public instrument: InstrumentType | null;
  /** Player-composed melody (composition mode). */
  public composedMelody: RhythmNote[];
  /** Running score accumulated with combo multipliers during gameplay. */
  public hitScore: number;
  /** Cached final score after completion. */
  public lastScore: PerformanceScore | null;
  /** Set to true by the UI to signal a hit attempt. */
  public requestHit: boolean;
  /** Lane of the requested hit (0-3). */
  public requestHitLane: number;
  /** Bumped on every state change. */
  public version: number;

  constructor() {
    super("music");
    this.state = "idle";
    this.currentSongId = null;
    this.songTimer = 0;
    this.noteIndex = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.instrument = null;
    this.composedMelody = [];
    this.hitScore = 0;
    this.lastScore = null;
    this.requestHit = false;
    this.requestHitLane = 0;
    this.version = 0;
  }
}
