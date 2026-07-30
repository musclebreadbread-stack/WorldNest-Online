import { INTERACT_RANGE_TILES, TILE_SIZE } from "@worldnest/shared";

/** Direction an entity is facing, derived from its last non-zero input. */
export type Facing = "up" | "down" | "left" | "right";

/** Tile-space offset of each facing direction. */
export const FACING_OFFSETS: Record<Facing, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/**
 * Tile an entity at the given world pixel position is facing.
 * Shared by harvesting, planting and building so they all agree on the target.
 */
export function getFacedTile(
  pixelX: number,
  pixelY: number,
  facing: Facing,
  range: number = INTERACT_RANGE_TILES,
): { tileX: number; tileY: number } {
  const offset = FACING_OFFSETS[facing];
  return {
    tileX: Math.floor(pixelX / TILE_SIZE) + offset.dx * range,
    tileY: Math.floor(pixelY / TILE_SIZE) + offset.dy * range,
  };
}
