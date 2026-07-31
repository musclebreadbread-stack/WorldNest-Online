import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { InventoryComponent } from "../components/InventoryComponent";
import { ShopComponent, type ShopTrade } from "../components/ShopComponent";
import { WalletComponent } from "../components/WalletComponent";
import { applyTrade } from "../shop/shopOps";

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
  constructor() {
    super(["inventory", "wallet", "shop"]);
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
   * A trade with no shop open is refused before the maths runs, so a click that
   * lands the frame after the panel closed cannot spend anything.
   */
  private tryTrade(entity: Entity, shop: ShopComponent, trade: ShopTrade): void {
    const inventory = entity.getComponent<InventoryComponent>("inventory")!;
    const wallet = entity.getComponent<WalletComponent>("wallet")!;

    if (shop.openNpcId !== null && applyTrade(inventory, wallet, trade)) {
      shop.lastTrade = { ...trade };
      shop.tradeSeq++;
      shop.version++;
      return;
    }

    shop.refusals++;
  }

  /**
   * Snap the purse to the balance the server reported.
   *
   * The server wins, because it is the only party that cannot be edited by the
   * player. A negative number clamps at zero — a purse cannot owe coins, and a
   * malformed answer must not be able to make one. A balance that already agrees
   * is not a disagreement: nothing is counted, and nothing is published.
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
    shop.version++;
  }

  private close(shop: ShopComponent): void {
    if (shop.openNpcId === null) return;

    shop.openNpcId = null;
    shop.version++;
  }
}
