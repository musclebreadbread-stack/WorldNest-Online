import type { ItemId } from "@worldnest/shared";

/**
 * The museum collection catalogue.
 *
 * Players donate items to unlock entries in a collection book. Completing a
 * category (e.g. all fish, all crops) awards coins. This is horizontal
 * progression that incentivizes exploration without power creep.
 *
 * Every player-visible string is an i18n key (decision D8).
 */

export interface CollectionCategory {
  id: string;
  titleKey: string;
  entries: readonly ItemId[];
  rewardCoins: number;
}

/**
 * Four categories covering all collectable items. Seeds and tools are excluded
 * because they are purchased, not discovered.
 */
export const COLLECTION_CATEGORIES: readonly CollectionCategory[] = [
  {
    id: "gathering",
    titleKey: "collection.category.gathering",
    entries: ["wood", "stone", "ore", "fiber", "flower"],
    rewardCoins: 100,
  },
  {
    id: "farming",
    titleKey: "collection.category.farming",
    entries: ["wheat", "carrot", "melon"],
    rewardCoins: 80,
  },
  {
    id: "fishing",
    titleKey: "collection.category.fishing",
    entries: ["fish_common", "fish_rare", "fish_tropical"],
    rewardCoins: 120,
  },
  {
    id: "crafted",
    titleKey: "collection.category.crafted",
    entries: ["fence", "chest", "path_stone"],
    rewardCoins: 60,
  },
  {
    id: "cooking",
    titleKey: "collection.category.cooking",
    entries: ["bread", "fish_pie", "carrot_soup", "fruit_salad"],
    rewardCoins: 90,
  },
];

/** Every category id, in catalogue order. */
export const COLLECTION_CATEGORY_IDS = COLLECTION_CATEGORIES.map((c) => c.id);

/** Category for an id, or `undefined` when nothing is registered under it. */
export function getCategory(categoryId: string): CollectionCategory | undefined {
  return COLLECTION_CATEGORIES.find((c) => c.id === categoryId);
}

/** Whether an item belongs to any collection category. */
export function isCollectable(itemId: ItemId): boolean {
  return COLLECTION_CATEGORIES.some((c) => c.entries.includes(itemId));
}
