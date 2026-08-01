/**
 * Friendship system state types.
 *
 * Pure data definitions for the friendship state. No logic lives here.
 */

/** Persistent state of a single NPC friendship. */
export interface FriendshipEntry {
  /** NPC this entry tracks. */
  npcId: string;
  /** Accumulated friendship points (never decreases). */
  points: number;
  /** Current friendship level (0-4). */
  level: number;
  /** The in-game day when the last gift was given. */
  lastGiftDay: number;
  /** Number of gifts given today (resets on day change). */
  giftsGivenToday: number;
}
