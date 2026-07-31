/**
 * Transportation system pure operations.
 *
 * All functions are pure: no side effects, no mutations. The system
 * layer calls these and writes the results to the component.
 */

import type { InventoryComponent } from "../components/InventoryComponent";
import { countItem } from "../inventory/inventoryOps";
import type { ItemId } from "@worldnest/shared";
import {
  BOAT_SPEED_MULTIPLIER,
  MOUNT_DEFINITIONS,
  MOUNT_FEED_RESTORE,
  MOUNT_STAMINA_DRAIN_PER_SECOND,
  type MountSpecies,
} from "./transportDefinitions";
import type { MountState, TransportMode } from "./transportState";

/** Whistle items that summon a specific mount species. */
const WHISTLE_TO_SPECIES: Record<string, MountSpecies> = {
  horse_whistle: "horse",
  donkey_whistle: "donkey",
  camel_whistle: "camel",
};

/**
 * Whether the player can mount. Requires a mount whistle and a saddle
 * in inventory.
 */
export function canMount(inventory: InventoryComponent): MountSpecies | null {
  if (countItem(inventory, "mount_saddle" as ItemId) < 1) return null;
  for (const [whistle, species] of Object.entries(WHISTLE_TO_SPECIES)) {
    if (countItem(inventory, whistle as ItemId) >= 1) {
      return species;
    }
  }
  return null;
}

/**
 * Whether the player can board a boat.
 * Requires a boat item in inventory and the faced tile to be water.
 */
export function canBoard(inventory: InventoryComponent, facingWater: boolean): boolean {
  return countItem(inventory, "boat" as ItemId) >= 1 && facingWater;
}

/** Create the initial mount state when mounting. */
export function mount(species: MountSpecies): MountState {
  const def = MOUNT_DEFINITIONS[species];
  return {
    species: def.species,
    stamina: def.stamina,
    maxStamina: def.stamina,
    bondLevel: 0,
    feedCount: 0,
  };
}

/** Dismount, returning walking mode. */
export function dismount(): TransportMode {
  return "walking";
}

/**
 * Drain mount stamina over the given delta (in seconds).
 * Returns the updated stamina value, clamped to 0.
 */
export function tickMountStamina(currentStamina: number, deltaSeconds: number): number {
  const drain = MOUNT_STAMINA_DRAIN_PER_SECOND * deltaSeconds;
  return Math.max(0, currentStamina - drain);
}

/**
 * Feed a mount to restore stamina and increase bond.
 * Returns updated mount state. Does NOT consume the item (system does that).
 */
export function feedMount(state: MountState): MountState {
  const newStamina = Math.min(state.maxStamina, state.stamina + MOUNT_FEED_RESTORE);
  const newFeedCount = state.feedCount + 1;
  return {
    ...state,
    stamina: newStamina,
    feedCount: newFeedCount,
    bondLevel: getMountBondLevel(newFeedCount),
  };
}

/**
 * Calculate movement speed multiplier based on transport mode and mount.
 */
export function calculateSpeed(
  mode: TransportMode,
  mountState: MountState | null,
): number {
  if (mode === "boating") return BOAT_SPEED_MULTIPLIER;
  if (mode === "mounted" && mountState) {
    const def = MOUNT_DEFINITIONS[mountState.species as MountSpecies];
    return def ? def.speedMultiplier : 1;
  }
  return 1;
}

/** Whether the mount is exhausted (stamina depleted). */
export function isMountExhausted(mountState: MountState): boolean {
  return mountState.stamina <= 0;
}

/**
 * Derive bond level from feed count.
 * 0 feeds = level 0, 5+ feeds = level 1, 15+ feeds = level 2.
 */
export function getMountBondLevel(feedCount: number): number {
  if (feedCount >= 15) return 2;
  if (feedCount >= 5) return 1;
  return 0;
}

/** Whether the boat can traverse a given tile (water only). */
export function boatCanTraverse(isWaterTile: boolean): boolean {
  return isWaterTile;
}
