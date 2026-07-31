import { describe, it, expect } from "vitest";
import { CHUNK_SIZE, TILE_SIZE, WORLD_SEED } from "@worldnest/shared";
import { ChunkGenerator } from "../world/ChunkGenerator";
import { WorldManager } from "../world/WorldManager";
import { TileType, TILE_PROPERTIES } from "../world/Tilemap";
import { getTileKey, parseTileKey } from "../world/TileQuery";
import { getLayerTileKey, parseLayerTileKey, WorldLayer } from "../world/WorldLayer";

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

  it("should keep surface keys byte-compatible and prefix underground keys", () => {
    expect(getLayerTileKey(WorldLayer.SURFACE, 3, -7)).toBe(getTileKey(3, -7));
    expect(getLayerTileKey(WorldLayer.UNDERGROUND, 3, -7)).toBe("1:3,-7");
    expect(parseLayerTileKey("3,-7")).toEqual({
      layer: WorldLayer.SURFACE,
      tileX: 3,
      tileY: -7,
    });
    expect(parseLayerTileKey("1:3,-7")).toEqual({
      layer: WorldLayer.UNDERGROUND,
      tileX: 3,
      tileY: -7,
    });
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
    expect(manager.getTileAt(12 * CHUNK_SIZE + 4, -9 * CHUNK_SIZE + 7)).toBe(far[7][4]);
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

  it("should keep overrides isolated between layers", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const surface = manager.getTileAt(2, 3);
    const surfaceOverride =
      surface === TileType.WATER ? TileType.STONE : TileType.WATER;

    manager.setTileOverride(2, 3, surfaceOverride);
    manager.setLayer(WorldLayer.UNDERGROUND);
    const underground = manager.getTileAt(2, 3);
    expect(underground).not.toBe(surfaceOverride);

    manager.setTileOverride(2, 3, TileType.CAVE_FLOOR);
    manager.setLayer(WorldLayer.SURFACE);
    expect(manager.getTileAt(2, 3)).toBe(surfaceOverride);
    expect(
      manager.getTileOverrides().get(getLayerTileKey(WorldLayer.UNDERGROUND, 2, 3)),
    ).toBe(TileType.CAVE_FLOOR);
  });

  it("should unload every chunk and reload after switching layers", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const unloaded: string[] = [];
    manager.setCallbacks(
      () => undefined,
      (chunkX, chunkY) => unloaded.push(`${chunkX},${chunkY}`),
    );
    manager.updateLoadedChunks(0, 0);
    expect(manager.getLoadedChunks().size).toBe(9);

    manager.setLayer(WorldLayer.UNDERGROUND);
    expect(unloaded).toHaveLength(9);
    expect(manager.getLoadedChunks().size).toBe(0);

    manager.updateLoadedChunks(0, 0);
    expect(manager.getLoadedChunks().size).toBe(9);
    expect(manager.getLayer()).toBe(WorldLayer.UNDERGROUND);
  });

  it("should notify the tile change listener on override", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const changes: Array<[number, number, TileType]> = [];
    manager.setTileChangeCallback((_layer, tileX, tileY, tileType) =>
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

  it("should report the generator's biome, ignoring overrides", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const generator = new ChunkGenerator(WORLD_SEED);

    for (const [tileX, tileY] of [
      [0, 0],
      [7, 21],
      [-13, 4],
    ]) {
      expect(manager.getBiomeAt(tileX, tileY)).toBe(generator.getBiomeAt(tileX, tileY));
    }

    // Editing the tile does not move the climate the tile sits in
    const before = manager.getBiomeAt(3, 9);
    manager.setTileOverride(3, 9, TileType.FARMLAND);
    expect(manager.getBiomeAt(3, 9)).toBe(before);
  });

  it("should report water as not walkable and grass as walkable", () => {
    const manager = new WorldManager(WORLD_SEED, 1);

    const water = findTile(manager, TileType.WATER);
    const grass = findTile(manager, TileType.GRASS);

    expect(manager.isWalkableAt(water.x * TILE_SIZE + 1, water.y * TILE_SIZE + 1)).toBe(
      false,
    );
    expect(manager.isWalkableAt(grass.x * TILE_SIZE + 1, grass.y * TILE_SIZE + 1)).toBe(
      true,
    );
  });

  it("should reflect overrides in walkability", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const grass = findTile(manager, TileType.GRASS);

    manager.setTileOverride(grass.x, grass.y, TileType.WATER);

    expect(manager.isWalkableAt(grass.x * TILE_SIZE + 5, grass.y * TILE_SIZE + 5)).toBe(
      false,
    );
  });

  it("should handle negative pixel coordinates in isWalkableAt", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    manager.setTileOverride(-1, -1, TileType.WATER);
    manager.setTileOverride(-2, -1, TileType.GRASS);

    expect(manager.isWalkableAt(-1, -1)).toBe(false);
    expect(manager.isWalkableAt(-TILE_SIZE - 1, -1)).toBe(true);
  });
});
