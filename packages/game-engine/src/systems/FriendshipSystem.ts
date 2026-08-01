import type { ItemId } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import type { FriendshipComponent } from "../components/FriendshipComponent";
import type { InventoryComponent } from "../components/InventoryComponent";
import type { WalletComponent } from "../components/WalletComponent";
import { removeItem, countItem } from "../inventory/inventoryOps";
import { canGiveGift, giveGift, resetDailyGifts } from "../friendship";
import { GIFT_BOX_BONUS } from "../friendship/friendshipDefinitions";

/** Called when a gift is successfully given (for achievements). */
export type GiftGivenListener = () => void;
/** Called when a friendship reaches max level (for achievements). */
export type FriendshipMaxListener = () => void;

/**
 * FriendshipSystem processes gift requests and manages daily resets.
 *
 * - Validates gift requests (item in inventory + daily limit)
 * - Consumes item from inventory on valid gift
 * - Calculates friendship points with preference multipliers
 * - Advances friendship level and pays out level-up rewards
 * - Resets daily gift counters on day change
 */
export class FriendshipSystem extends System {
  private onGiftGiven?: GiftGivenListener;
  private onFriendshipMax?: FriendshipMaxListener;
  private getCurrentDay: () => number;

  constructor(
    getCurrentDay: () => number,
    onGiftGiven?: GiftGivenListener,
    onFriendshipMax?: FriendshipMaxListener,
  ) {
    super(["position", "interaction", "inventory", "friendship"]);
    this.getCurrentDay = getCurrentDay;
    this.onGiftGiven = onGiftGiven;
    this.onFriendshipMax = onFriendshipMax;
  }

  update(entities: Entity[], _deltaTime: number): void {
    const currentDay = this.getCurrentDay();
    for (const entity of entities) {
      const friendship = entity.getComponent<FriendshipComponent>("friendship")!;
      const inventory = entity.getComponent<InventoryComponent>("inventory")!;

      // Reset daily gifts on day change
      if (currentDay > friendship.lastResetDay) {
        friendship.entries = resetDailyGifts(friendship.entries, currentDay);
        friendship.lastResetDay = currentDay;
        friendship.version++;
      }

      // Process gift request
      if (friendship.requestGift) {
        this.processGift(friendship, inventory, entity, currentDay);
        friendship.requestGift = null;
      }
    }
  }

  private processGift(
    friendship: FriendshipComponent,
    inventory: InventoryComponent,
    entity: Entity,
    currentDay: number,
  ): void {
    const { npcId, itemId } = friendship.requestGift!;
    const entry = friendship.entries[npcId];

    if (!canGiveGift(inventory, itemId, entry, currentDay)) return;

    // Consume the item from inventory
    if (!removeItem(inventory, itemId as ItemId, 1)) return;

    // Calculate points and update state
    const result = giveGift(npcId, itemId, entry, currentDay);

    // Apply gift_box bonus: consume one gift_box and multiply points
    if (countItem(inventory, "gift_box" as ItemId) >= 1) {
      removeItem(inventory, "gift_box" as ItemId, 1);
      const bonus = Math.floor(result.pointsEarned * (GIFT_BOX_BONUS - 1));
      result.entry.points += bonus;
      result.pointsEarned += bonus;
    }

    friendship.entries[npcId] = result.entry;
    friendship.version++;

    // Pay out level-up reward
    if (result.leveledUp && result.reward > 0) {
      const wallet = entity.getComponent<WalletComponent>("wallet");
      if (wallet) {
        wallet.coins += result.reward;
      }
    }

    // Notify listeners
    this.onGiftGiven?.();
    if (result.entry.level >= 4) {
      this.onFriendshipMax?.();
    }
  }
}
