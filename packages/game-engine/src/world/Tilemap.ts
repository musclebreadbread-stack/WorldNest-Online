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
  /**
   * Biome and cave terrain. New generated ids start at 7 so `FARMLAND` keeps its
   * override-only meaning and persisted `world_modifications.tile_type` values
   * stay stable.
   */
  SNOW = 7,
  CAVE_FLOOR = 8,
  CAVE_WALL = 9,
  ORE = 10,
  CAVE_ENTRANCE = 11,
  PATH = 12,
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
  [TileType.SNOW]: {
    walkable: true,
    collidable: false,
    buildable: true,
    harvestable: false,
    name: "snow",
    color: 0xeceff1,
  },
  [TileType.CAVE_FLOOR]: {
    walkable: true,
    collidable: false,
    buildable: false,
    harvestable: false,
    name: "cave floor",
    color: 0x4e342e,
  },
  [TileType.CAVE_WALL]: {
    walkable: false,
    collidable: true,
    buildable: false,
    harvestable: false,
    name: "cave wall",
    color: 0x212121,
  },
  [TileType.ORE]: {
    walkable: true,
    collidable: false,
    buildable: false,
    harvestable: true,
    name: "ore",
    color: 0x9575cd,
  },
  [TileType.CAVE_ENTRANCE]: {
    walkable: true,
    collidable: false,
    buildable: false,
    harvestable: false,
    name: "cave entrance",
    color: 0x6d4c41,
  },
  [TileType.PATH]: {
    walkable: true,
    collidable: false,
    buildable: true,
    harvestable: false,
    name: "path",
    color: 0x9e9e9e,
  },
};

export interface TileHarvestYield {
  itemId: ItemId;
  quantity: number;
  /** Energy spent on a successful harvest. */
  energyCost: number;
  /**
   * Tile left behind. Defaults to grass; cave tiles set it so mining underground
   * does not leave a patch of grassland in the dark.
   */
  replacementTile?: TileType;
}

/**
 * What harvesting a tile yields. Only tiles marked `harvestable` appear here;
 * a harvested tile is replaced by `replacementTile` (grass unless stated)
 * through the modification overlay.
 */
export const TILE_HARVEST_YIELD: Partial<Record<TileType, TileHarvestYield>> = {
  [TileType.FOREST]: { itemId: "wood", quantity: 1, energyCost: 5 },
  [TileType.STONE]: { itemId: "stone", quantity: 1, energyCost: 8 },
  [TileType.FLOWERS]: { itemId: "flower", quantity: 1, energyCost: 2 },
  [TileType.ORE]: {
    itemId: "ore",
    quantity: 1,
    energyCost: 10,
    replacementTile: TileType.CAVE_FLOOR,
  },
};
