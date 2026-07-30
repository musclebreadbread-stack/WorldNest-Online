import type { ItemId } from "@worldnest/shared";

/**
 * Tile type enum representing all terrain types in the game world.
 */
export enum TileType {
  GRASS = 0,
  WATER = 1,
  SAND = 2,
  FOREST = 3,
  STONE = 4,
  FLOWERS = 5,
  /**
   * Tilled soil. Only ever produced by the modification overlay (planting), never
   * by the generator, so terrain generation stays deterministic.
   */
  FARMLAND = 6,
}

export interface TileProperties {
  walkable: boolean;
  collidable: boolean;
  /** Whether a structure may be placed on this tile. */
  buildable: boolean;
  /** Whether interacting with this tile yields an item. */
  harvestable: boolean;
  name: string;
  color: number; // hex color for rendering placeholder tiles
}

/**
 * Tile property lookup table for each tile type.
 */
export const TILE_PROPERTIES: Record<TileType, TileProperties> = {
  [TileType.GRASS]: {
    walkable: true,
    collidable: false,
    buildable: true,
    harvestable: false,
    name: "grass",
    color: 0x4caf50,
  },
  [TileType.WATER]: {
    walkable: false,
    collidable: true,
    buildable: false,
    harvestable: false,
    name: "water",
    color: 0x2196f3,
  },
  [TileType.SAND]: {
    walkable: true,
    collidable: false,
    buildable: true,
    harvestable: false,
    name: "sand",
    color: 0xfdd835,
  },
  [TileType.FOREST]: {
    walkable: true,
    collidable: false,
    buildable: false,
    harvestable: true,
    name: "forest",
    color: 0x2e7d32,
  },
  [TileType.STONE]: {
    walkable: true,
    collidable: false,
    buildable: false,
    harvestable: true,
    name: "stone",
    color: 0x757575,
  },
  [TileType.FLOWERS]: {
    walkable: true,
    collidable: false,
    buildable: false,
    harvestable: true,
    name: "flowers",
    color: 0xe91e63,
  },
  [TileType.FARMLAND]: {
    walkable: true,
    collidable: false,
    buildable: true,
    harvestable: false,
    name: "farmland",
    color: 0x8d6e63,
  },
};

export interface TileHarvestYield {
  itemId: ItemId;
  quantity: number;
  /** Energy spent on a successful harvest. */
  energyCost: number;
}

/**
 * What harvesting a tile yields. Only tiles marked `harvestable` appear here;
 * a harvested tile is replaced by grass through the modification overlay.
 */
export const TILE_HARVEST_YIELD: Partial<Record<TileType, TileHarvestYield>> = {
  [TileType.FOREST]: { itemId: "wood", quantity: 1, energyCost: 5 },
  [TileType.STONE]: { itemId: "stone", quantity: 1, energyCost: 8 },
  [TileType.FLOWERS]: { itemId: "flower", quantity: 1, energyCost: 2 },
};
