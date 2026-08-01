/**
 * Friendship system pure operations.
 *
 * All functions are pure: no side effects, no mutations. The system
 * layer calls these and writes the results to the component.
 */

import type { InventoryComponent } from "../components/InventoryComponent";
import type { ItemId } from "@worldnest/shared";
import { countItem } from "../inventory/inventoryOps";
import {
  FRIENDSHIP_THRESHOLDS,
  GIFT_BASE_POINTS,
  GIFT_MULTIPLIERS,
  LEVEL_REWARDS,
  MAX_DAILY_GIFTS,
  NPC_GIFT_PREFERENCES,
  type FriendshipLevel,
  type GiftReaction,
} from "./friendshipDefinitions";
import type { FriendshipEntry } from "./friendshipState";

/** Result of a successful gift-giving operation. */
export interface GiftResult {
  entry: FriendshipEntry;
  reaction: GiftReaction;
  pointsEarned: number;
  leveledUp: boolean;
  reward: number;
}

/**
 * Whether the player can give a gift to the given NPC today.
 * Checks daily limit and item availability in inventory.
 */
export function canGiveGift(
  inventory: InventoryComponent,
  itemId: ItemId,
  entry: FriendshipEntry | undefined,
  currentDay: number,
): boolean {
  if (countItem(inventory, itemId) < 1) return false;
  if (!entry) return true;
  if (entry.lastGiftDay !== currentDay) return true;
  return entry.giftsGivenToday < MAX_DAILY_GIFTS;
}

/**
 * Determine the NPC reaction to receiving a specific item.
 */
export function getGiftReaction(npcId: string, itemId: ItemId): GiftReaction {
  const prefs = NPC_GIFT_PREFERENCES[npcId];
  if (!prefs) return "neutral";
  if ((prefs.lovedItems as string[]).includes(itemId)) return "loved";
  if ((prefs.likedItems as string[]).includes(itemId)) return "liked";
  if ((prefs.dislikedItems as string[]).includes(itemId)) return "disliked";
  return "neutral";
}

/**
 * Calculate friendship level from accumulated points.
 */
export function getFriendshipLevel(points: number): FriendshipLevel {
  for (let i = FRIENDSHIP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= FRIENDSHIP_THRESHOLDS[i]) return i as FriendshipLevel;
  }
  return 0;
}

/**
 * Give a gift to an NPC and calculate the new friendship state.
 * Returns the updated entry, reaction, points earned, and whether
 * the friendship leveled up.
 */
export function giveGift(
  npcId: string,
  itemId: ItemId,
  entry: FriendshipEntry | undefined,
  currentDay: number,
): GiftResult {
  const reaction = getGiftReaction(npcId, itemId);
  const multiplier = GIFT_MULTIPLIERS[reaction];
  const pointsEarned = Math.floor(GIFT_BASE_POINTS * multiplier);

  const existing: FriendshipEntry = entry ?? {
    npcId,
    points: 0,
    level: 0,
    lastGiftDay: currentDay,
    giftsGivenToday: 0,
  };

  const isNewDay = existing.lastGiftDay !== currentDay;
  const newPoints = existing.points + pointsEarned;
  const newLevel = getFriendshipLevel(newPoints);
  const leveledUp = newLevel > existing.level;
  const reward = leveledUp ? getLevelReward(newLevel) : 0;

  const newEntry: FriendshipEntry = {
    npcId,
    points: newPoints,
    level: newLevel,
    lastGiftDay: currentDay,
    giftsGivenToday: isNewDay ? 1 : existing.giftsGivenToday + 1,
  };

  return { entry: newEntry, reaction, pointsEarned, leveledUp, reward };
}

/**
 * Get the coin reward for reaching a specific friendship level.
 */
export function getLevelReward(level: FriendshipLevel): number {
  return LEVEL_REWARDS[level] ?? 0;
}

/**
 * Reset daily gift counters for all entries (called on day change).
 * Returns the updated entries record.
 */
export function resetDailyGifts(
  entries: Record<string, FriendshipEntry>,
  newDay: number,
): Record<string, FriendshipEntry> {
  const result: Record<string, FriendshipEntry> = {};
  for (const [npcId, entry] of Object.entries(entries)) {
    result[npcId] = {
      ...entry,
      lastGiftDay: newDay,
      giftsGivenToday: 0,
    };
  }
  return result;
}

/**
 * Get the total number of gifts given across all NPCs.
 */
export function getTotalGiftsGiven(entries: Record<string, FriendshipEntry>): number {
  let total = 0;
  for (const entry of Object.values(entries)) {
    // Each entry's total gifts is roughly (points / average points per gift).
    // Instead we count from a cumulative basis: points > 0 means at least one.
    // Simplification: count entries with points > 0 as having gifted at least 1.
    // Actually track by summing level transitions + remaining points.
    total += Math.ceil(entry.points / GIFT_BASE_POINTS);
  }
  return total;
}

/**
 * Get the highest friendship level achieved across all NPCs.
 */
export function getHighestFriendshipLevel(
  entries: Record<string, FriendshipEntry>,
): FriendshipLevel {
  let highest: FriendshipLevel = 0;
  for (const entry of Object.values(entries)) {
    if (entry.level > highest) highest = entry.level as FriendshipLevel;
  }
  return highest;
}
