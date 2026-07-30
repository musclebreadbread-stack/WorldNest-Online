/**
 * Read-only occupancy view of placed structures, maintained by `BuildSystem`.
 *
 * `CollisionSystem` depends on this interface rather than on `BuildSystem`, which
 * keeps it testable with a hand-written fake, exactly like `TileQuery`.
 */
export interface StructureQuery {
  /** Whether a structure occupies the tile, collidable or not. */
  hasStructureAt(tileX: number, tileY: number): boolean;
  /** Whether a structure on the tile blocks movement. */
  isBlockedByStructure(tileX: number, tileY: number): boolean;
}
