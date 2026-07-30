import { INVENTORY_SLOTS, isItemId } from "@worldnest/shared";
import type { InventoryComponent, InventorySlot } from "@worldnest/game-engine";
import type { PersistedInventory, PersistedInventorySlot } from "@worldnest/database";

/**
 * Convert the live inventory component into the shape stored in
 * `player_state.inventory`.
 */
export function toPersistedInventory(inventory: InventoryComponent): PersistedInventory {
  return {
    slots: inventory.slots.map((slot) =>
      slot ? { itemId: slot.itemId, quantity: slot.quantity } : null,
    ),
    selectedSlot: inventory.selectedSlot,
  };
}

/**
 * Validate a raw `inventory` jsonb blob.
 *
 * Returns `null` for anything that is not a saved inventory — including the
 * `{}` default the schema inserts for a brand-new player — which is the signal
 * to grant the starting kit instead of restoring.
 */
export function parsePersistedInventory(raw: unknown): PersistedInventory | null {
  if (typeof raw !== "object" || raw === null) return null;

  const candidate = raw as { slots?: unknown; selectedSlot?: unknown };
  if (!Array.isArray(candidate.slots)) return null;

  const slots = candidate.slots.map(parseSlot);
  const selectedSlot =
    typeof candidate.selectedSlot === "number" ? candidate.selectedSlot : 0;

  return { slots, selectedSlot };
}

/**
 * Overwrite an inventory with saved contents. Restoring replaces the slot array
 * rather than adding to it, so a returning player does not accumulate the
 * starting kit on every login.
 */
export function restoreInventory(
  inventory: InventoryComponent,
  saved: PersistedInventory,
): void {
  const slotCount = inventory.slots.length || INVENTORY_SLOTS;
  const slots = new Array<InventorySlot | null>(slotCount).fill(null);

  for (let index = 0; index < Math.min(slotCount, saved.slots.length); index++) {
    const slot = saved.slots[index];
    if (!slot || !isItemId(slot.itemId) || slot.quantity < 1) continue;

    slots[index] = { itemId: slot.itemId, quantity: Math.floor(slot.quantity) };
  }

  inventory.slots = slots;
  inventory.selectedSlot = clampSlot(saved.selectedSlot, slotCount);
  // The HUD detects inventory changes by version, so a restore has to bump it.
  inventory.version += 1;
}

function parseSlot(raw: unknown): PersistedInventorySlot | null {
  if (typeof raw !== "object" || raw === null) return null;

  const candidate = raw as { itemId?: unknown; quantity?: unknown };
  if (!isItemId(candidate.itemId)) return null;
  if (typeof candidate.quantity !== "number" || candidate.quantity < 1) return null;

  return { itemId: candidate.itemId, quantity: candidate.quantity };
}

function clampSlot(selectedSlot: number, slotCount: number): number {
  if (!Number.isFinite(selectedSlot)) return 0;

  return Math.min(Math.max(Math.floor(selectedSlot), 0), slotCount - 1);
}
