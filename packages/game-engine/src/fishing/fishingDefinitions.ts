import type { ItemId } from "@worldnest/shared";
import { Biome } from "../world/Biomes";

/**
 * A single entry in a biome's catch table. `weight` controls how likely this
 * fish is relative to the other entries in the same table (0-100 scale, where
 * higher means more likely).
 */
export interface FishCatch {
  itemId: ItemId;
  weight: number;
}

/** Energy spent per cast, regardless of outcome. */
export const FISHING_ENERGY_COST = 8;

/** Minimum wall-clock milliseconds before a fish bites after casting. */
export const FISHING_BITE_MIN_MS = 2000;

/** Maximum wall-clock milliseconds before a fish bites after casting. */
export const FISHING_BITE_MAX_MS = 5000;

/** Milliseconds the player has to press E once a fish bites. */
export const FISHING_WINDOW_MS = 1500;

/**
 * Biome-specific catch tables. Tropical fish only appear in warm biomes
 * (savanna and desert), rare fish are less common everywhere, and common fish
 * are the fallback in every biome.
 */
export const BIOME_FISH_TABLE: Record<Biome, FishCatch[]> = {
  [Biome.TUNDRA]: [
    { itemId: "fish_common", weight: 70 },
    { itemId: "fish_rare", weight: 30 },
  ],
  [Biome.TAIGA]: [
    { itemId: "fish_common", weight: 65 },
    { itemId: "fish_rare", weight: 35 },
  ],
  [Biome.GRASSLAND]: [
    { itemId: "fish_common", weight: 60 },
    { itemId: "fish_rare", weight: 40 },
  ],
  [Biome.FOREST]: [
    { itemId: "fish_common", weight: 55 },
    { itemId: "fish_rare", weight: 45 },
  ],
  [Biome.SAVANNA]: [
    { itemId: "fish_common", weight: 40 },
    { itemId: "fish_rare", weight: 30 },
    { itemId: "fish_tropical", weight: 30 },
  ],
  [Biome.DESERT]: [
    { itemId: "fish_common", weight: 35 },
    { itemId: "fish_rare", weight: 30 },
    { itemId: "fish_tropical", weight: 35 },
  ],
};
