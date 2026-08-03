import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { InventoryComponent } from "../components/InventoryComponent";
import { ShopComponent, type ShopTrade } from "../components/ShopComponent";
import { WalletComponent } from "../components/WalletComponent";
import { addItem, countItem, hasSpaceFor, removeItem } from "../inventory/inventoryOps";
import { applyTrade } from "../shop/shopOps";
import { NPC_SHOP_CATALOGUES, getSeasonalDiscount } from "../shop/shopCatalogue";
import {
  getEffectivePrice,
  getNpcShopItems,
  isRareItem,
} from "../shop/shopExpansionOps";
import type { Season } from "../world/Seasons";

/** Injected getter for the current season. */
export type SeasonGetter = () => Season;

/** Injected getter for the current day number. */
export type ShopDayGetter = () => number;

/**
 * ShopSystem is the only writer of shop state and of the coin purse.
 *
 * It consumes the three request fields the HUD raises (decision D13) in the order
 * a player would expect them: open, then trade, then close. A trade is refused
 * outright unless a shop is actually open, so a stale request that arrives after
 * the panel has gone cannot spend anything.
 *
 * It is also the only applier of `WalletComponent.requestedBalance`, the seam the
 * server reconciles through (decision D4). The reconciliation is consumed
 * **before** this frame's trade, so a balance the server sent about an earlier
 * trade cannot undo a purchase the player has just made.
 *
 * Registered immediately after `NpcSystem`, because opening a shop is something a
 * conversation asks for and the conversation is resolved one system earlier.
 */
export class ShopSystem extends System {
  private getSeason: SeasonGetter;
  private getDay: ShopDayGetter;

  constructor(
    getSeason: SeasonGetter = () => 0 as Season,
    getDay: ShopDayGetter = () => 1,
  ) {
    super(["inventory", "wallet", "shop"]);
    this.getSeason = getSeason;
    this.getDay = getDay;
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const shop = entity.getComponent<ShopComponent>("shop")!;
      const wallet = entity.getComponent<WalletComponent>("wallet")!;

      if (wallet.requestedBalance !== null) {
        this.reconcile(wallet, wallet.requestedBalance);
        wallet.requestedBalance = null;
      }

      if (shop.requestedOpenNpcId !== null) {
        this.open(shop, shop.requestedOpenNpcId);
        shop.requestedOpenNpcId = null;
      }

      if (shop.requestedTrade !== null) {
        this.tryTrade(entity, shop, shop.requestedTrade);
        shop.requestedTrade = null;
      }

      if (shop.closeRequested) {
        this.close(shop);
        shop.closeRequested = false;
      }
    }
  }

  /**
   * Make a trade, or record that it was turned down.
   *
   * When an NPC shop is open and the NPC is in our catalogue, use the
   * expansion pricing. Otherwise fall back to the flat-price applyTrade.
   */
  private tryTrade(entity: Entity, shop: ShopComponent, trade: ShopTrade): void {
    const inventory = entity.getComponent<InventoryComponent>("inventory")!;
    const wallet = entity.getComponent<WalletComponent>("wallet")!;

    if (shop.openNpcId === null) {
      shop.refusals++;
      return;
    }

    const npcId = shop.openNpcId;
    const catalogue = NPC_SHOP_CATALOGUES[npcId];

    // If the NPC is in our catalogue, use expansion pricing
    if (catalogue) {
      const success = this.applyNpcTrade(inventory, wallet, shop, trade, npcId);
      if (success) {
        shop.lastTrade = { ...trade };
        shop.tradeSeq++;
        shop.version++;
        return;
      }
      shop.refusals++;
      return;
    }

    // Fallback to generic trade for non-catalogue NPCs
    if (applyTrade(inventory, wallet, trade)) {
      shop.lastTrade = { ...trade };
      shop.tradeSeq++;
      shop.version++;
      return;
    }

    shop.refusals++;
  }

  /**
   * Apply a trade using NPC expansion pricing. Returns true on success.
   */
  private applyNpcTrade(
    inventory: InventoryComponent,
    wallet: WalletComponent,
    shop: ShopComponent,
    trade: ShopTrade,
    npcId: string,
  ): boolean {
    const season = this.getSeason();
    const day = this.getDay();
    const effectivePrice = getEffectivePrice(
      trade.kind,
      trade.itemId,
      npcId,
      season,
      day,
    );
    if (effectivePrice === null) return false;

    const total = effectivePrice * trade.quantity;

    if (trade.kind === "buy") {
      if (wallet.coins < total) return false;
      if (!hasSpaceFor(inventory, trade.itemId, trade.quantity)) return false;
      wallet.coins -= total;
      addItem(inventory, trade.itemId, trade.quantity);
      // Track rare item purchases
      if (isRareItem(trade.itemId, day)) {
        shop.rareItemsPurchased += trade.quantity;
      }
      return true;
    }

    // Sell
    if (countItem(inventory, trade.itemId) < trade.quantity) return false;
    removeItem(inventory, trade.itemId, trade.quantity);
    wallet.coins += total;
    return true;
  }

  /**
   * Snap the purse to the balance the server reported.
   */
  private reconcile(wallet: WalletComponent, balance: number): void {
    const settled = Math.max(0, Math.floor(balance));
    if (settled === wallet.coins) return;

    wallet.coins = settled;
    wallet.adjustments++;
  }

  /** Open a shop. Re-opening the same one is not a change worth publishing. */
  private open(shop: ShopComponent, npcId: string): void {
    if (shop.openNpcId === npcId) return;

    shop.openNpcId = npcId;
    shop.shopsVisited.add(npcId);

    // Populate NPC shop items if the NPC is in our catalogue
    const catalogue = NPC_SHOP_CATALOGUES[npcId];
    if (catalogue) {
      const day = this.getDay();
      const season = this.getSeason();
      shop.currentNpcShopItems = getNpcShopItems(npcId, day);
      // Only flag seasonal discount as active if at least one item in the
      // catalogue actually has a seasonal discount for the current season.
      shop.seasonalDiscountActive = shop.currentNpcShopItems.some(
        (itemId) => getSeasonalDiscount(season, itemId) > 0,
      );
    } else {
      shop.currentNpcShopItems = null;
      shop.seasonalDiscountActive = false;
    }

    shop.version++;
  }

  private close(shop: ShopComponent): void {
    if (shop.openNpcId === null) return;

    shop.openNpcId = null;
    shop.currentNpcShopItems = null;
    shop.seasonalDiscountActive = false;
    shop.version++;
  }
}
