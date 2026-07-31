import type { ItemId } from "@worldnest/shared";
import type { Biome } from "./Biomes";
import type { Season } from "./Seasons";

/**
 * What a seed grows into. Keyed by the seed item so both planting and the
 * persistence layer only have to store the seed id plus the plant time.
 */
export interface CropDefinition {
  /** Item harvesting the mature crop yields. */
  produceItemId: ItemId;
  produceQuantity: number;
  /** Number of growth stages; the last one is the mature stage. */
  stageCount: number;
  /** Game minutes spent in each stage. */
  minutesPerStage: number;
  /** Texture key prefix; the renderer appends `_<stage>`. */
  textureKey: string;
  /** Biomes where this crop can be sown. Empty means any biome (wheat). */
  biomes?: readonly Biome[];
  /** Seasons in which this crop can be sown. Empty means any season. */
  seasons?: readonly Season[];
}

/**
 * Crop catalogue. Growth is measured in game minutes off the shared world clock,
 * so every client sees the same stage without server coordination.
 */
export const CROP_DEFINITIONS: Partial<Record<ItemId, CropDefinition>> = {
  wheat_seed: {
    produceItemId: "wheat",
    produceQuantity: 2,
    stageCount: 4,
    minutesPerStage: 30,
    textureKey: "crop_wheat",
  },
  carrot_seed: {
    produceItemId: "carrot",
    produceQuantity: 2,
    stageCount: 4,
    minutesPerStage: 40,
    textureKey: "crop_carrot",
    biomes: [0, 1, 2], // Tundra, Taiga, Grassland (cool)
    seasons: [0, 2, 3], // Spring, Autumn, Winter (not summer)
  },
  melon_seed: {
    produceItemId: "melon",
    produceQuantity: 2,
    stageCount: 4,
    minutesPerStage: 50,
    textureKey: "crop_melon",
    biomes: [3, 4, 5], // Forest, Savanna, Desert (hot)
    seasons: [0, 1, 2], // Spring, Summer, Autumn (not winter)
  },
};

/** Whether an item can be sown on farmland. */
export function isSeed(itemId: ItemId): boolean {
  return CROP_DEFINITIONS[itemId] !== undefined;
}
