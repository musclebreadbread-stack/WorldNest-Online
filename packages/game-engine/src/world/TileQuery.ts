import type { TileType } from "./Tilemap";

/**
 * Read-only view of the world's tiles.
 * Systems that need to look at terrain (collision, harvesting, building) depend on
 * this interface rather than on WorldManager, which keeps them testable with a
 * hand-written fake.
 */
export interface TileQuery {
  /** Tile type at the given tile coordinates, with modifications applied. */
  getTileAt(tileX: number, tileY: number): TileType;
  /** Whether the tile under the given world pixel coordinates can be walked on. */
  isWalkableAt(pixelX: number, pixelY: number): boolean;
}

/** Map key for a tile coordinate pair, used by the modification overlay. */
export function getTileKey(tileX: number, tileY: number): string {
  return `${tileX},${tileY}`;
}

/** Parse a tile key produced by `getTileKey`. */
export function parseTileKey(key: string): { tileX: number; tileY: number } {
  const [tileX, tileY] = key.split(",").map(Number);
  return { tileX, tileY };
}
