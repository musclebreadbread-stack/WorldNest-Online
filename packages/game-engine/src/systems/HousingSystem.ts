import type { ItemId } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import type { HousingComponent } from "../components/HousingComponent";
import type { InventoryComponent } from "../components/InventoryComponent";
import type { WalletComponent } from "../components/WalletComponent";
import {
  canEnterHouse,
  canPlaceFurniture,
  canUnlockRoom,
  getOverallHappiness,
  placeFurniture,
  removeFurniture,
  ROOM_DEFINITIONS,
} from "../housing";
import { addItem, countItem, removeItem } from "../inventory/inventoryOps";
import type { RoomState } from "../housing/housingState";

/**
 * HousingSystem processes the player's interior housing state machine.
 *
 * Handles:
 * - Enter/exit house (validates house deed ownership)
 * - Furniture placement (consumes item from inventory)
 * - Furniture removal (returns item to inventory)
 * - Room unlocking (deducts coins from wallet)
 *
 * All ops are validated through pure functions before applying.
 */
export class HousingSystem extends System {
  constructor() {
    super(["housing", "inventory", "wallet"]);
  }

  update(entities: Entity[]): void {
    for (const entity of entities) {
      const housing = entity.getComponent<HousingComponent>("housing")!;
      const inventory = entity.getComponent<InventoryComponent>("inventory")!;
      const wallet = entity.getComponent<WalletComponent>("wallet")!;

      this.handleEnter(housing, inventory);
      this.handleExit(housing);
      this.handlePlace(housing, inventory);
      this.handleRemove(housing, inventory);
      this.handleUnlock(housing, wallet);
    }
  }

  private handleEnter(housing: HousingComponent, inventory: InventoryComponent): void {
    if (!housing.enterRequested) return;
    housing.enterRequested = false;

    if (housing.state.activeRoom !== null) return;
    if (!canEnterHouse(inventory)) return;

    housing.state.activeRoom = "living_room";
    housing.version++;
  }

  private handleExit(housing: HousingComponent): void {
    if (!housing.exitRequested) return;
    housing.exitRequested = false;

    if (housing.state.activeRoom === null) return;

    housing.state.activeRoom = null;
    housing.version++;
  }

  private handlePlace(housing: HousingComponent, inventory: InventoryComponent): void {
    if (!housing.placeRequested) return;
    const { roomType, itemId, x, y } = housing.placeRequested;
    housing.placeRequested = null;

    const room = this.findRoom(housing, roomType);
    if (!room || !room.unlocked) return;

    if (countItem(inventory, itemId) < 1) return;
    if (!canPlaceFurniture(room, itemId, x, y)) return;

    const updated = placeFurniture(room, itemId, x, y);
    if (!updated) return;

    removeItem(inventory, itemId, 1);
    this.updateRoom(housing, roomType, updated);
    housing.state.happiness = getOverallHappiness(housing.state);
    housing.version++;
  }

  private handleRemove(housing: HousingComponent, inventory: InventoryComponent): void {
    if (!housing.removeRequested) return;
    const { roomType, index } = housing.removeRequested;
    housing.removeRequested = null;

    const room = this.findRoom(housing, roomType);
    if (!room || !room.unlocked) return;

    const result = removeFurniture(room, index);
    if (!result) return;

    addItem(inventory, result.removedItem as ItemId, 1);
    this.updateRoom(housing, roomType, result.room);
    housing.state.happiness = getOverallHappiness(housing.state);
    housing.version++;
  }

  private handleUnlock(housing: HousingComponent, wallet: WalletComponent): void {
    if (!housing.unlockRequested) return;
    const roomType = housing.unlockRequested;
    housing.unlockRequested = null;

    const room = this.findRoom(housing, roomType);
    if (!room || room.unlocked) return;
    if (!canUnlockRoom(wallet.coins, roomType)) return;

    const def = ROOM_DEFINITIONS[roomType];
    wallet.coins -= def.unlockCost;
    room.unlocked = true;
    housing.version++;
  }

  private findRoom(housing: HousingComponent, roomType: string): RoomState | undefined {
    return housing.state.rooms.find((r) => r.type === roomType);
  }

  private updateRoom(
    housing: HousingComponent,
    roomType: string,
    updated: RoomState,
  ): void {
    const idx = housing.state.rooms.findIndex((r) => r.type === roomType);
    if (idx >= 0) housing.state.rooms[idx] = updated;
  }
}
