import { describe, it, expect } from "vitest";
import { CHUNK_SIZE, TILE_SIZE, WORLD_SEED } from "@worldnest/shared";
import { ChunkGenerator } from "../world/ChunkGenerator";
import { WorldManager } from "../world/WorldManager";
import { TileType, TILE_PROPERTIES } from "../world/Tilemap";
import { getTileKey, parseTileKey } from "../world/TileQuery";

/** Find a tile of the given type near the origin, for walkability assertions. */
function findTile(manager: WorldManager, type: TileType): { x: number; y: number } {
  for (let y = -CHUNK_SIZE; y < CHUNK_SIZE * 2; y++) {
    for (let x = -CHUNK_SIZE; x < CHUNK_SIZE * 2; x++) {
      if (manager.getTileAt(x, y) === type) return { x, y };
    }
  }
  throw new Error(`no ${TILE_PROPERTIES[type].name} tile found near the origin`);
}

describe("getTileKey / parseTileKey", () => {
  it("should round-trip tile coordinates including negatives", () => {
    expect(getTileKey(3, -7)).toBe("3,-7");
    expect(parseTileKey("3,-7")).toEqual({ tileX: 3, tileY: -7 });
  });
});

describe("WorldManager tile query", () => {
  it("should agree with the generator for unmodified tiles", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const generator = new ChunkGenerator(WORLD_SEED);
    const generated = generator.generateChunk(0, 0);

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        expect(manager.getTileAt(x, y)).toBe(generated[y][x]);
      }
    }
  });

  it("should generate out-of-range chunks on demand", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const generator = new ChunkGenerator(WORLD_SEED);

    // Nothing has been loaded yet, so this tile is only reachable by generating
    const far = generator.generateChunk(12, -9);
    expect(manager.getLoadedChunks().size).toBe(0);
    expect(manager.getTileAt(12 * CHUNK_SIZE + 4, -9 * CHUNK_SIZE + 7)).toBe(
      far[7][4],
    );
  });

  it("should resolve negative tile coordinates to the right chunk", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const generator = new ChunkGenerator(WORLD_SEED);
    const chunk = generator.generateChunk(-1, -1);

    expect(manager.getTileAt(-1, -1)).toBe(chunk[CHUNK_SIZE - 1][CHUNK_SIZE - 1]);
    expect(manager.getTileAt(-CHUNK_SIZE, -CHUNK_SIZE)).toBe(chunk[0][0]);
  });

  it("should let overrides win over generated tiles", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const generated = manager.getTileAt(2, 3);
    const override = generated === TileType.WATER ? TileType.STONE : TileType.WATER;

    manager.setTileOverride(2, 3, override);

    expect(manager.getTileAt(2, 3)).toBe(override);
    expect(manager.getTileAt(2, 3)).not.toBe(generated);
    expect(manager.getTileOverrides().get(getTileKey(2, 3))).toBe(override);
  });

  it("should notify the tile change listener on override", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const changes: Array<[number, number, TileType]> = [];
    manager.setTileChangeCallback((tileX, tileY, tileType) =>
      changes.push([tileX, tileY, tileType]),
    );

    manager.setTileOverride(-4, 5, TileType.GRASS);

    expect(changes).toEqual([[-4, 5, TileType.GRASS]]);
  });

  it("should bulk-apply overrides without notifying the listener", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    let notified = 0;
    manager.setTileChangeCallback(() => notified++);

    manager.applyTileOverrides([
      [getTileKey(0, 0), TileType.STONE],
      [getTileKey(1, 0), TileType.WATER],
    ]);

    expect(manager.getTileAt(0, 0)).toBe(TileType.STONE);
    expect(manager.getTileAt(1, 0)).toBe(TileType.WATER);
    expect(notified).toBe(0);
  });

  it("should report water as not walkable and grass as walkable", () => {
    const manager = new WorldManager(WORLD_SEED, 1);

    const water = findTile(manager, TileType.WATER);
    const grass = findTile(manager, TileType.GRASS);

    expect(
      manager.isWalkableAt(water.x * TILE_SIZE + 1, water.y * TILE_SIZE + 1),
    ).toBe(false);
    expect(
      manager.isWalkableAt(grass.x * TILE_SIZE + 1, grass.y * TILE_SIZE + 1),
    ).toBe(true);
  });

  it("should reflect overrides in walkability", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const grass = findTile(manager, TileType.GRASS);

    manager.setTileOverride(grass.x, grass.y, TileType.WATER);

    expect(
      manager.isWalkableAt(grass.x * TILE_SIZE + 5, grass.y * TILE_SIZE + 5),
    ).toBe(false);
  });

  it("should handle negative pixel coordinates in isWalkableAt", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    manager.setTileOverride(-1, -1, TileType.WATER);
    manager.setTileOverride(-2, -1, TileType.GRASS);

    expect(manager.isWalkableAt(-1, -1)).toBe(false);
    expect(manager.isWalkableAt(-TILE_SIZE - 1, -1)).toBe(true);
  });
});
