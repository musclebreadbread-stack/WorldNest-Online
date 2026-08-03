/**
 * Music / rhythm mini-game state types.
 *
 * Pure data definitions for the state machine. No logic lives here.
 */

/** Phases of the music mini-game state machine. */
export type MusicState = "idle" | "playing" | "composing" | "complete";

/** Rating of a single note hit attempt. */
export type RhythmResult = "perfect" | "good" | "miss";

/** Aggregated performance metrics for a completed song. */
export interface PerformanceScore {
  perfectCount: number;
  goodCount: number;
  missCount: number;
  maxCombo: number;
  totalScore: number;
}
