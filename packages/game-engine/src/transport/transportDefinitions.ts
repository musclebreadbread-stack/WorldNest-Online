/**
 * Transportation system definitions.
 *
 * Contains mount species, speed multipliers, stamina constants, and
 * boat configuration. Every player-visible string is an i18n key
 * (decision D8).
 */

/** The three rideable mount species. */
export type MountSpecies = "horse" | "donkey" | "camel";

/** Definition of a single mount species. */
export interface MountDefinition {
  species: MountSpecies;
  /** Movement speed multiplier when riding this mount. */
  speedMultiplier: number;
  /** Maximum stamina the mount can have. */
  stamina: number;
  /** Item required to feed this mount (restores stamina + bond). */
  feedItem: string;
}

/** Definitions for all mount species. */
export const MOUNT_DEFINITIONS: Record<MountSpecies, MountDefinition> = {
  horse: {
    species: "horse",
    speedMultiplier: 2.0,
    stamina: 100,
    feedItem: "animal_feed",
  },
  donkey: {
    species: "donkey",
    speedMultiplier: 1.5,
    stamina: 150,
    feedItem: "animal_feed",
  },
  camel: {
    species: "camel",
    speedMultiplier: 1.8,
    stamina: 120,
    feedItem: "animal_feed",
  },
};

/** Speed multiplier when travelling by boat. */
export const BOAT_SPEED_MULTIPLIER = 1.5;

/** Stamina drained per second while mounted. */
export const MOUNT_STAMINA_DRAIN_PER_SECOND = 2;

/** Stamina restored per feed action. */
export const MOUNT_FEED_RESTORE = 30;

/** All mount species in definition order. */
export const MOUNT_SPECIES: readonly MountSpecies[] = ["horse", "donkey", "camel"];
