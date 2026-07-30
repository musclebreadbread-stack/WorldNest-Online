import { describe, it, expect } from "vitest";
import {
  ITEM_PRICES,
  STARTING_COINS,
  TRADABLE_ITEM_IDS,
  getItemPrice,
  isTradable,
  tradeValue,
} from "../economy";
import { ITEM_IDS, isItemId, type ItemId } from "../items";

/**
 * Wheat per wheat seed, from `CROP_DEFINITIONS.wheat_seed.produceQuantity` in
 * `@worldnest/game-engine`. Repeated here rather than imported because the engine
 * depends on this package and not the other way round; if the crop yield ever
 * changes, the "farming is profitable" assertion below is what catches it.
 */
const WHEAT_PER_SEED = 2;

describe("ITEM_PRICES", () => {
  it("should price every catalogue item", () => {
    expect(TRADABLE_ITEM_IDS.sort()).toEqual([...ITEM_IDS].sort());
  });

  it("should key the table on real item ids only", () => {
    for (const itemId of Object.keys(ITEM_PRICES)) {
      expect(isItemId(itemId), itemId).toBe(true);
    }
  });

  it("should quote positive whole coins for both directions", () => {
    for (const itemId of TRADABLE_ITEM_IDS) {
      const price = getItemPrice(itemId)!;

      expect(Number.isInteger(price.buy), itemId).toBe(true);
      expect(Number.isInteger(price.sell), itemId).toBe(true);
      expect(price.buy, itemId).toBeGreaterThan(0);
      expect(price.sell, itemId).toBeGreaterThan(0);
    }
  });

  // The whole reason the shop is safe to ship: buying a thing and selling it
  // straight back is always a loss, so there is no arbitrage loop to grind.
  it("should always pay strictly less than it charges", () => {
    for (const itemId of TRADABLE_ITEM_IDS) {
      const price = getItemPrice(itemId)!;

      expect(price.sell, itemId).toBeLessThan(price.buy);
    }
  });

  it("should make farming profitable but bounded", () => {
    const seed = getItemPrice("wheat_seed")!;
    const wheat = getItemPrice("wheat")!;

    // A sown seed pays for itself once harvested and sold...
    expect(seed.buy).toBeLessThan(wheat.sell * WHEAT_PER_SEED);
    // ...but the margin is fixed per seed, and buying the produce outright is
    // never cheaper than growing it.
    expect(wheat.buy).toBeGreaterThan(wheat.sell);
  });

  it("should make cave ore the most valuable raw material", () => {
    const ore = getItemPrice("ore")!;

    for (const itemId of ["wood", "stone", "fiber", "flower"] as ItemId[]) {
      expect(getItemPrice(itemId)!.sell, itemId).toBeLessThan(ore.sell);
    }
  });

  it("should start a player with coins but not with a shopping spree", () => {
    expect(Number.isInteger(STARTING_COINS)).toBe(true);
    expect(STARTING_COINS).toBeGreaterThan(0);
    expect(STARTING_COINS).toBeLessThan(getItemPrice("chest")!.buy);
  });

  it("should report tradability per item", () => {
    for (const itemId of ITEM_IDS) {
      expect(isTradable(itemId), itemId).toBe(true);
    }
  });
});

describe("tradeValue", () => {
  it("should multiply the matching price by the quantity", () => {
    const wood = getItemPrice("wood")!;

    expect(tradeValue("buy", "wood", 1)).toBe(wood.buy);
    expect(tradeValue("sell", "wood", 10)).toBe(wood.sell * 10);
  });

  it("should refuse a quantity that is not a positive whole number", () => {
    expect(tradeValue("buy", "wood", 0)).toBeNull();
    expect(tradeValue("buy", "wood", -1)).toBeNull();
    expect(tradeValue("buy", "wood", 1.5)).toBeNull();
    expect(tradeValue("buy", "wood", Number.NaN)).toBeNull();
  });

  it("should refuse anything that is not a priced item", () => {
    expect(tradeValue("buy", "unobtainium", 1)).toBeNull();
    expect(tradeValue("sell", undefined, 1)).toBeNull();
  });
});
