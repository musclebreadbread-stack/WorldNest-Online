import { INVENTORY_SLOTS, type ItemId } from "@worldnest/shared";
import { Component } from "../ecs/Component";

/** One occupied inventory slot. `null` in the slot array means empty. */
export interface InventorySlot {
  itemId: ItemId;
  quantity: number;
}

/**
 * Fixed-size slot grid plus the currently selected slot.
 *
 * Pure data by design: every mutation lives in `inventory/inventoryOps.ts`.
 * `version` is bumped by those operations so the UI layer can detect changes
 * without deep-comparing the slot array every frame.
 */
export class InventoryComponent extends Component {
  public slots: Array<InventorySlot | null>;
  public selectedSlot: number;
  public version: number;

  constructor(slotCount: number = INVENTORY_SLOTS) {
    super("inventory");
    this.slots = new Array<InventorySlot | null>(slotCount).fill(null);
    this.selectedSlot = 0;
    this.version = 0;
  }
}
