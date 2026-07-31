import type { ItemId } from "@worldnest/shared";

/**
 * Room types available in the player's house. Each room serves a different
 * function and has unique capacity and unlock requirements.
 */
export type RoomType = "living_room" | "bedroom" | "kitchen" | "study";

export interface RoomDefinition {
  id: RoomType;
  /** Width in tiles. */
  width: number;
  /** Height in tiles. */
  height: number;
  /** Maximum number of furniture pieces allowed. */
  maxFurniture: number;
  /** Coins required to unlock (the living room is free). */
  unlockCost: number;
  /** i18n key for the room name. */
  titleKey: string;
}

export const ROOM_DEFINITIONS: Record<RoomType, RoomDefinition> = {
  living_room: {
    id: "living_room",
    width: 6,
    height: 5,
    maxFurniture: 8,
    unlockCost: 0,
    titleKey: "housing.room.living_room",
  },
  bedroom: {
    id: "bedroom",
    width: 5,
    height: 4,
    maxFurniture: 6,
    unlockCost: 100,
    titleKey: "housing.room.bedroom",
  },
  kitchen: {
    id: "kitchen",
    width: 5,
    height: 5,
    maxFurniture: 7,
    unlockCost: 120,
    titleKey: "housing.room.kitchen",
  },
  study: {
    id: "study",
    width: 4,
    height: 4,
    maxFurniture: 5,
    unlockCost: 150,
    titleKey: "housing.room.study",
  },
};

export type FurnitureCategory =
  "seating" | "sleeping" | "lighting" | "storage" | "decorative";

export interface FurnitureDefinition {
  itemId: ItemId;
  /** Size in tiles (width x height, always 1x1 for simplicity). */
  sizeW: number;
  sizeH: number;
  category: FurnitureCategory;
}

/**
 * Maps placeable furniture item ids to their definitions.
 */
export const FURNITURE_DEFINITIONS: Partial<Record<ItemId, FurnitureDefinition>> = {
  table: { itemId: "table", sizeW: 1, sizeH: 1, category: "seating" },
  chair: { itemId: "chair", sizeW: 1, sizeH: 1, category: "seating" },
  bed: { itemId: "bed", sizeW: 1, sizeH: 1, category: "sleeping" },
  lamp: { itemId: "lamp", sizeW: 1, sizeH: 1, category: "lighting" },
  bookshelf: { itemId: "bookshelf", sizeW: 1, sizeH: 1, category: "storage" },
  rug: { itemId: "rug", sizeW: 1, sizeH: 1, category: "decorative" },
  painting: { itemId: "painting", sizeW: 1, sizeH: 1, category: "decorative" },
  plant_pot: {
    itemId: "plant_pot",
    sizeW: 1,
    sizeH: 1,
    category: "decorative",
  },
  window_curtain: {
    itemId: "window_curtain",
    sizeW: 1,
    sizeH: 1,
    category: "decorative",
  },
};

export const ROOM_TYPES: RoomType[] = Object.keys(ROOM_DEFINITIONS) as RoomType[];

/** Look up a furniture definition by item id. */
export function getFurnitureDefinition(
  itemId: ItemId,
): FurnitureDefinition | undefined {
  return FURNITURE_DEFINITIONS[itemId];
}
