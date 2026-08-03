/**
 * Pure functions for the expanded NPC shop system.
 *
 * Handles effective price calculation (specialty + seasonal + rare markup),
 * NPC shop item resolution, and rare item identification.
 */
import { ITEM_PRICES, type ItemId } from "@worldnest/shared";
import type { Season } from "../world/Seasons";
import {
  NPC_SHOP_CATALOGUES,
  RARE_ITEM_MARKUP,
  RARE_ITEM_ROTATION,
  getRareItemForDay,
  getSeasonalDiscount,
} from "./shopCatalogue";

/**
 * Calculate the effective price of an item in an NPC shop, applying:
 * 1. Specialty discount (the NPC's curated catalogue items are cheaper)
 * 2. Seasonal discount (season-appropriate items get 20% off)
 * 3. Rare item markup (premium rotating items cost 50% more)
 *
 * Returns null if the item has no base price or the NPC is unknown.
 */
export function getEffectivePrice(
  kind: "buy" | "sell",
  itemId: ItemId,
  npcId: string,
  season: Season,
  currentDay: number,
): number | null {
  const basePrice = ITEM_PRICES[itemId];
  if (!basePrice) return null;

  const catalogue = NPC_SHOP_CATALOGUES[npcId];
  if (!catalogue) return null;

  let price = kind === "buy" ? basePrice.buy : basePrice.sell;

  // Apply rare item markup (only on buy side)
  if (kind === "buy" && isRareItem(itemId, currentDay)) {
    price = Math.floor(price * RARE_ITEM_MARKUP);
  }

  // Apply specialty discount (only on buy side)
  if (kind === "buy" && catalogue.items.includes(itemId)) {
    price = Math.floor(price * (1 - catalogue.specialtyDiscount));
  }

  // Apply seasonal discount (only on buy side)
  if (kind === "buy") {
    const seasonalDiscount = getSeasonalDiscount(season, itemId);
    if (seasonalDiscount > 0) {
      price = Math.floor(price * (1 - seasonalDiscount));
    }
  }

  return price;
}

/**
 * Get the full list of items available from an NPC shop on a given day.
 * Includes the NPC's catalogue items plus the daily rare rotation item.
 */
export function getNpcShopItems(npcId: string, currentDay: number): ItemId[] {
  const catalogue = NPC_SHOP_CATALOGUES[npcId];
  if (!catalogue) return [];

  const rareItem = getRareItemForDay(currentDay);
  const items = [...catalogue.items];
  if (!items.includes(rareItem)) {
    items.push(rareItem);
  }
  return items;
}

/** Whether an item is the rare rotation item for the given day. */
export function isRareItem(itemId: ItemId, currentDay: number): boolean {
  if (!RARE_ITEM_ROTATION.includes(itemId)) return false;
  return getRareItemForDay(currentDay) === itemId;
}

/** Whether an NPC shop carries a specific item on the given day. */
export function canBuyFromNpc(
  npcId: string,
  itemId: ItemId,
  currentDay: number,
): boolean {
  const items = getNpcShopItems(npcId, currentDay);
  return items.includes(itemId);
}
