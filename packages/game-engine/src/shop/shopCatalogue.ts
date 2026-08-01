/**
 * NPC-specific shop catalogues, seasonal discounts, and rare item rotation.
 *
 * Each NPC shopkeeper offers a curated selection of items with a specialty
 * discount. Seasonal modifiers adjust prices for contextually appropriate
 * items, and a rare-item rotation slot cycles through exclusive premium items
 * on a daily basis.
 */
import type { ItemId } from "@worldnest/shared";
import { Season } from "../world/Seasons";

export interface NpcShopCatalogue {
  npcId: string;
  shopNameKey: string;
  items: ItemId[];
  specialtyDiscount: number;
}

export const NPC_SHOP_CATALOGUES: Record<string, NpcShopCatalogue> = {
  shopkeeper_juno: {
    npcId: "shopkeeper_juno",
    shopNameKey: "shop.npcShop.juno",
    items: [
      "wood",
      "stone",
      "ore",
      "fiber",
      "fence",
      "chest",
      "path_stone",
      "fishing_rod",
      "house_deed",
    ],
    specialtyDiscount: 0.1,
  },
  chef_bao: {
    npcId: "chef_bao",
    shopNameKey: "shop.npcShop.bao",
    items: [
      "wheat_seed",
      "carrot_seed",
      "melon_seed",
      "bread",
      "fish_pie",
      "carrot_soup",
      "fruit_salad",
      "animal_feed",
    ],
    specialtyDiscount: 0.15,
  },
  rancher_hana: {
    npcId: "rancher_hana",
    shopNameKey: "shop.npcShop.hana",
    items: [
      "animal_feed",
      "pet_treat",
      "mount_saddle",
      "horse_whistle",
      "donkey_whistle",
      "camel_whistle",
    ],
    specialtyDiscount: 0.15,
  },
  musician_melody: {
    npcId: "musician_melody",
    shopNameKey: "shop.npcShop.melody",
    items: ["rhythm_drum", "rhythm_flute", "rhythm_harp", "rhythm_xylophone"],
    specialtyDiscount: 0.1,
  },
};

/** Fraction of the price taken off during a seasonal sale. */
export const SEASONAL_DISCOUNT_RATE = 0.2;

/** Multiplier applied to rare/premium items. */
export const RARE_ITEM_MARKUP = 1.5;

/** Items considered season-appropriate for discounts. */
const SPRING_ITEMS: ReadonlySet<ItemId> = new Set([
  "wheat_seed",
  "carrot_seed",
  "melon_seed",
  "rare_seed_pack",
]);

const SUMMER_ITEMS: ReadonlySet<ItemId> = new Set([
  "fishing_rod",
  "fish_common",
  "fish_rare",
  "fish_tropical",
  "golden_fishing_rod",
]);

const AUTUMN_ITEMS: ReadonlySet<ItemId> = new Set([
  "bread",
  "fish_pie",
  "carrot_soup",
  "fruit_salad",
  "animal_feed",
]);

const WINTER_ITEMS: ReadonlySet<ItemId> = new Set([
  "house_deed",
  "table",
  "chair",
  "bed",
  "lamp",
  "bookshelf",
]);

/**
 * Returns the seasonal discount fraction for an item (0 if none applies).
 * Seeds are discounted in spring, fishing gear in summer, food in autumn,
 * and housing items in winter.
 */
export function getSeasonalDiscount(season: Season, itemId: ItemId): number {
  switch (season) {
    case Season.SPRING:
      return SPRING_ITEMS.has(itemId) ? SEASONAL_DISCOUNT_RATE : 0;
    case Season.SUMMER:
      return SUMMER_ITEMS.has(itemId) ? SEASONAL_DISCOUNT_RATE : 0;
    case Season.AUTUMN:
      return AUTUMN_ITEMS.has(itemId) ? SEASONAL_DISCOUNT_RATE : 0;
    case Season.WINTER:
      return WINTER_ITEMS.has(itemId) ? SEASONAL_DISCOUNT_RATE : 0;
  }
}

/** The 6 premium items that rotate through a daily rare slot. */
export const RARE_ITEM_ROTATION: readonly ItemId[] = [
  "explorer_compass",
  "treasure_map",
  "lucky_charm",
  "season_ticket",
  "rare_seed_pack",
  "golden_fishing_rod",
];

/** Deterministic rotation: which rare item is available on a given day. */
export function getRareItemForDay(day: number): ItemId {
  const index =
    ((day % RARE_ITEM_ROTATION.length) + RARE_ITEM_ROTATION.length) %
    RARE_ITEM_ROTATION.length;
  return RARE_ITEM_ROTATION[index];
}
