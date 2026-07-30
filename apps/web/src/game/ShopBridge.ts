import type { Entity, ShopComponent } from "@worldnest/game-engine";
import { useShopStore } from "../stores/shopStore";

/**
 * Give `shopStore` the three callbacks that reach the engine.
 *
 * The whole of the React → ECS seam for trading (decision D13): the panel asks,
 * `ShopSystem` decides. Nothing here touches a wallet or an inventory, which is
 * why a refused trade can never leave the HUD showing coins that were spent.
 *
 * Returns a teardown function for whoever wired it.
 */
export function wireShop(playerEntity: Entity): () => void {
  const shop = playerEntity.getComponent<ShopComponent>("shop");
  if (!shop) return () => undefined;

  useShopStore.getState().setCallbacks(
    (kind, itemId, quantity) => {
      shop.requestedTrade = { kind, itemId, quantity };
    },
    (npcId) => {
      shop.requestedOpenNpcId = npcId;
    },
    () => {
      shop.closeRequested = true;
    },
  );

  return () => useShopStore.getState().setCallbacks(null, null, null);
}
