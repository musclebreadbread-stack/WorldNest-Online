/**
 * Pure functions for exploration state management.
 *
 * Follows the same ops-separate-from-system pattern as fishingOps, questOps,
 * etc. All functions are side-effect-free and testable without an ECS world.
 */

import { Biome } from "../world/Biomes";

/** Minimal state shape the exploration ops need. */
export interface ExplorationState {
  discoveredBiomes: Set<Biome>;
  discoveredLandmarks: Set<string>;
  mapTilesExplored: number;
  totalMapTiles: number;
  version: number;
}

/**
 * Record that a biome was discovered.
 * Returns true if the biome was newly discovered, false if already known.
 */
export function discoverBiome(state: ExplorationState, biome: Biome): boolean {
  if (state.discoveredBiomes.has(biome)) return false;
  state.discoveredBiomes.add(biome);
  state.version++;
  return true;
}

/**
 * Record that a landmark was discovered.
 * Returns true if the landmark was newly discovered, false if already known.
 */
export function discoverLandmark(state: ExplorationState, landmarkId: string): boolean {
  if (state.discoveredLandmarks.has(landmarkId)) return false;
  state.discoveredLandmarks.add(landmarkId);
  state.version++;
  return true;
}

/**
 * Get map completion as a percentage (0-100).
 */
export function getMapCompletion(state: ExplorationState): number {
  if (state.totalMapTiles <= 0) return 0;
  return Math.min(
    100,
    Math.floor((state.mapTilesExplored / state.totalMapTiles) * 100),
  );
}

/** Milestone thresholds and their coin rewards. */
const MILESTONE_REWARDS: readonly { percent: number; coins: number }[] = [
  { percent: 25, coins: 25 },
  { percent: 50, coins: 50 },
  { percent: 75, coins: 75 },
  { percent: 100, coins: 100 },
];

/**
 * Get the exploration reward for the highest unclaimed milestone.
 * Returns the coins for the next unclaimed milestone that has been reached,
 * or 0 if no new milestone is available.
 */
export function getExplorationReward(
  state: ExplorationState,
  claimedMilestones: Set<string>,
): number {
  const completion = getMapCompletion(state);
  for (const milestone of MILESTONE_REWARDS) {
    const key = `milestone_${milestone.percent}`;
    if (completion >= milestone.percent && !claimedMilestones.has(key)) {
      return milestone.coins;
    }
  }
  return 0;
}

/**
 * Get the milestone key for the next unclaimed milestone that has been reached.
 * Returns null if no new milestone is available.
 */
export function getNextMilestoneKey(
  state: ExplorationState,
  claimedMilestones: Set<string>,
): string | null {
  const completion = getMapCompletion(state);
  for (const milestone of MILESTONE_REWARDS) {
    const key = `milestone_${milestone.percent}`;
    if (completion >= milestone.percent && !claimedMilestones.has(key)) {
      return key;
    }
  }
  return null;
}

/**
 * Record tiles explored. Increments the counter by the given amount.
 * Returns true if the count changed (count > 0), false otherwise.
 */
export function recordTilesExplored(state: ExplorationState, count: number): boolean {
  if (count <= 0) return false;
  state.mapTilesExplored = Math.min(
    state.totalMapTiles,
    state.mapTilesExplored + count,
  );
  state.version++;
  return true;
}
