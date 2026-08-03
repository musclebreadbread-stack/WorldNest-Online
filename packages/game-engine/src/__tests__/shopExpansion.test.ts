import { describe, it, expect, beforeEach } from "vitest";
import { ITEM_PRICES, type ItemId } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { InventoryComponent } from "../components/InventoryComponent";
import { ShopComponent } from "../components/ShopComponent";
import { WalletComponent } from "../components/WalletComponent";
import { Season } from "../world/Seasons";
import {
  NPC_SHOP_CATALOGUES,
  RARE_ITEM_ROTATION,
  SEASONAL_DISCOUNT_RATE,
  RARE_ITEM_MARKUP,
  getRareItemForDay,
  getSeasonalDiscount,
} from "../shop/shopCatalogue";
import {
  canBuyFromNpc,
  getEffectivePrice,
  getNpcShopItems,
  isRareItem,
} from "../shop/shopExpansionOps";
import { ShopSystem } from "../systems/ShopSystem";
import { checkCondition } from "../achievements/achievementOps";
import type { AchievementSource } from "../achievements/achievementDefinitions";

function createTrader(coins = 500) {
  const inventory = new InventoryComponent();
  const wallet = new WalletComponent(coins);
  const shop = new ShopComponent();
  const entity = new Entity("trader");
  entity.addComponent(inventory).addComponent(wallet).addComponent(shop);
  return { entity, inventory, wallet, shop };
}

describe("NPC Shop Catalogues", () => {
  it("should define 4 NPC shop catalogues", () => {
    const ids = Object.keys(NPC_SHOP_CATALOGUES);
    expect(ids).toHaveLength(4);
    expect(ids).toContain("shopkeeper_juno");
    expect(ids).toContain("chef_bao");
    expect(ids).toContain("rancher_hana");
    expect(ids).toContain("musician_melody");
  });

  it("should have shopkeeper_juno with general goods", () => {
    const juno = NPC_SHOP_CATALOGUES["shopkeeper_juno"];
    expect(juno.items).toContain("wood");
    expect(juno.items).toContain("stone");
    expect(juno.items).toContain("fishing_rod");
    expect(juno.specialtyDiscount).toBe(0.1);
  });

  it("should have chef_bao with food items", () => {
    const bao = NPC_SHOP_CATALOGUES["chef_bao"];
    expect(bao.items).toContain("wheat_seed");
    expect(bao.items).toContain("bread");
    expect(bao.items).toContain("fruit_salad");
    expect(bao.specialtyDiscount).toBe(0.15);
  });

  it("should have rancher_hana with animal items", () => {
    const hana = NPC_SHOP_CATALOGUES["rancher_hana"];
    expect(hana.items).toContain("animal_feed");
    expect(hana.items).toContain("mount_saddle");
    expect(hana.items).toContain("horse_whistle");
    expect(hana.specialtyDiscount).toBe(0.15);
  });

  it("should have musician_melody with instruments", () => {
    const melody = NPC_SHOP_CATALOGUES["musician_melody"];
    expect(melody.items).toContain("rhythm_drum");
    expect(melody.items).toContain("rhythm_flute");
    expect(melody.items).toContain("rhythm_harp");
    expect(melody.items).toContain("rhythm_xylophone");
    expect(melody.specialtyDiscount).toBe(0.1);
  });
});

describe("Seasonal Discounts", () => {
  it("should discount seeds in spring", () => {
    expect(getSeasonalDiscount(Season.SPRING, "wheat_seed")).toBe(
      SEASONAL_DISCOUNT_RATE,
    );
    expect(getSeasonalDiscount(Season.SPRING, "carrot_seed")).toBe(
      SEASONAL_DISCOUNT_RATE,
    );
  });

  it("should discount fishing items in summer", () => {
    expect(getSeasonalDiscount(Season.SUMMER, "fishing_rod")).toBe(
      SEASONAL_DISCOUNT_RATE,
    );
    expect(getSeasonalDiscount(Season.SUMMER, "golden_fishing_rod")).toBe(
      SEASONAL_DISCOUNT_RATE,
    );
  });

  it("should discount food in autumn", () => {
    expect(getSeasonalDiscount(Season.AUTUMN, "bread")).toBe(SEASONAL_DISCOUNT_RATE);
    expect(getSeasonalDiscount(Season.AUTUMN, "fish_pie")).toBe(SEASONAL_DISCOUNT_RATE);
  });

  it("should discount housing in winter", () => {
    expect(getSeasonalDiscount(Season.WINTER, "house_deed")).toBe(
      SEASONAL_DISCOUNT_RATE,
    );
    expect(getSeasonalDiscount(Season.WINTER, "bed")).toBe(SEASONAL_DISCOUNT_RATE);
  });

  it("should return 0 for non-seasonal items", () => {
    expect(getSeasonalDiscount(Season.SPRING, "wood")).toBe(0);
    expect(getSeasonalDiscount(Season.SUMMER, "stone")).toBe(0);
  });
});

describe("Rare Item Rotation", () => {
  it("should have 6 items in the rotation", () => {
    expect(RARE_ITEM_ROTATION).toHaveLength(6);
  });

  it("should be deterministic for a given day", () => {
    const item1 = getRareItemForDay(1);
    const item2 = getRareItemForDay(1);
    expect(item1).toBe(item2);
  });

  it("should cycle through all 6 items", () => {
    const items = new Set<ItemId>();
    for (let day = 0; day < 6; day++) {
      items.add(getRareItemForDay(day));
    }
    expect(items.size).toBe(6);
  });

  it("should repeat after 6 days", () => {
    expect(getRareItemForDay(0)).toBe(getRareItemForDay(6));
    expect(getRareItemForDay(1)).toBe(getRareItemForDay(7));
  });

  it("should identify rare items correctly", () => {
    const todaysRare = getRareItemForDay(3);
    expect(isRareItem(todaysRare, 3)).toBe(true);
    // A different rare item should not be today's
    const otherDay = getRareItemForDay(4);
    if (otherDay !== todaysRare) {
      expect(isRareItem(otherDay, 3)).toBe(false);
    }
  });

  it("should not consider normal items as rare", () => {
    expect(isRareItem("wood" as ItemId, 1)).toBe(false);
  });
});

describe("getEffectivePrice", () => {
  it("should return base price when no modifiers apply", () => {
    // wood is in juno's catalogue, but not seasonal in autumn, and not rare
    const price = getEffectivePrice("buy", "wood", "shopkeeper_juno", Season.AUTUMN, 1);
    // wood has 10% specialty discount in juno's shop
    const expected = Math.floor(ITEM_PRICES.wood!.buy * (1 - 0.1));
    expect(price).toBe(expected);
  });

  it("should apply specialty discount for catalogue items", () => {
    const base = ITEM_PRICES.bread!.buy;
    const price = getEffectivePrice("buy", "bread", "chef_bao", Season.SPRING, 1);
    // 15% specialty discount
    expect(price).toBe(Math.floor(base * 0.85));
  });

  it("should apply seasonal discount", () => {
    // wheat_seed in spring from juno (has specialty discount too)
    const base = ITEM_PRICES.wheat_seed!.buy;
    const price = getEffectivePrice(
      "buy",
      "wheat_seed",
      "shopkeeper_juno",
      Season.SPRING,
      1,
    );
    // Not in juno's catalogue, so only seasonal discount
    // Wait - wheat_seed is not in juno's items
    expect(price).toBe(Math.floor(base * (1 - SEASONAL_DISCOUNT_RATE)));
  });

  it("should apply rare item markup", () => {
    const day = 0; // explorer_compass
    const rareItem = getRareItemForDay(day);
    const base = ITEM_PRICES[rareItem]!.buy;
    // From juno (not in juno's catalogue items)
    const price = getEffectivePrice(
      "buy",
      rareItem,
      "shopkeeper_juno",
      Season.AUTUMN,
      day,
    );
    expect(price).toBe(Math.floor(base * RARE_ITEM_MARKUP));
  });

  it("should combine specialty + seasonal discounts", () => {
    // bread from chef_bao in autumn (bread is seasonal in autumn and in bao's catalogue)
    const base = ITEM_PRICES.bread!.buy;
    const price = getEffectivePrice("buy", "bread", "chef_bao", Season.AUTUMN, 1);
    // Apply specialty first: floor(25 * 0.85) = 21, then seasonal: floor(21 * 0.8) = 16
    const afterSpecialty = Math.floor(base * (1 - 0.15));
    const expected = Math.floor(afterSpecialty * (1 - SEASONAL_DISCOUNT_RATE));
    expect(price).toBe(expected);
  });

  it("should not apply discounts or markup on sell side", () => {
    const rareItem = getRareItemForDay(0);
    const price = getEffectivePrice(
      "sell",
      rareItem,
      "shopkeeper_juno",
      Season.SPRING,
      0,
    );
    expect(price).toBe(ITEM_PRICES[rareItem]!.sell);
  });

  it("should return null for unknown NPC", () => {
    const price = getEffectivePrice("buy", "wood", "unknown_npc", Season.SPRING, 1);
    expect(price).toBeNull();
  });

  it("should return null for untradable items", () => {
    const price = getEffectivePrice(
      "buy",
      "unobtainium" as ItemId,
      "shopkeeper_juno",
      Season.SPRING,
      1,
    );
    expect(price).toBeNull();
  });
});

describe("getNpcShopItems", () => {
  it("should include catalogue items plus the rare rotation", () => {
    const items = getNpcShopItems("shopkeeper_juno", 1);
    expect(items).toContain("wood");
    expect(items).toContain("stone");
    const rareItem = getRareItemForDay(1);
    expect(items).toContain(rareItem);
  });

  it("should return empty array for unknown NPC", () => {
    expect(getNpcShopItems("unknown", 1)).toEqual([]);
  });

  it("should not duplicate if rare item is already in catalogue", () => {
    // None of the 6 rare items are in any catalogue, so this tests that
    const items = getNpcShopItems("shopkeeper_juno", 0);
    const unique = new Set(items);
    expect(unique.size).toBe(items.length);
  });
});

describe("canBuyFromNpc", () => {
  it("should allow buying catalogue items", () => {
    expect(canBuyFromNpc("shopkeeper_juno", "wood", 1)).toBe(true);
  });

  it("should allow buying the daily rare item", () => {
    const rareItem = getRareItemForDay(1);
    expect(canBuyFromNpc("shopkeeper_juno", rareItem, 1)).toBe(true);
  });

  it("should deny non-catalogue and non-rare items", () => {
    // bread is not in juno's catalogue and is not the rare item on day 99
    expect(canBuyFromNpc("shopkeeper_juno", "bread", 99)).toBe(false);
  });
});

describe("ShopSystem NPC expansion", () => {
  let system: ShopSystem;

  beforeEach(() => {
    system = new ShopSystem(
      () => Season.SPRING,
      () => 1,
    );
  });

  it("should populate currentNpcShopItems when opening a catalogue NPC", () => {
    const { entity, shop } = createTrader();
    shop.requestedOpenNpcId = "shopkeeper_juno";
    system.update([entity], 1 / 60);
    expect(shop.currentNpcShopItems).not.toBeNull();
    expect(shop.currentNpcShopItems!.length).toBeGreaterThan(0);
    // In spring, day 1: juno has no spring-seasonal items, so flag is false
    expect(shop.seasonalDiscountActive).toBe(false);
  });

  it("should set seasonalDiscountActive when NPC has seasonal items", () => {
    // Chef Bao carries wheat_seed, which is seasonal in spring
    const { entity, shop } = createTrader();
    shop.requestedOpenNpcId = "chef_bao";
    system.update([entity], 1 / 60);
    expect(shop.seasonalDiscountActive).toBe(true);
  });

  it("should track shops visited", () => {
    const { entity, shop } = createTrader();
    shop.requestedOpenNpcId = "shopkeeper_juno";
    system.update([entity], 1 / 60);
    expect(shop.shopsVisited.has("shopkeeper_juno")).toBe(true);

    shop.closeRequested = true;
    system.update([entity], 1 / 60);
    shop.requestedOpenNpcId = "chef_bao";
    system.update([entity], 1 / 60);
    expect(shop.shopsVisited.has("chef_bao")).toBe(true);
    expect(shop.shopsVisited.size).toBe(2);
  });

  it("should apply NPC pricing on trade", () => {
    const { entity, shop, wallet } = createTrader(500);
    shop.requestedOpenNpcId = "shopkeeper_juno";
    shop.requestedTrade = { kind: "buy", itemId: "wood", quantity: 1 };
    system.update([entity], 1 / 60);

    // wood buy = 8, specialty discount 10% -> floor(8 * 0.9) = 7
    // No seasonal discount for wood in spring
    expect(wallet.coins).toBe(500 - 7);
  });

  it("should track rare item purchases", () => {
    const rareItem = getRareItemForDay(1);
    const { entity, shop } = createTrader(1000);
    shop.requestedOpenNpcId = "shopkeeper_juno";
    shop.requestedTrade = { kind: "buy", itemId: rareItem, quantity: 1 };
    system.update([entity], 1 / 60);
    expect(shop.rareItemsPurchased).toBe(1);
  });

  it("should clear NPC shop items on close", () => {
    const { entity, shop } = createTrader();
    shop.requestedOpenNpcId = "shopkeeper_juno";
    system.update([entity], 1 / 60);
    expect(shop.currentNpcShopItems).not.toBeNull();

    shop.closeRequested = true;
    system.update([entity], 1 / 60);
    expect(shop.currentNpcShopItems).toBeNull();
    expect(shop.seasonalDiscountActive).toBe(false);
  });

  it("should sell at base price without markup", () => {
    const { entity, shop, inventory, wallet } = createTrader(0);
    const rareItem = getRareItemForDay(1);
    inventory.slots[0] = { itemId: rareItem, quantity: 1 };
    shop.requestedOpenNpcId = "shopkeeper_juno";
    shop.requestedTrade = { kind: "sell", itemId: rareItem, quantity: 1 };
    system.update([entity], 1 / 60);
    expect(wallet.coins).toBe(ITEM_PRICES[rareItem]!.sell);
  });
});

describe("Shop expansion achievements", () => {
  function makeSource(overrides: Partial<AchievementSource>): AchievementSource {
    return {
      itemCount: () => 0,
      donationCount: 0,
      structureCount: 0,
      questCompletionCount: 0,
      fishCaughtCount: 0,
      totalCoinsEarned: 0,
      animalsTamedCount: 0,
      quizStreak: 0,
      housingHappiness: 0,
      craftCount: 0,
      rhythmPerfectCount: 0,
      rhythmScore: 0,
      mountBondLevel: 0,
      waterTilesTraversed: 0,
      highestFriendshipLevel: 0,
      totalGiftsGiven: 0,
      biomesDiscovered: 0,
      landmarksDiscovered: 0,
      mapCompletionPercent: 0,
      missionsCompleted: 0,
      missionStreak: 0,
      rareItemsBought: 0,
      shopsVisited: 0,
      gardenArrangements: 0,
      gardenCompetitionWins: 0,
      weatherItemsGathered: 0,
      weatherTypesGathered: 0,
      villageTier: 0,
      contributionCount: 0,
      isCategoryComplete: () => false,
      ...overrides,
    };
  }

  it("should unlock rare_collector when 3 rare items are bought", () => {
    const condition = { kind: "rare_items_bought" as const, count: 3 };
    expect(checkCondition(condition, makeSource({ rareItemsBought: 2 }))).toBe(false);
    expect(checkCondition(condition, makeSource({ rareItemsBought: 3 }))).toBe(true);
  });

  it("should unlock window_shopper when 4 shops are visited", () => {
    const condition = { kind: "shops_visited" as const, count: 4 };
    expect(checkCondition(condition, makeSource({ shopsVisited: 3 }))).toBe(false);
    expect(checkCondition(condition, makeSource({ shopsVisited: 4 }))).toBe(true);
  });
});
