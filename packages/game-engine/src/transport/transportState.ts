/**
 * Transportation system state types.
 *
 * Pure data definitions for the transport state machine. No logic lives here.
 */

/** Current mode of transportation. */
export type TransportMode = "walking" | "mounted" | "boating";

/** Persistent state of the player's active mount. */
export interface MountState {
  /** The species currently being ridden. */
  species: string;
  /** Current stamina (drains while riding). */
  stamina: number;
  /** Maximum stamina for this mount. */
  maxStamina: number;
  /** Bond level (0, 1, or 2) derived from feedCount. */
  bondLevel: number;
  /** Total number of times this mount has been fed. */
  feedCount: number;
}
