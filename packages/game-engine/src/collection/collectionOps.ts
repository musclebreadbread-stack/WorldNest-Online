import type { ItemId } from "@worldnest/shared";
import type { InventoryComponent } from "../components/InventoryComponent";
import { countItem, removeItem } from "../inventory/inventoryOps";
import type { Wallet } from "../shop/shopOps";
import {
  COLLECTION_CATEGORIES,
  getCategory,
  isCollectable,
} from "./collectionDefinitions";

/**
 * The collection rules, as pure functions over plain data.
 *
 * `CollectionComponent` satisfies `CollectionState` structurally, so every rule
 * is testable without an ECS world -- the same split `questOps` and `shopOps`
 * use. Each function returns whether it changed anything and bumps `version`
 * when it did.
 */
export interface CollectionState {
  discovered: Set<ItemId>;
  categoryRewardsClaimed: Set<string>;
  version: number;
}

/** Whether the player has at least one of this item and it is collectable. */
export function canDonate(inventory: InventoryComponent, itemId: ItemId): boolean {
  if (!isCollectable(itemId)) return false;
  return countItem(inventory, itemId) > 0;
}

/**
 * Donate an item: remove 1 from inventory and mark it discovered.
 * Returns false when the item is already discovered, not collectable, or not
 * in inventory.
 */
export function donate(
  collection: CollectionState,
  inventory: InventoryComponent,
  itemId: ItemId,
): boolean {
  if (!isCollectable(itemId)) return false;
  if (collection.discovered.has(itemId)) return false;
  if (countItem(inventory, itemId) < 1) return false;

  removeItem(inventory, itemId, 1);
  collection.discovered.add(itemId);
  collection.version++;
  return true;
}

/** Progress for a category: how many entries have been discovered. */
export function getCategoryProgress(
  collection: CollectionState,
  categoryId: string,
): { discovered: number; total: number } {
  const category = getCategory(categoryId);
  if (!category) return { discovered: 0, total: 0 };

  const discovered = category.entries.filter((entry) =>
    collection.discovered.has(entry),
  ).length;
  return { discovered, total: category.entries.length };
}

/** Whether every entry in a category has been donated. */
export function isCategoryComplete(
  collection: CollectionState,
  categoryId: string,
): boolean {
  const category = getCategory(categoryId);
  if (!category) return false;
  return category.entries.every((entry) => collection.discovered.has(entry));
}

/**
 * Claim the completion reward for a category. Adds coins to the wallet and
 * marks the reward as claimed. Returns false when the category is incomplete
 * or the reward was already claimed.
 */
export function claimCategoryReward(
  collection: CollectionState,
  wallet: Wallet,
  categoryId: string,
): boolean {
  const category = getCategory(categoryId);
  if (!category) return false;
  if (!isCategoryComplete(collection, categoryId)) return false;
  if (collection.categoryRewardsClaimed.has(categoryId)) return false;

  wallet.coins += category.rewardCoins;
  collection.categoryRewardsClaimed.add(categoryId);
  collection.version++;
  return true;
}

/** Total number of unique items donated across all categories. */
export function totalDonated(collection: CollectionState): number {
  return collection.discovered.size;
}

/** Total number of collectable items across all categories. */
export function totalCollectable(): number {
  return COLLECTION_CATEGORIES.reduce((sum, cat) => sum + cat.entries.length, 0);
}
