import { TILE_PROPERTIES, TileType } from "./Tilemap";
import type { TileQuery } from "./TileQuery";

/**
 * Deterministic NPC placement (decision D12).
 *
 * Terrain is generated from a seed, so an anchor plus a fixed search order gives
 * every client the same answer with no coordination — which is the whole reason
 * NPCs can exist at all in a client-authoritative game.
 */

/** Tiles that are underground. An NPC standing in a cave would never be found. */
const CAVE_TILES: readonly TileType[] = [
  TileType.CAVE_FLOOR,
  TileType.CAVE_WALL,
  TileType.ORE,
];

/** How far from its anchor an NPC may be moved before it is dropped entirely. */
export const NPC_PLACEMENT_MAX_RADIUS = 12;

export interface NpcTile {
  tileX: number;
  tileY: number;
}

/**
 * Whether an NPC can stand on a tile: walkable so the player can reach it,
 * buildable so it is open ground rather than a tree or a rock, and above ground.
 * `buildable` is what keeps NPCs off forest and stone tiles without a second
 * list to maintain.
 */
export function isNpcPlaceableTile(
  tileQuery: TileQuery,
  tileX: number,
  tileY: number,
): boolean {
  const tileType = tileQuery.getTileAt(tileX, tileY);
  if (CAVE_TILES.includes(tileType)) return false;

  const properties = TILE_PROPERTIES[tileType];
  return properties.walkable && properties.buildable;
}

/**
 * Nearest tile to the anchor an NPC can stand on, searched as expanding square
 * rings so the result only depends on the seed. `isTaken` lets the caller keep
 * two NPCs with nearby anchors off the same tile.
 *
 * Returns `null` when nothing suitable exists within `maxRadius`; the caller
 * skips that NPC rather than placing it somewhere unreachable.
 */
export function resolveNpcTile(
  tileQuery: TileQuery,
  anchorTileX: number,
  anchorTileY: number,
  maxRadius: number = NPC_PLACEMENT_MAX_RADIUS,
  isTaken: (tileX: number, tileY: number) => boolean = () => false,
): NpcTile | null {
  for (let radius = 0; radius <= maxRadius; radius++) {
    for (const { dx, dy } of ringOffsets(radius)) {
      const tileX = anchorTileX + dx;
      const tileY = anchorTileY + dy;
      if (isTaken(tileX, tileY)) continue;
      if (isNpcPlaceableTile(tileQuery, tileX, tileY)) return { tileX, tileY };
    }
  }

  return null;
}

/**
 * Offsets exactly `radius` tiles away in Chebyshev distance, top row first and
 * left to right within a row. Fixed order, so the search is reproducible.
 */
function ringOffsets(radius: number): Array<{ dx: number; dy: number }> {
  if (radius === 0) return [{ dx: 0, dy: 0 }];

  const offsets: Array<{ dx: number; dy: number }> = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === radius) offsets.push({ dx, dy });
    }
  }

  return offsets;
}
