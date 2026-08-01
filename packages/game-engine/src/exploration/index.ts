export {
  BIOME_DISCOVERY_REWARDS,
  LANDMARK_DEFINITIONS,
  LANDMARK_IDS,
  getLandmark,
} from "./explorationDefinitions";
export type { LandmarkDefinition } from "./explorationDefinitions";
export {
  discoverBiome,
  discoverLandmark,
  getExplorationReward,
  getMapCompletion,
  getNextMilestoneKey,
  recordTilesExplored,
} from "./explorationOps";
export type { ExplorationState } from "./explorationOps";
