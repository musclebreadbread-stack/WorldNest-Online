import { createNoise2D, type NoiseFunction2D } from "simplex-noise";
import { CHUNK_SIZE } from "@worldnest/shared";
import { TileType } from "./Tilemap";

/**
 * Seeded pseudo-random number generator (mulberry32).
 * Produces deterministic sequences from a given seed.
 */
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * ChunkGenerator produces deterministic tile data for a given chunk coordinate.
 * Uses simplex noise layered at multiple frequencies for varied terrain.
 */
export class ChunkGenerator {
  private noise2D: NoiseFunction2D;
  private moistureNoise: NoiseFunction2D;
  private detailNoise: NoiseFunction2D;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    const rng = mulberry32(seed);
    this.noise2D = createNoise2D(rng);
    const rng2 = mulberry32(seed + 1000);
    this.moistureNoise = createNoise2D(rng2);
    const rng3 = mulberry32(seed + 2000);
    this.detailNoise = createNoise2D(rng3);
  }

  /**
   * Generate a CHUNK_SIZE x CHUNK_SIZE grid of tile types for the given chunk coordinates.
   * The generation is fully deterministic based on the seed and chunk position.
   */
  generateChunk(chunkX: number, chunkY: number): number[][] {
    const tiles: number[][] = [];

    for (let y = 0; y < CHUNK_SIZE; y++) {
      const row: number[] = [];
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldY = chunkY * CHUNK_SIZE + y;
        row.push(this.getTileType(worldX, worldY));
      }
      tiles.push(row);
    }

    return tiles;
  }

  private getTileType(worldX: number, worldY: number): TileType {
    // Scale coordinates for noise sampling
    const scale = 0.02;
    const moistureScale = 0.015;
    const detailScale = 0.1;

    // Sample elevation noise (primary terrain shape)
    const elevation = this.noise2D(worldX * scale, worldY * scale);

    // Sample moisture noise (determines biome variation)
    const moisture = this.moistureNoise(
      worldX * moistureScale,
      worldY * moistureScale,
    );

    // Sample detail noise (small-scale variation)
    const detail = this.detailNoise(
      worldX * detailScale,
      worldY * detailScale,
    );

    // Determine tile type based on noise values
    // Water at low elevation
    if (elevation < -0.3) {
      return TileType.WATER;
    }

    // Sand near water boundaries
    if (elevation < -0.1) {
      return TileType.SAND;
    }

    // Stone at high elevation
    if (elevation > 0.6) {
      return TileType.STONE;
    }

    // Forest in moist areas with moderate elevation
    if (moisture > 0.2 && elevation > 0.1) {
      return TileType.FOREST;
    }

    // Flowers in certain detail noise patterns
    if (detail > 0.5 && moisture > -0.1) {
      return TileType.FLOWERS;
    }

    // Default to grass
    return TileType.GRASS;
  }
}
