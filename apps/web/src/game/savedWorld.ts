import type { BuildSystem, PlantSystem, TileType, WorldManager } from "@worldnest/game-engine";
import type { ItemId } from "@worldnest/shared";

/**
 * Restoring the shared world a session inherits.
 *
 * Split out of `createGameWorld.ts` to keep that file under the ~300-line cap
 * `CONTRIBUTING.md` sets: these are the shapes `loadSession` produces and the one
 * function that replays them, and neither has anything to do with wiring systems.
 * The types are re-exported from `createGameWorld` so existing importers are
 * unaffected.
 */

/** A structure loaded from the database, ready to be respawned. */
export interface SavedStructure {
  itemId: ItemId;
  tileX: number;
  tileY: number;
}

/** A crop loaded from the database; `itemId` is the seed it was sown from. */
export interface SavedCrop extends SavedStructure {
  plantedAtMinute: number;
}

/**
 * Shared-world state restored on session start: the terrain diff plus every
 * structure and crop other sessions left behind.
 */
export interface SavedWorldState {
  /** `[tileKey, tileType]` pairs for `WorldManager.applyTileOverrides`. */
  tileOverrides: Array<[string, TileType]>;
  structures: SavedStructure[];
  crops: SavedCrop[];
}

/**
 * Rehydrate saved world state. Structures and crops are respawned through the
 * owning systems' public spawn methods, which skip the inventory cost — a
 * restore must not charge the player for what they already built.
 */
export function restoreSavedWorld(
  worldManager: WorldManager,
  plant: PlantSystem,
  build: BuildSystem,
  saved: SavedWorldState,
): void {
  worldManager.applyTileOverrides(saved.tileOverrides);

  for (const structure of saved.structures) {
    build.spawnStructure(structure.itemId, structure.tileX, structure.tileY);
  }

  for (const crop of saved.crops) {
    plant.spawnCrop(crop.itemId, crop.tileX, crop.tileY, crop.plantedAtMinute);
  }
}
