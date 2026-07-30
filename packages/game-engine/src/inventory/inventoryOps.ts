import { ITEM_DEFINITIONS, type ItemId } from "@worldnest/shared";
import type {
  InventoryComponent,
  InventorySlot,
} from "../components/InventoryComponent";

/**
 * Inventory mutations as free functions rather than component methods, because
 * components are required to be pure data. Each function mutates the component
 * in place — the ECS convention here — and bumps `version` when something
 * actually changed.
 */

/**
 * Add items, filling partial stacks of the same item before empty slots.
 * Returns the quantity that did not fit.
 */
export function addItem(
  inventory: InventoryComponent,
  itemId: ItemId,
  quantity: number,
): number {
  if (quantity <= 0) return 0;

  const stackSize = ITEM_DEFINITIONS[itemId].stackSize;
  let remaining = quantity;

  for (const slot of inventory.slots) {
    if (remaining === 0) break;
    if (!slot || slot.itemId !== itemId) continue;

    const space = stackSize - slot.quantity;
    if (space <= 0) continue;

    const moved = Math.min(space, remaining);
    slot.quantity += moved;
    remaining -= moved;
  }

  for (let index = 0; index < inventory.slots.length && remaining > 0; index++) {
    if (inventory.slots[index] !== null) continue;

    const moved = Math.min(stackSize, remaining);
    inventory.slots[index] = { itemId, quantity: moved };
    remaining -= moved;
  }

  if (remaining < quantity) inventory.version++;
  return remaining;
}

/**
 * Remove up to `quantity` of an item, spanning as many slots as needed and
 * clearing slots that end up empty. Returns how many were actually removed.
 */
export function removeItem(
  inventory: InventoryComponent,
  itemId: ItemId,
  quantity: number,
): number {
  if (quantity <= 0) return 0;

  let remaining = quantity;

  for (let index = 0; index < inventory.slots.length && remaining > 0; index++) {
    const slot = inventory.slots[index];
    if (!slot || slot.itemId !== itemId) continue;

    const taken = Math.min(slot.quantity, remaining);
    slot.quantity -= taken;
    remaining -= taken;
    if (slot.quantity === 0) inventory.slots[index] = null;
  }

  const removed = quantity - remaining;
  if (removed > 0) inventory.version++;
  return removed;
}

/** Total quantity of an item across every slot. */
export function countItem(inventory: InventoryComponent, itemId: ItemId): number {
  return inventory.slots.reduce(
    (total, slot) => (slot && slot.itemId === itemId ? total + slot.quantity : total),
    0,
  );
}

/**
 * Whether `quantity` of an item would fit, counting both partial stacks and
 * empty slots. Callers that must not lose items (harvesting) check this first.
 */
export function hasSpaceFor(
  inventory: InventoryComponent,
  itemId: ItemId,
  quantity: number,
): boolean {
  if (quantity <= 0) return true;

  const stackSize = ITEM_DEFINITIONS[itemId].stackSize;
  let space = 0;

  for (const slot of inventory.slots) {
    if (slot === null) {
      space += stackSize;
    } else if (slot.itemId === itemId) {
      space += stackSize - slot.quantity;
    }
    if (space >= quantity) return true;
  }

  return false;
}

/** Contents of the selected slot, or `null` when it is empty. */
export function getSelectedItem(inventory: InventoryComponent): InventorySlot | null {
  return inventory.slots[inventory.selectedSlot] ?? null;
}

/** Select a slot, clamping the index into the available range. */
export function selectSlot(inventory: InventoryComponent, index: number): void {
  const clamped = Math.max(0, Math.min(Math.trunc(index), inventory.slots.length - 1));
  if (clamped === inventory.selectedSlot) return;

  inventory.selectedSlot = clamped;
  inventory.version++;
}

/**
 * Move a slot's contents onto another slot: stacks of the same item merge up to
 * `stackSize` (leaving any remainder behind), otherwise the two slots swap.
 */
export function moveSlot(
  inventory: InventoryComponent,
  fromIndex: number,
  toIndex: number,
): void {
  if (!isInRange(inventory, fromIndex) || !isInRange(inventory, toIndex)) return;
  if (fromIndex === toIndex) return;

  const from = inventory.slots[fromIndex];
  if (!from) return;

  const to = inventory.slots[toIndex];

  if (to && to.itemId === from.itemId) {
    const space = ITEM_DEFINITIONS[to.itemId].stackSize - to.quantity;
    const moved = Math.min(space, from.quantity);
    if (moved === 0) return;

    to.quantity += moved;
    from.quantity -= moved;
    if (from.quantity === 0) inventory.slots[fromIndex] = null;
  } else {
    inventory.slots[toIndex] = from;
    inventory.slots[fromIndex] = to;
  }

  inventory.version++;
}

function isInRange(inventory: InventoryComponent, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < inventory.slots.length;
}
