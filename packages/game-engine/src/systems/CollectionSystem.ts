import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { CollectionComponent } from "../components/CollectionComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { WalletComponent } from "../components/WalletComponent";
import { COLLECTION_CATEGORIES } from "../collection/collectionDefinitions";
import {
  claimCategoryReward,
  donate,
  isCategoryComplete,
} from "../collection/collectionOps";

/**
 * CollectionSystem processes donation requests and auto-claims category rewards.
 *
 * Required components: collection, inventory, wallet. The HUD raises
 * `requestedDonation` on the collection component and this system consumes it
 * on the next frame -- the same "raise a flag, consume it next frame" shape
 * every other request in the engine uses.
 */
export class CollectionSystem extends System {
  constructor() {
    super(["collection", "inventory", "wallet"]);
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const collection = entity.getComponent<CollectionComponent>("collection")!;
      const inventory = entity.getComponent<InventoryComponent>("inventory")!;
      const wallet = entity.getComponent<WalletComponent>("wallet")!;

      if (collection.requestedDonation !== null) {
        const itemId = collection.requestedDonation;
        collection.requestedDonation = null;

        if (donate(collection, inventory, itemId)) {
          // Check all categories for auto-reward claiming
          for (const category of COLLECTION_CATEGORIES) {
            if (
              isCategoryComplete(collection, category.id) &&
              !collection.categoryRewardsClaimed.has(category.id)
            ) {
              claimCategoryReward(collection, wallet, category.id);
            }
          }
        }
      }
    }
  }
}
