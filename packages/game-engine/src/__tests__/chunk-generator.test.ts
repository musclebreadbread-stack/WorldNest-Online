import { describe, it, expect } from "vitest";
import { ChunkGenerator } from "../world/ChunkGenerator";
import { TileType } from "../world/Tilemap";
import { CHUNK_SIZE } from "@worldnest/shared";

describe("ChunkGenerator", () => {
  it("should generate a chunk with correct dimensions", () => {
    const generator = new ChunkGenerator(42);
    const tiles = generator.generateChunk(0, 0);

    expect(tiles).toHaveLength(CHUNK_SIZE);
    for (const row of tiles) {
      expect(row).toHaveLength(CHUNK_SIZE);
    }
  });

  it("should produce deterministic results with the same seed", () => {
    const gen1 = new ChunkGenerator(42);
    const gen2 = new ChunkGenerator(42);

    const tiles1 = gen1.generateChunk(5, 3);
    const tiles2 = gen2.generateChunk(5, 3);

    expect(tiles1).toEqual(tiles2);
  });

  it("should produce different results with different seeds", () => {
    const gen1 = new ChunkGenerator(42);
    const gen2 = new ChunkGenerator(999);

    const tiles1 = gen1.generateChunk(0, 0);
    const tiles2 = gen2.generateChunk(0, 0);

    // There should be at least some difference
    let differences = 0;
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        if (tiles1[y][x] !== tiles2[y][x]) {
          differences++;
        }
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  it("should produce different results for different chunk positions", () => {
    const generator = new ChunkGenerator(42);

    const tiles1 = generator.generateChunk(0, 0);
    const tiles2 = generator.generateChunk(10, 10);

    // The two chunks should differ
    let differences = 0;
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        if (tiles1[y][x] !== tiles2[y][x]) {
          differences++;
        }
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  it("should only generate known tile types, and never farmland", () => {
    const generator = new ChunkGenerator(42);
    const knownTiles = new Set<TileType>(
      Object.values(TileType).filter((v) => typeof v === "number") as TileType[],
    );

    // Generate several chunks to check a wide range
    for (let cx = -2; cx <= 2; cx++) {
      for (let cy = -2; cy <= 2; cy++) {
        const tiles = generator.generateChunk(cx, cy);
        for (const row of tiles) {
          for (const tile of row) {
            expect(knownTiles.has(tile as TileType)).toBe(true);
            // Farmland only ever comes from the modification overlay
            expect(tile).not.toBe(TileType.FARMLAND);
          }
        }
      }
    }
  });
});
