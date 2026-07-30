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
}

export interface TileProperties {
  walkable: boolean;
  collidable: boolean;
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
    name: "grass",
    color: 0x4caf50,
  },
  [TileType.WATER]: {
    walkable: false,
    collidable: true,
    name: "water",
    color: 0x2196f3,
  },
  [TileType.SAND]: {
    walkable: true,
    collidable: false,
    name: "sand",
    color: 0xfdd835,
  },
  [TileType.FOREST]: {
    walkable: true,
    collidable: false,
    name: "forest",
    color: 0x2e7d32,
  },
  [TileType.STONE]: {
    walkable: true,
    collidable: false,
    name: "stone",
    color: 0x757575,
  },
  [TileType.FLOWERS]: {
    walkable: true,
    collidable: false,
    name: "flowers",
    color: 0xe91e63,
  },
};
