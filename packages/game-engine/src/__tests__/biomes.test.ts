import { describe, it, expect } from "vitest";
import { CHUNK_SIZE, WORLD_SEED } from "@worldnest/shared";
import { Biome, BIOME_DEFINITIONS, classifyBiome } from "../world/Biomes";
import { ChunkGenerator } from "../world/ChunkGenerator";
import { TileType } from "../world/Tilemap";

const BIOMES = Object.values(Biome).filter((v) => typeof v === "number") as Biome[];

/** Corners, faces and centre of the noise cube; every channel is in [-1, 1]. */
const CHANNEL_VALUES = [-1, -0.5, 0, 0.5, 1];

/** Tiles surveyed on each axis for the distribution assertions. */
const SURVEY_TILES = 64;

function surveyTiles(generator: ChunkGenerator, size: number): number[][] {
  const grid: number[][] = [];
  const chunks = size / CHUNK_SIZE;

  for (let chunkY = 0; chunkY < chunks; chunkY++) {
    const row = [];
    for (let chunkX = 0; chunkX < chunks; chunkX++) {
      row.push(generator.generateChunk(chunkX, chunkY));
    }
    for (let localY = 0; localY < CHUNK_SIZE; localY++) {
      const tiles: number[] = [];
      for (let chunkX = 0; chunkX < chunks; chunkX++) {
        tiles.push(...row[chunkX][localY]);
      }
      grid.push(tiles);
    }
  }

  return grid;
}

describe("BIOME_DEFINITIONS", () => {
  it("should describe every biome with known tiles", () => {
    expect(BIOMES).toHaveLength(6);

    for (const biome of BIOMES) {
      const definition = BIOME_DEFINITIONS[biome];
      expect(definition.name.length).toBeGreaterThan(0);
      // Farmland is override-only, so no biome may generate it
      expect(definition.surfaceTile).not.toBe(TileType.FARMLAND);
      expect(definition.accentTile).not.toBe(TileType.FARMLAND);
      expect(definition.minimapColor).toBeGreaterThan(0);
    }
  });

  it("should give each biome its own name and colour", () => {
    const names = BIOMES.map((biome) => BIOME_DEFINITIONS[biome].name);
    const colors = BIOMES.map((biome) => BIOME_DEFINITIONS[biome].minimapColor);

    expect(new Set(names).size).toBe(BIOMES.length);
    expect(new Set(colors).size).toBe(BIOMES.length);
  });
});

describe("classifyBiome", () => {
  it("should be total over the noise cube", () => {
    for (const elevation of CHANNEL_VALUES) {
      for (const moisture of CHANNEL_VALUES) {
        for (const temperature of CHANNEL_VALUES) {
          const biome = classifyBiome(elevation, moisture, temperature);
          expect(BIOMES).toContain(biome);
          expect(BIOME_DEFINITIONS[biome]).toBeDefined();
        }
      }
    }
  });

  it("should be pure: the same channels always give the same biome", () => {
    expect(classifyBiome(0.2, 0.4, 0.1)).toBe(classifyBiome(0.2, 0.4, 0.1));
  });

  it("should freeze cold land and dry out hot land", () => {
    expect(classifyBiome(0, -0.8, -1)).toBe(Biome.TUNDRA);
    expect(classifyBiome(0, 0.8, -1)).toBe(Biome.TAIGA);
    expect(classifyBiome(0, -0.8, 1)).toBe(Biome.DESERT);
    expect(classifyBiome(0, 0, 1)).toBe(Biome.SAVANNA);
    expect(classifyBiome(0, 0.9, 1)).toBe(Biome.FOREST);
  });

  it("should split temperate land into forest and grassland by moisture", () => {
    expect(classifyBiome(0, 0.9, 0)).toBe(Biome.FOREST);
    expect(classifyBiome(0, -0.9, 0)).toBe(Biome.GRASSLAND);
  });

  it("should make highlands colder than lowlands at the same temperature", () => {
    // Just inside the temperate band at sea level, tipped over by elevation
    const lowland = classifyBiome(0, -0.9, -0.3);
    const highland = classifyBiome(1, -0.9, -0.3);

    expect(lowland).toBe(Biome.GRASSLAND);
    expect(highland).toBe(Biome.TUNDRA);
  });
});

describe("ChunkGenerator biomes", () => {
  it("should be deterministic for a seed, in tiles and in biomes", () => {
    const first = new ChunkGenerator(WORLD_SEED);
    const second = new ChunkGenerator(WORLD_SEED);

    expect(first.generateChunk(3, -2)).toEqual(second.generateChunk(3, -2));

    for (let tileY = -8; tileY < 8; tileY++) {
      for (let tileX = -8; tileX < 8; tileX++) {
        expect(first.getBiomeAt(tileX, tileY)).toBe(second.getBiomeAt(tileX, tileY));
      }
    }
  });

  it("should classify every tile it generates into a known biome", () => {
    const generator = new ChunkGenerator(WORLD_SEED);

    for (let tileY = 0; tileY < CHUNK_SIZE; tileY++) {
      for (let tileX = 0; tileX < CHUNK_SIZE; tileX++) {
        expect(BIOMES).toContain(generator.getBiomeAt(tileX, tileY));
      }
    }
  });

  it("should spread at least four biomes over a 64x64 tile survey", () => {
    const generator = new ChunkGenerator(WORLD_SEED);
    const found = new Set<Biome>();

    for (let tileY = 0; tileY < SURVEY_TILES; tileY++) {
      for (let tileX = 0; tileX < SURVEY_TILES; tileX++) {
        found.add(generator.getBiomeAt(tileX, tileY));
      }
    }

    expect(found.size).toBeGreaterThanOrEqual(4);
  });

  it("should keep water, sand and the biome surface tiles in the terrain", () => {
    const generator = new ChunkGenerator(WORLD_SEED);
    const grid = surveyTiles(generator, SURVEY_TILES);
    const present = new Set<number>(grid.flat());

    // Water and its shoreline still come from elevation, before any biome rule
    expect(present.has(TileType.WATER)).toBe(true);
    expect(present.has(TileType.SAND)).toBe(true);
    expect(present.has(TileType.GRASS)).toBe(true);
    expect(present.has(TileType.FOREST)).toBe(true);
    expect(present.has(TileType.STONE)).toBe(true);
    // Snow only exists because the temperature channel does
    expect(present.has(TileType.SNOW)).toBe(true);
  });
});
