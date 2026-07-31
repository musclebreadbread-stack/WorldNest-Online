/**
 * Pure functions for checking and unlocking achievements.
 *
 * `AchievementComponent` satisfies `AchievementState` structurally, so every
 * rule is testable without an ECS world -- the same split `collectionOps` and
 * `questOps` use.
 */

import type {
  AchievementCondition,
  AchievementDefinition,
  AchievementSource,
} from "./achievementDefinitions";
import { ACHIEVEMENT_DEFINITIONS } from "./achievementDefinitions";

/** Minimal state shape the ops functions need. */
export interface AchievementState {
  unlocked: Set<string>;
  pendingReward: string | null;
  version: number;
  totalFishCaught: number;
  totalQuestsCompleted: number;
}

/**
 * Evaluate whether a single achievement condition is met given the source.
 * The `full_gathering` achievement uses `donate` kind but also requires the
 * gathering category to be complete; this is handled by checking both.
 */
export function checkCondition(
  condition: AchievementCondition,
  source: AchievementSource,
): boolean {
  switch (condition.kind) {
    case "collect":
      return source.itemCount(condition.itemId) >= condition.count;
    case "donate":
      return source.donationCount >= condition.count;
    case "build":
      return source.structureCount >= condition.count;
    case "quest":
      return source.questCompletionCount >= condition.count;
    case "fish":
      return source.fishCaughtCount >= condition.count;
    case "total_coins":
      return source.totalCoinsEarned >= condition.amount;
  }
}

/**
 * Check whether an achievement should unlock. Returns true only when the
 * condition is met and the achievement has not already been unlocked.
 *
 * `full_gathering` has a special additional requirement: the gathering
 * collection category must be complete.
 */
export function checkAchievement(
  state: AchievementState,
  definition: AchievementDefinition,
  source: AchievementSource,
): boolean {
  if (state.unlocked.has(definition.id)) return false;

  // full_gathering requires the gathering category to be complete
  if (definition.id === "full_gathering" && !source.gatheringCategoryComplete) {
    return false;
  }

  return checkCondition(definition.condition, source);
}

/**
 * Unlock an achievement. Returns false if already unlocked (idempotent).
 * On success, sets `pendingReward` so the system can pay out coins.
 */
export function unlockAchievement(
  state: AchievementState,
  achievementId: string,
): boolean {
  if (state.unlocked.has(achievementId)) return false;
  state.unlocked.add(achievementId);
  state.pendingReward = achievementId;
  state.version++;
  return true;
}

/** How many achievements have been unlocked. */
export function getUnlockedCount(state: AchievementState): number {
  return state.unlocked.size;
}

/** All definitions that have not yet been unlocked. */
export function getPendingAchievements(
  state: AchievementState,
): AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS.filter((d) => !state.unlocked.has(d.id));
}
