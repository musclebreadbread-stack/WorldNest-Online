/**
 * Pure functions for gardening state management.
 *
 * Follows the same ops-separate-from-system pattern as explorationOps,
 * fishingOps, etc. All functions are side-effect-free and testable without
 * an ECS world.
 */

import {
  ARRANGEMENT_FLOWER_COUNT,
  COMPETITION_REWARDS,
  COMPETITION_THRESHOLDS,
  CompetitionTier,
  FLOWER_BEAUTY_POINTS,
  FLOWER_GROWTH_TIME_MS,
  type FlowerVariety,
  MAX_WATER_LEVEL,
  SEASONAL_BONUS_MULTIPLIER,
  VARIETY_BONUS_MULTIPLIER,
  WATER_PER_ACTION,
} from "./gardeningDefinitions";

export interface GardenPlot {
  flower: FlowerVariety;
  plantedAt: number;
  watered: boolean;
}

export interface Arrangement {
  flowers: FlowerVariety[];
  score: number;
  createdAt: number;
}

export interface CompetitionEntry {
  tier: CompetitionTier;
  score: number;
  reward: number;
  timestamp: number;
}

/** Minimal state shape the gardening ops need. */
export interface GardeningState {
  gardenPlots: GardenPlot[];
  arrangements: Arrangement[];
  competitionHistory: CompetitionEntry[];
  waterLevel: number;
  lastWateredTime: number;
  version: number;
}

/**
 * Plant a flower in the garden. Returns true if successful.
 */
export function plantFlower(
  state: GardeningState,
  flower: FlowerVariety,
  now: number,
  maxPlots: number,
): boolean {
  if (state.gardenPlots.length >= maxPlots) return false;
  state.gardenPlots.push({ flower, plantedAt: now, watered: false });
  state.version++;
  return true;
}

/**
 * Water the garden. Increases water level and marks unwatered plots.
 * Returns true if watering had an effect.
 */
export function waterGarden(state: GardeningState, now: number): boolean {
  if (state.waterLevel >= MAX_WATER_LEVEL && state.gardenPlots.length === 0) {
    return false;
  }
  state.waterLevel = Math.min(MAX_WATER_LEVEL, state.waterLevel + WATER_PER_ACTION);
  state.lastWateredTime = now;
  for (const plot of state.gardenPlots) {
    plot.watered = true;
  }
  state.version++;
  return true;
}

/**
 * Harvest a mature flower. Returns the flower variety if successful, null
 * otherwise. A flower is mature when enough time has passed AND watered.
 */
export function harvestFlower(
  state: GardeningState,
  plotIndex: number,
  now: number,
): FlowerVariety | null {
  const plot = state.gardenPlots[plotIndex];
  if (!plot) return null;
  const elapsed = now - plot.plantedAt;
  if (elapsed < FLOWER_GROWTH_TIME_MS) return null;
  if (!plot.watered) return null;
  const flower = plot.flower;
  state.gardenPlots.splice(plotIndex, 1);
  state.version++;
  return flower;
}

/**
 * Create an arrangement from a list of flowers.
 * Requires exactly ARRANGEMENT_FLOWER_COUNT flowers.
 * Returns the arrangement or null if invalid.
 */
export function createArrangement(
  state: GardeningState,
  flowers: FlowerVariety[],
  now: number,
): Arrangement | null {
  if (flowers.length !== ARRANGEMENT_FLOWER_COUNT) return null;
  const score = scoreArrangement(flowers, false);
  const arrangement: Arrangement = { flowers: [...flowers], score, createdAt: now };
  state.arrangements.push(arrangement);
  state.version++;
  return arrangement;
}

/**
 * Score a flower arrangement based on beauty points and variety bonus.
 */
export function scoreArrangement(
  flowers: FlowerVariety[],
  isSeasonal: boolean,
): number {
  let base = 0;
  for (const flower of flowers) {
    base += FLOWER_BEAUTY_POINTS[flower];
  }
  const uniqueVarieties = new Set(flowers).size;
  if (uniqueVarieties >= 2) {
    base = Math.floor(base * VARIETY_BONUS_MULTIPLIER);
  }
  if (isSeasonal) {
    base = Math.floor(base * SEASONAL_BONUS_MULTIPLIER);
  }
  return base;
}

/**
 * Enter a competition with an arrangement. Returns the entry or null.
 */
export function enterCompetition(
  state: GardeningState,
  arrangementIndex: number,
  now: number,
): CompetitionEntry | null {
  const arrangement = state.arrangements[arrangementIndex];
  if (!arrangement) return null;
  const result = judgeCompetition(arrangement.score);
  const entry: CompetitionEntry = { ...result, timestamp: now };
  state.competitionHistory.push(entry);
  state.version++;
  return entry;
}

/**
 * Judge a competition score and determine the tier.
 * Returns the tier and reward coins.
 */
export function judgeCompetition(score: number): {
  tier: CompetitionTier;
  score: number;
  reward: number;
} {
  if (score >= COMPETITION_THRESHOLDS[CompetitionTier.GOLD]) {
    return {
      tier: CompetitionTier.GOLD,
      score,
      reward: COMPETITION_REWARDS[CompetitionTier.GOLD],
    };
  }
  if (score >= COMPETITION_THRESHOLDS[CompetitionTier.SILVER]) {
    return {
      tier: CompetitionTier.SILVER,
      score,
      reward: COMPETITION_REWARDS[CompetitionTier.SILVER],
    };
  }
  return {
    tier: CompetitionTier.BRONZE,
    score,
    reward: COMPETITION_REWARDS[CompetitionTier.BRONZE],
  };
}
