import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { GardeningComponent } from "../components/GardeningComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { WalletComponent } from "../components/WalletComponent";
import {
  createArrangement,
  enterCompetition,
  plantFlower,
  waterGarden,
} from "../gardening/gardeningOps";
import { addItem, removeItem } from "../inventory";
import type { FlowerVariety } from "../gardening/gardeningDefinitions";
import type { ItemId } from "@worldnest/shared";

/** Maximum garden plots a player can maintain. */
const MAX_PLOTS = 8;

/** Map FlowerVariety to its ItemId for inventory operations. */
function flowerToItemId(flower: FlowerVariety): ItemId {
  return flower as ItemId; // enum values match item ids
}

/**
 * GardeningSystem consumes request fields on GardeningComponent,
 * calls gardeningOps, manages inventory, and awards coins.
 *
 * Requires: gardening, inventory, wallet.
 */
export class GardeningSystem extends System {
  private nowFn: () => number;

  constructor(nowFn: () => number) {
    super(["gardening", "inventory", "wallet"]);
    this.nowFn = nowFn;
  }

  update(entities: Entity[], _deltaTime: number): void {
    const now = this.nowFn();
    for (const entity of entities) {
      const gardening = entity.getComponent<GardeningComponent>("gardening")!;
      const inventory = entity.getComponent<InventoryComponent>("inventory")!;
      const wallet = entity.getComponent<WalletComponent>("wallet")!;

      this.consumePlant(gardening, inventory, now);
      this.consumeWater(gardening, now);
      this.consumeArrange(gardening, inventory, now);
      this.consumeCompete(gardening, wallet, now);
    }
  }

  private consumePlant(
    gardening: GardeningComponent,
    inventory: InventoryComponent,
    now: number,
  ): void {
    if (gardening.pendingPlant === null) return;
    const flower = gardening.pendingPlant;
    gardening.pendingPlant = null;
    const itemId = flowerToItemId(flower);
    if (!removeItem(inventory, itemId, 1)) return;
    if (!plantFlower(gardening, flower, now, MAX_PLOTS)) {
      addItem(inventory, itemId, 1);
    }
  }

  private consumeWater(gardening: GardeningComponent, now: number): void {
    if (!gardening.pendingWater) return;
    gardening.pendingWater = false;
    waterGarden(gardening, now);
  }

  private consumeArrange(
    gardening: GardeningComponent,
    inventory: InventoryComponent,
    now: number,
  ): void {
    if (gardening.pendingArrange === null) return;
    const flowers = gardening.pendingArrange;
    gardening.pendingArrange = null;
    // Remove flowers from inventory
    const removed: FlowerVariety[] = [];
    for (const f of flowers) {
      if (removeItem(inventory, flowerToItemId(f), 1)) {
        removed.push(f);
      } else {
        // Refund already removed
        for (const r of removed) addItem(inventory, flowerToItemId(r), 1);
        return;
      }
    }
    const result = createArrangement(gardening, flowers, now);
    if (!result) {
      for (const r of removed) addItem(inventory, flowerToItemId(r), 1);
    } else {
      addItem(inventory, "flower_arrangement" as ItemId, 1);
    }
  }

  private consumeCompete(
    gardening: GardeningComponent,
    wallet: WalletComponent,
    now: number,
  ): void {
    if (gardening.pendingCompete === null) return;
    const index = gardening.pendingCompete;
    gardening.pendingCompete = null;
    const entry = enterCompetition(gardening, index, now);
    if (entry) {
      wallet.coins += entry.reward;
    }
  }
}
