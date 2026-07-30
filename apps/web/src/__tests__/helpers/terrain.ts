import { FACING_OFFSETS, TILE_PROPERTIES } from "@worldnest/game-engine";
import type { Facing, TileType, WorldManager } from "@worldnest/game-engine";
import { TILE_SIZE } from "@worldnest/shared";

/**
 * Deterministic terrain lookups for the web test suites.
 *
 * Terrain is generated from `WORLD_SEED`, so a test could hard-code the tile
 * coordinates it needs — but then every generator change (biomes, caves) breaks
 * the tests instead of the terrain. These helpers search for the tile shape a
 * test needs, so the assertions stay about behaviour rather than coordinates.
 *
 * This file lives under `__tests__/helpers/` deliberately: Vitest's `include`
 * only matches files ending in `.test.ts`/`.test.tsx`, so this is a module
 * imported by the suites, never collected as one itself.
 */

/** Tile window searched, in tiles, on both axes. Four chunks square. */
const SEARCH_SIZE = 64;

export interface FacingPair {
  /** Tile the player stands on. */
  standTileX: number;
  standTileY: number;
  /** Tile the player faces from there. */
  targetTileX: number;
  targetTileY: number;
  /** Centre of the stand tile, ready to be used as a spawn point. */
  spawnX: number;
  spawnY: number;
}

function pairAt(
  standTileX: number,
  standTileY: number,
  facing: Facing,
): FacingPair {
  const offset = FACING_OFFSETS[facing];
  return {
    standTileX,
    standTileY,
    targetTileX: standTileX + offset.dx,
    targetTileY: standTileY + offset.dy,
    spawnX: standTileX * TILE_SIZE + TILE_SIZE / 2,
    spawnY: standTileY * TILE_SIZE + TILE_SIZE / 2,
  };
}

/**
 * First tile of type `standType` whose neighbour in `facing` is `targetType`,
 * scanning row-major over `0..SEARCH_SIZE - 1` on both axes so the result is
 * stable for a given seed.
 */
export function findFacingPair(
  worldManager: WorldManager,
  standType: TileType,
  targetType: TileType,
  facing: Facing,
): FacingPair {
  const offset = FACING_OFFSETS[facing];

  for (let tileY = 0; tileY < SEARCH_SIZE; tileY++) {
    for (let tileX = 0; tileX < SEARCH_SIZE; tileX++) {
      if (worldManager.getTileAt(tileX, tileY) !== standType) continue;
      if (
        worldManager.getTileAt(tileX + offset.dx, tileY + offset.dy) !== targetType
      ) {
        continue;
      }
      return pairAt(tileX, tileY, facing);
    }
  }

  throw new Error(
    `no ${TILE_PROPERTIES[standType].name} tile facing ${facing} onto ` +
      `${TILE_PROPERTIES[targetType].name} within ${SEARCH_SIZE} tiles of the origin`,
  );
}

/**
 * First walkable tile whose neighbour in `facing` is `blockedType`, for the
 * "walk into a wall" cases. The stand tile's own type is left open on purpose:
 * whether the shore is grass or sand is the generator's business.
 */
export function findWalkableNeighbourOf(
  worldManager: WorldManager,
  blockedType: TileType,
  facing: Facing = "left",
): FacingPair {
  const offset = FACING_OFFSETS[facing];

  for (let tileY = 0; tileY < SEARCH_SIZE; tileY++) {
    for (let tileX = 0; tileX < SEARCH_SIZE; tileX++) {
      const standType = worldManager.getTileAt(tileX, tileY);
      if (!TILE_PROPERTIES[standType].walkable) continue;
      if (
        worldManager.getTileAt(tileX + offset.dx, tileY + offset.dy) !== blockedType
      ) {
        continue;
      }
      return pairAt(tileX, tileY, facing);
    }
  }

  throw new Error(
    `no walkable tile facing ${facing} onto ${TILE_PROPERTIES[blockedType].name} ` +
      `within ${SEARCH_SIZE} tiles of the origin`,
  );
}
