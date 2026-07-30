import { describe, it, expect, beforeEach } from "vitest";
import { ITEM_PRICES, STARTING_COINS, type ItemId } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { InventoryComponent } from "../components/InventoryComponent";
import { ShopComponent } from "../components/ShopComponent";
import { WalletComponent } from "../components/WalletComponent";
import { addItem, countItem } from "../inventory/inventoryOps";
import { buy, canTrade, sell, tradeQuote } from "../shop/shopOps";
import { ShopSystem } from "../systems/ShopSystem";

const WOOD = ITEM_PRICES.wood!;
const CHEST = ITEM_PRICES.chest!;

function createTrader(coins = STARTING_COINS) {
  const inventory = new InventoryComponent();
  const wallet = new WalletComponent(coins);
  const shop = new ShopComponent();
  const entity = new Entity("trader");
  entity.addComponent(inventory).addComponent(wallet).addComponent(shop);

  return { entity, inventory, wallet, shop };
}

/** Fill every slot with something the shop does not sell, to force "no space". */
function fillInventory(inventory: InventoryComponent): void {
  for (let index = 0; index < inventory.slots.length; index++) {
    inventory.slots[index] = { itemId: "stone", quantity: 99 };
  }
}

describe("tradeQuote", () => {
  it("should quote the buy price for a purchase and the sell price for a sale", () => {
    expect(tradeQuote("buy", "wood", 3)).toBe(WOOD.buy * 3);
    expect(tradeQuote("sell", "wood", 3)).toBe(WOOD.sell * 3);
  });

  it("should refuse a nonsensical quantity", () => {
    expect(tradeQuote("buy", "wood", 0)).toBeNull();
    expect(tradeQuote("buy", "wood", -2)).toBeNull();
  });
});

describe("buy", () => {
  it("should spend coins and add the items", () => {
    const { inventory, wallet } = createTrader();

    expect(buy(inventory, wallet, "wood", 2)).toBe(true);
    expect(countItem(inventory, "wood")).toBe(2);
    expect(wallet.coins).toBe(STARTING_COINS - WOOD.buy * 2);
  });

  it("should change nothing when the coins are not there", () => {
    const { inventory, wallet } = createTrader(CHEST.buy - 1);

    expect(buy(inventory, wallet, "chest", 1)).toBe(false);
    expect(wallet.coins).toBe(CHEST.buy - 1);
    expect(countItem(inventory, "chest")).toBe(0);
    expect(inventory.version).toBe(0);
  });

  // The failure a player would never forgive: paying for goods that vanish
  it("should change nothing, coins included, when there is no room", () => {
    const { inventory, wallet } = createTrader();
    fillInventory(inventory);

    expect(buy(inventory, wallet, "wood", 1)).toBe(false);
    expect(wallet.coins).toBe(STARTING_COINS);
  });

  it("should refuse an item the shop does not trade", () => {
    const { inventory, wallet } = createTrader();

    expect(buy(inventory, wallet, "unobtainium" as ItemId, 1)).toBe(false);
    expect(wallet.coins).toBe(STARTING_COINS);
  });
});

describe("sell", () => {
  it("should remove the items and credit the sell price", () => {
    const { inventory, wallet } = createTrader(0);
    addItem(inventory, "wood", 5);

    expect(sell(inventory, wallet, "wood", 5)).toBe(true);
    expect(countItem(inventory, "wood")).toBe(0);
    expect(wallet.coins).toBe(WOOD.sell * 5);
  });

  it("should change nothing when the whole quantity is not held", () => {
    const { inventory, wallet } = createTrader(0);
    addItem(inventory, "wood", 2);

    expect(sell(inventory, wallet, "wood", 3)).toBe(false);
    expect(countItem(inventory, "wood")).toBe(2);
    expect(wallet.coins).toBe(0);
  });

  it("should change nothing when the item is not held at all", () => {
    const { inventory, wallet } = createTrader(0);

    expect(sell(inventory, wallet, "ore", 1)).toBe(false);
    expect(wallet.coins).toBe(0);
  });

  // Decision D14: the spread is what closes the loop
  it("should always lose money on a buy-then-sell round trip", () => {
    const { inventory, wallet } = createTrader();

    buy(inventory, wallet, "wood", 4);
    sell(inventory, wallet, "wood", 4);

    expect(wallet.coins).toBeLessThan(STARTING_COINS);
  });
});

describe("canTrade", () => {
  it("should agree with what the trade actually does", () => {
    const { inventory, wallet } = createTrader(WOOD.buy);

    expect(canTrade(inventory, wallet, { kind: "buy", itemId: "wood", quantity: 1 })).toBe(
      true,
    );
    expect(
      canTrade(inventory, wallet, { kind: "buy", itemId: "wood", quantity: 2 }),
    ).toBe(false);
    expect(
      canTrade(inventory, wallet, { kind: "sell", itemId: "wood", quantity: 1 }),
    ).toBe(false);

    addItem(inventory, "wood", 1);
    expect(
      canTrade(inventory, wallet, { kind: "sell", itemId: "wood", quantity: 1 }),
    ).toBe(true);
  });
});

describe("ShopSystem", () => {
  let system: ShopSystem;

  beforeEach(() => {
    system = new ShopSystem();
  });

  it("should open and close the shop the HUD asked for", () => {
    const { entity, shop } = createTrader();

    shop.requestedOpenNpcId = "shopkeeper_juno";
    system.update([entity], 1 / 60);

    expect(shop.openNpcId).toBe("shopkeeper_juno");
    expect(shop.requestedOpenNpcId).toBeNull();
    expect(shop.version).toBe(1);

    shop.closeRequested = true;
    system.update([entity], 1 / 60);

    expect(shop.openNpcId).toBeNull();
    expect(shop.closeRequested).toBe(false);
    expect(shop.version).toBe(2);
  });

  it("should not publish a change for re-opening the same shop", () => {
    const { entity, shop } = createTrader();

    shop.requestedOpenNpcId = "shopkeeper_juno";
    system.update([entity], 1 / 60);
    shop.requestedOpenNpcId = "shopkeeper_juno";
    system.update([entity], 1 / 60);

    expect(shop.version).toBe(1);
  });

  it("should apply a requested purchase and bump the version once", () => {
    const { entity, shop, inventory, wallet } = createTrader();

    shop.requestedOpenNpcId = "shopkeeper_juno";
    shop.requestedTrade = { kind: "buy", itemId: "wood", quantity: 1 };
    system.update([entity], 1 / 60);

    expect(countItem(inventory, "wood")).toBe(1);
    expect(wallet.coins).toBe(STARTING_COINS - WOOD.buy);
    expect(shop.requestedTrade).toBeNull();
    // One bump for opening, one for the trade
    expect(shop.version).toBe(2);
    expect(shop.refusals).toBe(0);
  });

  it("should count a refused trade instead of publishing a change", () => {
    const { entity, shop, wallet } = createTrader(0);

    shop.requestedOpenNpcId = "shopkeeper_juno";
    shop.requestedTrade = { kind: "buy", itemId: "chest", quantity: 1 };
    system.update([entity], 1 / 60);

    expect(wallet.coins).toBe(0);
    expect(shop.refusals).toBe(1);
    expect(shop.version).toBe(1);
  });

  // A click that lands after the panel has gone must not spend anything
  it("should refuse a trade while no shop is open", () => {
    const { entity, shop, inventory, wallet } = createTrader();

    shop.requestedTrade = { kind: "buy", itemId: "wood", quantity: 1 };
    system.update([entity], 1 / 60);

    expect(countItem(inventory, "wood")).toBe(0);
    expect(wallet.coins).toBe(STARTING_COINS);
    expect(shop.refusals).toBe(1);
    expect(shop.version).toBe(0);
  });

  it("should require the trading components", () => {
    expect(system.requiredComponents).toEqual(["inventory", "wallet", "shop"]);
  });
});
