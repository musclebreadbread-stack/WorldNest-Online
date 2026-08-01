/**
 * Pure functions for mission state management.
 *
 * `MissionComponent` satisfies `MissionState` structurally, so every rule is
 * testable without an ECS world, matching the ops pattern used by questOps,
 * collectionOps, and shopOps.
 */

import type { Wallet } from "../shop/shopOps";
import {
  getDailyMissionForDay,
  getMission,
  getWeeklyMissionForWeek,
  STREAK_BONUS_MULTIPLIERS,
  type MissionTier,
} from "./missionDefinitions";

/** One mission's tracking state. */
export interface MissionEntry {
  missionId: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

/** Minimal state shape the ops functions need. */
export interface MissionState {
  activeMissions: Record<string, MissionEntry>;
  dailyStreak: number;
  lastCompletedDay: number;
  weeklyProgress: number;
  version: number;
  lastRefreshDay: number;
  lastRefreshWeek: number;
}

/**
 * Refresh daily missions for a new day. Bumps streak if yesterday was
 * completed, resets it otherwise. Returns true if state changed.
 */
export function refreshDailyMissions(state: MissionState, currentDay: number): boolean {
  if (state.lastRefreshDay === currentDay) return false;

  // Streak logic: if yesterday's daily was completed, bump streak.
  // Skip streak logic on first refresh (lastCompletedDay === -1 means
  // no mission has ever been completed).
  if (state.lastCompletedDay >= 0) {
    if (state.lastCompletedDay === currentDay - 1) {
      state.dailyStreak++;
    } else if (state.lastCompletedDay !== currentDay) {
      state.dailyStreak = 0;
    }
  }

  // Remove old daily missions
  for (const [key, entry] of Object.entries(state.activeMissions)) {
    const def = getMission(entry.missionId);
    if (def && def.tier === "DAILY") {
      delete state.activeMissions[key];
    }
  }

  // Add the daily mission for today
  const daily = getDailyMissionForDay(currentDay);
  state.activeMissions[daily.id] = {
    missionId: daily.id,
    progress: 0,
    completed: false,
    claimed: false,
  };

  state.lastRefreshDay = currentDay;
  state.version++;
  return true;
}

/**
 * Refresh weekly missions for a new week. Returns true if state changed.
 */
export function refreshWeeklyMissions(
  state: MissionState,
  currentWeek: number,
): boolean {
  if (state.lastRefreshWeek === currentWeek) return false;

  // Remove old weekly missions
  for (const [key, entry] of Object.entries(state.activeMissions)) {
    const def = getMission(entry.missionId);
    if (def && def.tier === "WEEKLY") {
      delete state.activeMissions[key];
    }
  }

  // Add the weekly mission for this week
  const weekly = getWeeklyMissionForWeek(currentWeek);
  state.activeMissions[weekly.id] = {
    missionId: weekly.id,
    progress: 0,
    completed: false,
    claimed: false,
  };

  state.lastRefreshWeek = currentWeek;
  state.weeklyProgress = 0;
  state.version++;
  return true;
}

/**
 * Record progress on a mission. Returns true if progress changed.
 */
export function recordMissionProgress(
  state: MissionState,
  missionId: string,
  delta: number,
): boolean {
  const entry = state.activeMissions[missionId];
  if (!entry || entry.completed) return false;

  const def = getMission(missionId);
  if (!def) return false;

  const target = def.objective.count;
  const newProgress = Math.min(target, entry.progress + delta);
  if (newProgress === entry.progress) return false;

  entry.progress = newProgress;
  state.version++;
  return true;
}

/**
 * Mark a mission as completed. Returns true if state changed.
 */
export function completeMission(
  state: MissionState,
  missionId: string,
  currentDay: number,
): boolean {
  const entry = state.activeMissions[missionId];
  if (!entry || entry.completed) return false;

  const def = getMission(missionId);
  if (!def) return false;

  if (entry.progress < def.objective.count) return false;

  entry.completed = true;
  if (def.tier === "DAILY") {
    state.lastCompletedDay = currentDay;
  } else {
    state.weeklyProgress++;
  }
  state.version++;
  return true;
}

/**
 * Claim the reward for a completed mission, applying streak multiplier.
 * Returns true if the reward was paid out.
 */
export function claimMissionReward(
  state: MissionState,
  missionId: string,
  wallet: Wallet,
): boolean {
  const entry = state.activeMissions[missionId];
  if (!entry || !entry.completed || entry.claimed) return false;

  const def = getMission(missionId);
  if (!def) return false;

  const multiplier = getStreakMultiplier(state.dailyStreak);
  const reward = Math.floor(def.baseRewardCoins * multiplier);
  wallet.coins += reward;
  entry.claimed = true;
  state.version++;
  return true;
}

/** Get the streak multiplier for a given streak count. */
export function getStreakMultiplier(streak: number): number {
  if (streak >= STREAK_BONUS_MULTIPLIERS.length) {
    return STREAK_BONUS_MULTIPLIERS[STREAK_BONUS_MULTIPLIERS.length - 1];
  }
  return STREAK_BONUS_MULTIPLIERS[Math.max(0, streak)];
}

/** Get active missions filtered by tier. */
export function getActiveMissions(
  state: MissionState,
  tier: MissionTier,
): MissionEntry[] {
  return Object.values(state.activeMissions).filter((entry) => {
    const def = getMission(entry.missionId);
    return def?.tier === tier;
  });
}
