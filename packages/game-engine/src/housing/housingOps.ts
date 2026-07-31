import type { ItemId } from "@worldnest/shared";
import type { InventoryComponent } from "../components/InventoryComponent";
import { countItem } from "../inventory/inventoryOps";
import {
  FURNITURE_DEFINITIONS,
  ROOM_DEFINITIONS,
  type FurnitureCategory,
  type RoomType,
} from "./housingDefinitions";
import type { HousingState, PlacedFurniture, RoomState } from "./housingState";

/**
 * Whether the player owns a house deed and can enter the house.
 */
export function canEnterHouse(inventory: InventoryComponent): boolean {
  return countItem(inventory, "house_deed" as ItemId) >= 1;
}

/**
 * Create the initial state for a room of the given type.
 */
export function createRoom(roomType: RoomType): RoomState {
  return {
    type: roomType,
    furniture: [],
    unlocked: roomType === "living_room",
  };
}

/**
 * Create the default housing state with all four rooms (living room unlocked).
 */
export function createDefaultHousingState(): HousingState {
  return {
    rooms: [
      createRoom("living_room"),
      createRoom("bedroom"),
      createRoom("kitchen"),
      createRoom("study"),
    ],
    activeRoom: null,
    happiness: 0,
  };
}

/**
 * Whether a room can accept another piece of furniture at the given position.
 * Validates: bounds check, overlap check, max furniture limit.
 */
export function canPlaceFurniture(
  room: RoomState,
  itemId: ItemId,
  x: number,
  y: number,
): boolean {
  const def = FURNITURE_DEFINITIONS[itemId];
  if (!def) return false;

  const roomDef = ROOM_DEFINITIONS[room.type];

  // Bounds check
  if (x < 0 || y < 0) return false;
  if (x + def.sizeW > roomDef.width) return false;
  if (y + def.sizeH > roomDef.height) return false;

  // Max furniture check
  if (room.furniture.length >= roomDef.maxFurniture) return false;

  // Overlap check
  for (const placed of room.furniture) {
    const placedDef = FURNITURE_DEFINITIONS[placed.itemId];
    if (!placedDef) continue;
    if (overlaps(x, y, def.sizeW, def.sizeH, placed, placedDef)) return false;
  }

  return true;
}

function overlaps(
  x: number,
  y: number,
  w: number,
  h: number,
  placed: PlacedFurniture,
  placedDef: { sizeW: number; sizeH: number },
): boolean {
  return !(
    x + w <= placed.x ||
    placed.x + placedDef.sizeW <= x ||
    y + h <= placed.y ||
    placed.y + placedDef.sizeH <= y
  );
}

/**
 * Place furniture in a room. Returns the updated room or null if invalid.
 */
export function placeFurniture(
  room: RoomState,
  itemId: ItemId,
  x: number,
  y: number,
): RoomState | null {
  if (!canPlaceFurniture(room, itemId, x, y)) return null;
  return {
    ...room,
    furniture: [...room.furniture, { itemId, x, y }],
  };
}

/**
 * Remove furniture at the given index. Returns the updated room and the
 * item id that was removed, or null if index is out of bounds.
 */
export function removeFurniture(
  room: RoomState,
  index: number,
): { room: RoomState; removedItem: ItemId } | null {
  if (index < 0 || index >= room.furniture.length) return null;
  const removedItem = room.furniture[index].itemId;
  const furniture = [...room.furniture];
  furniture.splice(index, 1);
  return { room: { ...room, furniture }, removedItem };
}

/**
 * Calculate the happiness score (0-100) for a single room based on furniture
 * variety and count. More distinct categories and more pieces give higher scores.
 */
export function getRoomHappiness(room: RoomState): number {
  if (room.furniture.length === 0) return 0;

  const categories = new Set<FurnitureCategory>();
  for (const f of room.furniture) {
    const def = FURNITURE_DEFINITIONS[f.itemId];
    if (def) categories.add(def.category);
  }

  const roomDef = ROOM_DEFINITIONS[room.type];
  // Count factor: how full is the room (0-1)
  const countFactor = Math.min(room.furniture.length / roomDef.maxFurniture, 1);
  // Variety factor: how many distinct categories (5 total possible)
  const varietyFactor = categories.size / 5;

  // 60% variety + 40% count, scaled to 100
  const raw = (varietyFactor * 0.6 + countFactor * 0.4) * 100;
  return Math.min(Math.round(raw), 100);
}

/**
 * Calculate overall housing happiness across all unlocked rooms.
 */
export function getOverallHappiness(state: HousingState): number {
  const unlocked = state.rooms.filter((r) => r.unlocked);
  if (unlocked.length === 0) return 0;
  const total = unlocked.reduce((sum, r) => sum + getRoomHappiness(r), 0);
  return Math.round(total / unlocked.length);
}

/** Whether the player can afford to unlock a room. */
export function canUnlockRoom(coins: number, roomType: RoomType): boolean {
  const def = ROOM_DEFINITIONS[roomType];
  return coins >= def.unlockCost;
}

/**
 * Get all item ids that are placeable furniture the player has in inventory.
 */
export function getAvailableFurniture(inventory: InventoryComponent): ItemId[] {
  const available: ItemId[] = [];
  for (const slot of inventory.slots) {
    if (!slot) continue;
    if (FURNITURE_DEFINITIONS[slot.itemId] && !available.includes(slot.itemId)) {
      available.push(slot.itemId);
    }
  }
  return available;
}
