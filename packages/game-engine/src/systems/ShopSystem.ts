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
      shop.version++;
      return;
    }

    shop.refusals++;
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
