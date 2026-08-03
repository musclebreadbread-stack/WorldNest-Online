export {
  BIOME_FISH_TABLE,
  FISHING_BITE_MAX_MS,
  FISHING_BITE_MIN_MS,
  FISHING_ENERGY_COST,
  FISHING_WINDOW_MS,
} from "./fishingDefinitions";
export type { FishCatch } from "./fishingDefinitions";
export { canFish, randomBiteTime, reelIn, rollCatch, tickFishing } from "./fishingOps";
export type { FishingState } from "./fishingOps";
