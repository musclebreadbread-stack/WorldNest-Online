import { ITEM_IDS, isItemId, type ItemId } from "./items";

/**
 * The shop price list, and the only economy the game has (decision D14).
 *
 * There is no player-to-player trading and no market. The architecture is
 * client-authoritative and anti-cheat is out of scope, so a modified client can
 * already forge its own inventory; letting it forge value *for other players*
 * through a trade or an auction house is a different and much worse problem.
 * Everything is therefore bought from and sold to one NPC at fixed prices.
 *
 * The audience is 10-18, so there is deliberately nothing random here: no loot
 * boxes, no gacha, no wagers, and no way to spend real money. A price is a
 * number in this table and nowhere else.
 *
 * Prices live in `shared` for the same reason the item catalogue does: the engine
 * needs them for the shop maths and the database layer needs them beside the
 * `coins` column, and this is the only package both of them depend on.
 */
export interface ItemPrice {
  /** Coins the shop charges for one unit. */
  buy: number;
  /** Coins the shop pays for one unit. Always strictly below `buy`. */
  sell: number;
}

/**
 * Buy and sell prices per item.
 *
 * `sell < buy` for every entry, which is what makes a buy-then-sell loop a loss
 * rather than an infinite money glitch — `economy.test.ts` asserts it for the
 * whole table, so a future price cannot open one by accident. The spread is
 * roughly a third of the buy price: wide enough to close the loop, narrow enough
 * that gathering and selling is still clearly worth doing.
 *
 * Partial by type because an item is allowed to be untradable; every item in the
 * catalogue happens to have a price today.
 */
export const ITEM_PRICES: Partial<Record<ItemId, ItemPrice>> = {
  // Gathered by hand from trees, rocks and meadows
  wood: { buy: 8, sell: 3 },
  stone: { buy: 10, sell: 4 },
  fiber: { buy: 6, sell: 2 },
  flower: { buy: 12, sell: 5 },
  // Only found in caves, so it is the most valuable raw material
  ore: { buy: 30, sell: 14 },
  // Farming: a seed costs less than the wheat it grows into, so tending a field
  // is profitable — but only by a fixed amount per seed, never compounding.
  wheat_seed: { buy: 10, sell: 3 },
  wheat: { buy: 20, sell: 9 },
  // Cool-climate crop: carrots grow in tundra, taiga and grassland
  carrot_seed: { buy: 12, sell: 4 },
  carrot: { buy: 24, sell: 11 },
  // Hot-climate crop: melons grow in desert, savanna and forest
  melon_seed: { buy: 14, sell: 5 },
  melon: { buy: 28, sell: 13 },
  // Crafted goods the player cannot make yet, which is why they are worth buying
  fence: { buy: 20, sell: 6 },
  chest: { buy: 60, sell: 20 },
  // Decorative path stones, cheap enough to place freely
  path_stone: { buy: 5, sell: 2 },
  // Fishing: rod is a one-time purchase, fish are biome-specific catches
  fishing_rod: { buy: 40, sell: 12 },
  fish_common: { buy: 15, sell: 7 },
  fish_rare: { buy: 35, sell: 16 },
  fish_tropical: { buy: 45, sell: 21 },
  // Cooked food: ingredients cost less than the finished product, so cooking
  // is profitable if you grow or catch your own materials.
  bread: { buy: 25, sell: 12 },
  fish_pie: { buy: 50, sell: 24 },
  carrot_soup: { buy: 40, sell: 18 },
  fruit_salad: { buy: 35, sell: 16 },
  // Animal items: feed for taming, treats for pet happiness
  animal_feed: { buy: 15, sell: 5 },
  pet_treat: { buy: 20, sell: 8 },
};

/** Coins a brand-new player starts with: enough for a first handful of fences. */
export const STARTING_COINS = 50;

/** Whether the shop will trade an item at all. */
export function isTradable(itemId: ItemId): boolean {
  return ITEM_PRICES[itemId] !== undefined;
}

/** Every tradable item, in catalogue order, so the shop panel is stable. */
export const TRADABLE_ITEM_IDS = ITEM_IDS.filter(isTradable);

/** Price for an item, or `undefined` when the shop refuses to trade it. */
export function getItemPrice(itemId: ItemId): ItemPrice | undefined {
  return ITEM_PRICES[itemId];
}

/**
 * Coins a trade moves, or `null` when it is not a trade the shop will make.
 *
 * Buying and selling share one function so the two can never drift apart, and a
 * non-positive or fractional quantity is refused here rather than in every
 * caller.
 */
export function tradeValue(
  kind: "buy" | "sell",
  itemId: unknown,
  quantity: number,
): number | null {
  if (!isItemId(itemId)) return null;
  if (!Number.isInteger(quantity) || quantity <= 0) return null;

  const price = ITEM_PRICES[itemId];
  if (!price) return null;

  return (kind === "buy" ? price.buy : price.sell) * quantity;
}
