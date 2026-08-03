/**
 * Pure operations for the festival system.
 *
 * All functions are side-effect free and operate only on the data passed in.
 * The FestivalSystem is the sole consumer during the game loop.
 */
import { DAYS_PER_SEASON } from "@worldnest/shared";
import { seasonForDay } from "../world/Seasons";
import { FESTIVAL_DEFINITIONS, type FestivalDefinition } from "./festivalDefinitions";
import type { FestivalComponent } from "../components/FestivalComponent";
import type { WalletComponent } from "../components/WalletComponent";

const SEASON_COUNT = 4;
const CYCLE_LENGTH = DAYS_PER_SEASON * SEASON_COUNT;

/**
 * Returns the 1-based day-of-season for a given game day.
 * Day 1 = spring day 1, day 7 = spring day 7, day 8 = summer day 1, etc.
 */
export function dayOfSeason(day: number): number {
  const dayInCycle = (((day - 1) % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
  return (dayInCycle % DAYS_PER_SEASON) + 1;
}

/**
 * Returns the active festival for a given game day, or null if none is active.
 */
export function getActiveFestival(day: number): FestivalDefinition | null {
  const season = seasonForDay(day);
  const dos = dayOfSeason(day);

  for (const fest of FESTIVAL_DEFINITIONS) {
    if (fest.season !== season) continue;
    if (dos >= fest.dayOfSeason && dos < fest.dayOfSeason + fest.durationDays) {
      return fest;
    }
  }
  return null;
}

/**
 * Checks whether a specific festival is active on a given game day.
 */
export function isFestivalActive(day: number, festivalId: string): boolean {
  const active = getActiveFestival(day);
  return active !== null && active.id === festivalId;
}

/**
 * Computes the cycle number for a given day.
 * Cycle 0 = days 1-28, cycle 1 = days 29-56, etc.
 */
export function getCycleNumber(day: number): number {
  return Math.floor((day - 1) / CYCLE_LENGTH);
}

/**
 * Generates a unique key for a festival occurrence in a specific cycle.
 * Used to prevent double-claiming rewards within the same season cycle.
 */
export function getCycleKey(day: number, festivalId: string): string {
  return `${festivalId}:${getCycleNumber(day)}`;
}

/**
 * Attempts to claim a festival reward. Returns true if successful.
 * Fails if the reward was already claimed for this cycle.
 */
export function claimFestivalReward(
  component: FestivalComponent,
  wallet: WalletComponent,
  festivalId: string,
  day: number,
  rewardCoins: number,
): boolean {
  const key = getCycleKey(day, festivalId);
  if (component.claimedRewards.has(key)) {
    return false;
  }
  component.claimedRewards.add(key);
  wallet.coins += rewardCoins;
  component.version += 1;
  return true;
}

/**
 * Returns the current festival progress for UI display.
 */
export function getFestivalProgress(component: FestivalComponent): {
  active: string | null;
  claimed: string[];
} {
  return {
    active: component.activeFestival,
    claimed: [...component.claimedRewards],
  };
}
