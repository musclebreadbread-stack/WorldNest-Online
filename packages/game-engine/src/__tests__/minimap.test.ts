import { describe, it, expect } from "vitest";
import { WORLD_SEED } from "@worldnest/shared";
import { WorldManager } from "../world/WorldManager";
import { TileType } from "../world/Tilemap";
import { minimapTileAt, sampleMinimap } from "../world/minimap";
import type { TileQuery } from "../world/TileQuery";

/** A TileQuery whose tile id encodes its coordinates, so indexing is checkable. */
function coordinateQuery(): TileQuery {
  return {
    getTileAt: (tileX, tileY) =>
      ((((tileX * 7 + tileY * 13) % 11) + 11) % 11) as TileType,
    isWalkableAt: () => true,
  };
}

describe("sampleMinimap", () => {
  it("should produce a square window sized from the radius", () => {
    const sample = sampleMinimap(coordinateQuery(), 0, 0, 4);

    expect(sample.size).toBe(9);
    expect(sample.tiles.length).toBe(9 ** 2);
    expect(sample.originTileX).toBe(-4);
    expect(sample.originTileY).toBe(-4);
  });

  it("should hold the centre tile at the centre index", () => {
    const query = coordinateQuery();
    const radius = 6;
    const sample = sampleMinimap(query, 20, 31, radius);

    expect(minimapTileAt(sample, radius, radius)).toBe(query.getTileAt(20, 31));
  });

  it("should walk the window row-major so index y * size + x is stable", () => {
    const query = coordinateQuery();
    const sample = sampleMinimap(query, 5, 9, 3);

    for (let y = 0; y < sample.size; y++) {
      for (let x = 0; x < sample.size; x++) {
        expect(sample.tiles[y * sample.size + x]).toBe(
          query.getTileAt(sample.originTileX + x, sample.originTileY + y),
        );
      }
    }
  });

  it("should degenerate to a single tile at radius 0", () => {
    const sample = sampleMinimap(coordinateQuery(), 2, 2, 0);

    expect(sample.size).toBe(1);
    expect(sample.tiles.length).toBe(1);
    expect(minimapTileAt(sample, 0, 0)).toBe(coordinateQuery().getTileAt(2, 2));
  });

  it("should resolve negative centre coordinates", () => {
    const query = coordinateQuery();
    const sample = sampleMinimap(query, -20, -7, 2);

    expect(sample.originTileX).toBe(-22);
    expect(sample.originTileY).toBe(-9);
    expect(minimapTileAt(sample, 0, 0)).toBe(query.getTileAt(-22, -9));
    expect(minimapTileAt(sample, 2, 2)).toBe(query.getTileAt(-20, -7));
  });

  it("should return undefined outside the window", () => {
    const sample = sampleMinimap(coordinateQuery(), 0, 0, 1);

    expect(minimapTileAt(sample, -1, 0)).toBeUndefined();
    expect(minimapTileAt(sample, 0, 3)).toBeUndefined();
  });

  it("should show applied tile overrides through the sample", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const generated = manager.getTileAt(4, 4);
    const override =
      generated === TileType.CAVE_WALL ? TileType.WATER : TileType.CAVE_WALL;

    manager.setTileOverride(4, 4, override);
    const sample = sampleMinimap(manager, 4, 4, 3);

    expect(minimapTileAt(sample, 3, 3)).toBe(override);
    expect(minimapTileAt(sample, 3, 3)).not.toBe(generated);
  });

  it("should sample tiles outside the loaded chunks without loading them", () => {
    const manager = new WorldManager(WORLD_SEED, 1);
    const sample = sampleMinimap(manager, 500, -300, 5);

    expect(manager.getLoadedChunks().size).toBe(0);
    expect(sample.tiles.every((tile) => tile in TileType)).toBe(true);
  });

  it("should be deterministic for the same seed and window", () => {
    const first = sampleMinimap(new WorldManager(WORLD_SEED, 1), 15, 10, 12);
    const second = sampleMinimap(new WorldManager(WORLD_SEED, 1), 15, 10, 12);

    expect(Array.from(second.tiles)).toEqual(Array.from(first.tiles));
  });
});
