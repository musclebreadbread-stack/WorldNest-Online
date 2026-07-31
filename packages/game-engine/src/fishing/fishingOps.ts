import type { ItemId } from "@worldnest/shared";
import type { InventoryComponent } from "../components/InventoryComponent";
import type { StatsComponent } from "../components/StatsComponent";
import { countItem, hasSpaceFor } from "../inventory/inventoryOps";
import { TileType } from "../world/Tilemap";
import {
  BIOME_FISH_TABLE,
  FISHING_BITE_MAX_MS,
  FISHING_BITE_MIN_MS,
  FISHING_ENERGY_COST,
  FISHING_WINDOW_MS,
} from "./fishingDefinitions";
import type { Biome } from "../world/Biomes";

/** All states the fishing state machine can be in. */
export type FishingState =
  "idle" | "casting" | "waiting" | "biting" | "reeling" | "caught" | "missed";

/**
 * Whether the player can start fishing right now.
 *
 * Requirements:
 * - Holding a fishing rod (at least one in inventory)
 * - Facing a water tile
 * - Has enough energy
 * - Has inventory space for at least one fish
 */
export function canFish(
  inventory: InventoryComponent,
  stats: StatsComponent,
  facedTileType: TileType,
): boolean {
  if (facedTileType !== TileType.WATER) return false;
  if (countItem(inventory, "fishing_rod") < 1) return false;
  if (stats.energy < FISHING_ENERGY_COST) return false;
  // Must have space for at least one of the possible catches
  if (
    !hasSpaceFor(inventory, "fish_common", 1) &&
    !hasSpaceFor(inventory, "fish_rare", 1) &&
    !hasSpaceFor(inventory, "fish_tropical", 1)
  ) {
    return false;
  }
  return true;
}

/**
 * Roll a catch from the biome's fish table using a random value in [0, 1).
 * Uses weighted selection: items with higher weights are more likely.
 */
export function rollCatch(biome: Biome, rng: number): ItemId {
  const table = BIOME_FISH_TABLE[biome];
  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng * totalWeight;

  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry.itemId;
  }

  // Fallback to last entry (should not happen with valid rng)
  return table[table.length - 1].itemId;
}

/**
 * Generate a random bite time between FISHING_BITE_MIN_MS and
 * FISHING_BITE_MAX_MS using the provided random value in [0, 1).
 */
export function randomBiteTime(rng: number): number {
  return FISHING_BITE_MIN_MS + rng * (FISHING_BITE_MAX_MS - FISHING_BITE_MIN_MS);
}

/**
 * Advance the fishing timer. Returns the next state based on elapsed time.
 *
 * - In `waiting`: if timer >= biteTime, transitions to `biting`
 * - In `biting`: if timer >= FISHING_WINDOW_MS, transitions to `missed`
 * - Other states are not time-driven
 */
export function tickFishing(
  state: FishingState,
  timer: number,
  deltaMs: number,
  biteTime: number,
): { state: FishingState; timer: number } {
  const newTimer = timer + deltaMs;

  if (state === "waiting" && newTimer >= biteTime) {
    return { state: "biting", timer: 0 };
  }

  if (state === "biting" && newTimer >= FISHING_WINDOW_MS) {
    return { state: "missed", timer: newTimer };
  }

  return { state, timer: newTimer };
}

/**
 * Attempt to reel in.
 *
 * - If state is `biting` and timer is within the window: success
 * - If state is `waiting` (pressed too early): too_early
 * - Otherwise (timer exceeded or wrong state): too_late
 */
export function reelIn(
  state: FishingState,
  timer: number,
): "success" | "too_early" | "too_late" {
  if (state === "biting" && timer < FISHING_WINDOW_MS) {
    return "success";
  }
  if (state === "waiting") {
    return "too_early";
  }
  return "too_late";
}
