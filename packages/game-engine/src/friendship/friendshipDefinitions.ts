/**
 * Friendship system definitions and constants.
 *
 * Defines friendship levels, thresholds, gift preferences per NPC,
 * and point multipliers. All player-visible strings are i18n keys.
 */

import type { ItemId } from "@worldnest/shared";

/**
 * Friendship level: 0 = stranger, 1 = acquaintance, 2 = friend,
 * 3 = close_friend, 4 = best_friend.
 */
export type FriendshipLevel = 0 | 1 | 2 | 3 | 4;

/** Points required to reach each friendship level. */
export const FRIENDSHIP_THRESHOLDS: readonly number[] = [0, 20, 50, 100, 200];

/** Base points awarded per gift given. */
export const GIFT_BASE_POINTS = 5;

/** Maximum number of gifts that can be given to a single NPC per day. */
export const MAX_DAILY_GIFTS = 1;

/** Reaction multiplier for each gift preference type. */
export const GIFT_MULTIPLIERS: Record<GiftReaction, number> = {
  loved: 3,
  liked: 1.5,
  neutral: 1,
  disliked: 0.25,
};

/** Coin rewards earned at each friendship level milestone. */
export const LEVEL_REWARDS: readonly number[] = [0, 10, 20, 35, 75];

/** How the NPC reacts to a gift. */
export type GiftReaction = "loved" | "liked" | "neutral" | "disliked";

/** Gift preference lists for an NPC. */
export interface GiftPreference {
  lovedItems: ItemId[];
  likedItems: ItemId[];
  dislikedItems: ItemId[];
}

/**
 * Gift preferences for every NPC. Items not listed in any category
 * produce a "neutral" reaction.
 */
export const NPC_GIFT_PREFERENCES: Record<string, GiftPreference> = {
  villager_pip: {
    lovedItems: ["flower", "wheat_seed", "carrot_seed"],
    likedItems: ["wheat", "carrot"],
    dislikedItems: ["stone", "ore"],
  },
  shopkeeper_juno: {
    lovedItems: ["fish_rare", "fish_tropical", "iron_ingot"],
    likedItems: ["cloth", "plank"],
    dislikedItems: ["wood", "stone"],
  },
  questgiver_ada: {
    lovedItems: ["ore", "iron_ingot", "stone"],
    likedItems: ["wood", "fiber"],
    dislikedItems: ["wheat_seed", "carrot_seed"],
  },
  curator_milo: {
    lovedItems: ["fish_tropical", "flower", "ore"],
    likedItems: ["fish_rare", "iron_ingot"],
    dislikedItems: ["fence", "path_stone"],
  },
  chef_bao: {
    lovedItems: ["wheat", "carrot", "melon", "fish_common"],
    likedItems: ["fish_rare", "flower"],
    dislikedItems: ["stone", "ore"],
  },
  rancher_hana: {
    lovedItems: ["animal_feed", "pet_treat"],
    likedItems: ["wheat", "carrot"],
    dislikedItems: ["iron_ingot", "stone"],
  },
  professor_owl: {
    lovedItems: ["plank", "cloth"],
    likedItems: ["iron_ingot", "fiber"],
    dislikedItems: ["fish_common", "animal_feed"],
  },
  musician_melody: {
    lovedItems: ["flower", "cloth"],
    likedItems: ["plank", "fiber"],
    dislikedItems: ["ore", "stone"],
  },
};
