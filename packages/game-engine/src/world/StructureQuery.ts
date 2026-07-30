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

/**
 * Treat several occupancy sources as one.
 *
 * `CollisionSystem` takes a single `StructureQuery`, and by design it does not
 * know what is filling it: `composeBlockers(build, npc)` is what makes a
 * villager as solid as a fence without either system learning about the other.
 * A tile is blocked when any source says so.
 */
export function composeBlockers(...queries: StructureQuery[]): StructureQuery {
  return {
    hasStructureAt: (tileX, tileY) =>
      queries.some((query) => query.hasStructureAt(tileX, tileY)),
    isBlockedByStructure: (tileX, tileY) =>
      queries.some((query) => query.isBlockedByStructure(tileX, tileY)),
  };
}
