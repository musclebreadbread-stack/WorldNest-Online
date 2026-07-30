import type { TileType } from "./Tilemap";
import type { TileQuery } from "./TileQuery";

/**
 * A square window of tile ids around a centre tile.
 *
 * Row-major, so index `y * size + x` addresses the tile at
 * `(originTileX + x, originTileY + y)` and the centre is always at
 * `radius * size + radius`.
 */
export interface MinimapSample {
  originTileX: number;
  originTileY: number;
  size: number;
  tiles: Uint8Array;
}

/**
 * Sample the terrain around a tile for the minimap.
 *
 * Pure, and deliberately in the engine rather than in the Phaser layer: the
 * renderer only maps ids to `TILE_PROPERTIES[t].color`, so the sampling logic is
 * testable with no canvas. `WorldManager` generates out-of-range chunks on
 * demand, so a window larger than the loaded chunks is safe.
 *
 * A `Uint8Array` is enough because every `TileType` is a small id, and it keeps
 * the per-redraw allocation to `size ** 2` bytes.
 */
export function sampleMinimap(
  tileQuery: TileQuery,
  centerTileX: number,
  centerTileY: number,
  radius: number,
): MinimapSample {
  const size = 2 * radius + 1;
  const originTileX = centerTileX - radius;
  const originTileY = centerTileY - radius;
  const tiles = new Uint8Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      tiles[y * size + x] = tileQuery.getTileAt(originTileX + x, originTileY + y);
    }
  }

  return { originTileX, originTileY, size, tiles };
}

/** Tile id at a sample-local offset, or `undefined` when outside the window. */
export function minimapTileAt(
  sample: MinimapSample,
  x: number,
  y: number,
): TileType | undefined {
  if (x < 0 || y < 0 || x >= sample.size || y >= sample.size) return undefined;

  return sample.tiles[y * sample.size + x] as TileType;
}
