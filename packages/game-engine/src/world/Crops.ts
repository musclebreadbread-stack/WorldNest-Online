import type { ItemId } from "@worldnest/shared";

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
};

/** Whether an item can be sown on farmland. */
export function isSeed(itemId: ItemId): boolean {
  return CROP_DEFINITIONS[itemId] !== undefined;
}
