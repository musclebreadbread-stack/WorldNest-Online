import type { ItemId } from "@worldnest/shared";
import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { AchievementComponent } from "../components/AchievementComponent";
import { CollectionComponent } from "../components/CollectionComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { WalletComponent } from "../components/WalletComponent";
import { countItem } from "../inventory/inventoryOps";
import { isCategoryComplete } from "../collection/collectionOps";
import {
  ACHIEVEMENT_DEFINITIONS,
  type AchievementSource,
} from "../achievements/achievementDefinitions";
import { checkAchievement, unlockAchievement } from "../achievements/achievementOps";

/** How many structures of a kind stand in the world. Backed by `BuildSystem`. */
export type AchievementStructureCounter = (itemId: ItemId) => number;

/**
 * AchievementSystem polls achievement conditions each frame and unlocks badges
 * when conditions are met. On unlock it sets `pendingReward` on the component
 * and pays out the reward coins to the wallet.
 *
 * Requires: achievement, inventory, wallet, collection, quest.
 *
 * The system uses the same "polled progress" approach as QuestSystem: counters
 * are read from existing components each frame rather than relying on events.
 */
export class AchievementSystem extends System {
  private structureCount: AchievementStructureCounter;

  constructor(structureCount: AchievementStructureCounter = () => 0) {
    super(["achievement", "inventory", "wallet", "collection", "quest"]);
    this.structureCount = structureCount;
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const achievement = entity.getComponent<AchievementComponent>("achievement")!;
      const inventory = entity.getComponent<InventoryComponent>("inventory")!;
      const wallet = entity.getComponent<WalletComponent>("wallet")!;
      const collection = entity.getComponent<CollectionComponent>("collection")!;

      // Pay out any pending reward first
      if (achievement.pendingReward !== null) {
        const def = ACHIEVEMENT_DEFINITIONS.find(
          (d) => d.id === achievement.pendingReward,
        );
        if (def) {
          wallet.coins += def.rewardCoins;
          achievement.totalCoinsEarned += def.rewardCoins;
        }
        achievement.pendingReward = null;
      }

      // Build the polled source
      const source = this.buildSource(inventory, collection, wallet, achievement);

      // Check each achievement that has not been unlocked yet
      for (const definition of ACHIEVEMENT_DEFINITIONS) {
        if (checkAchievement(achievement, definition, source)) {
          unlockAchievement(achievement, definition.id);
          // Only unlock one per frame to avoid double-reward issues
          break;
        }
      }
    }
  }

  private buildSource(
    inventory: InventoryComponent,
    collection: CollectionComponent,
    _wallet: WalletComponent,
    achievement: AchievementComponent,
  ): AchievementSource {
    return {
      itemCount: (itemId: string) => countItem(inventory, itemId as ItemId),
      donationCount: collection.discovered.size,
      structureCount: this.totalStructures(),
      questCompletionCount: achievement.totalQuestsCompleted,
      fishCaughtCount: achievement.totalFishCaught,
      totalCoinsEarned: achievement.totalCoinsEarned,
      isCategoryComplete: (categoryId: string) =>
        isCategoryComplete(collection, categoryId),
    };
  }

  private totalStructures(): number {
    let total = 0;
    const structureIds: ItemId[] = ["fence", "chest", "path_stone"];
    for (const id of structureIds) {
      total += this.structureCount(id);
    }
    return total;
  }
}
