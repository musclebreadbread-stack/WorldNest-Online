import { createNoise2D, type NoiseFunction2D } from "simplex-noise";
import { CHUNK_SIZE } from "@worldnest/shared";
import { BIOME_DEFINITIONS, classifyBiome, type Biome } from "./Biomes";
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

/** Noise sampling scales. Temperature is the broadest so climate bands are wide. */
const ELEVATION_SCALE = 0.02;
const MOISTURE_SCALE = 0.015;
const DETAIL_SCALE = 0.1;
const TEMPERATURE_SCALE = 0.008;

/** Elevation thresholds, unchanged from the pre-biome generator. */
const WATER_ELEVATION = -0.3;
const SAND_ELEVATION = -0.1;
const STONE_ELEVATION = 0.6;

/** Detail value above which a biome's accent tile replaces its surface tile. */
const ACCENT_DETAIL = 0.5;

/**
 * Caves are a fifth channel carved into the rock above `STONE_ELEVATION`, which
 * is well above the water line, so a cave can never flood. Tile ids stay on the
 * single tile layer: there is no second world dimension to thread through the
 * override map, persistence and the renderer.
 */
const CAVE_SCALE = 0.06;
const CAVE_THRESHOLD = 0.2;

/** Detail value above which an ore vein replaces the cave floor. */
const ORE_DETAIL = 0.6;

/** Tile-space neighbours used to find the edge of a cave region. */
const NEIGHBOUR_OFFSETS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

/** The four noise channels sampled for one point of the world. */
interface ClimateSample {
  elevation: number;
  moisture: number;
  detail: number;
  temperature: number;
}

/**
 * ChunkGenerator produces deterministic tile data for a given chunk coordinate.
 * Uses simplex noise layered at multiple frequencies for varied terrain.
 *
 * Elevation decides water, shore and rock; a temperature channel joins moisture
 * to classify the biome (see `Biomes.ts`), which then decides what the dry land
 * is made of. Every channel is seeded from the world seed, so the whole world
 * stays reproducible from that one number.
 */
export class ChunkGenerator {
  private noise2D: NoiseFunction2D;
  private moistureNoise: NoiseFunction2D;
  private detailNoise: NoiseFunction2D;
  private temperatureNoise: NoiseFunction2D;
  private caveNoise: NoiseFunction2D;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    const rng = mulberry32(seed);
    this.noise2D = createNoise2D(rng);
    const rng2 = mulberry32(seed + 1000);
    this.moistureNoise = createNoise2D(rng2);
    const rng3 = mulberry32(seed + 2000);
    this.detailNoise = createNoise2D(rng3);
    const rng4 = mulberry32(seed + 3000);
    this.temperatureNoise = createNoise2D(rng4);
    const rng5 = mulberry32(seed + 4000);
    this.caveNoise = createNoise2D(rng5);
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

  /**
   * Biome at the given tile. Derived, never stored: callers that want the biome
   * of an edited tile still get the biome of the land it sits in.
   */
  getBiomeAt(worldX: number, worldY: number): Biome {
    const climate = this.sampleClimate(worldX, worldY);
    return classifyBiome(climate.elevation, climate.moisture, climate.temperature);
  }

  /** All noise channels for one point, sampled once so callers stay consistent. */
  private sampleClimate(worldX: number, worldY: number): ClimateSample {
    return {
      // Primary terrain shape
      elevation: this.noise2D(worldX * ELEVATION_SCALE, worldY * ELEVATION_SCALE),
      // How wet the land is, one half of the biome classification
      moisture: this.moistureNoise(worldX * MOISTURE_SCALE, worldY * MOISTURE_SCALE),
      // Small-scale variation that scatters a biome's accent tile
      detail: this.detailNoise(worldX * DETAIL_SCALE, worldY * DETAIL_SCALE),
      // Broad climate bands, the other half of the classification
      temperature: this.temperatureNoise(
        worldX * TEMPERATURE_SCALE,
        worldY * TEMPERATURE_SCALE,
      ),
    };
  }

  /** Elevation channel on its own, for the neighbour lookups caves need. */
  private elevationAt(worldX: number, worldY: number): number {
    return this.noise2D(worldX * ELEVATION_SCALE, worldY * ELEVATION_SCALE);
  }

  /**
   * Whether the point is inside a cave: high rock hollowed out by the cave
   * channel. Only ever true well above the water line, so caves never flood.
   */
  private isCaveRegion(worldX: number, worldY: number): boolean {
    if (this.elevationAt(worldX, worldY) <= STONE_ELEVATION) return false;
    return this.caveNoise(worldX * CAVE_SCALE, worldY * CAVE_SCALE) > CAVE_THRESHOLD;
  }

  /**
   * The cave tile for a point, or `null` when it is not in a cave.
   *
   * A cave tile bordering solid rock becomes a wall, so the tunnels read as
   * carved rather than as a hole in the mountainside; where the mountain slopes
   * below the rock line the cave simply opens onto the surface, which is how the
   * player gets in. Ore veins sit in the interior, on the high detail values.
   */
  private getCaveTile(
    worldX: number,
    worldY: number,
    detail: number,
  ): TileType | null {
    if (!this.isCaveRegion(worldX, worldY)) return null;

    let cavernNeighbours = 0;
    for (const { dx, dy } of NEIGHBOUR_OFFSETS) {
      const neighbourX = worldX + dx;
      const neighbourY = worldY + dy;
      if (this.isCaveRegion(neighbourX, neighbourY)) {
        cavernNeighbours++;
        continue;
      }
      // Rock that was not hollowed out: the cave is walled off against it
      if (this.elevationAt(neighbourX, neighbourY) > STONE_ELEVATION) {
        return TileType.CAVE_WALL;
      }
    }

    // Ore always has a cave tile beside it, so a vein is never a lone speck
    if (detail > ORE_DETAIL && cavernNeighbours > 0) {
      return TileType.ORE;
    }

    return TileType.CAVE_FLOOR;
  }

  private getTileType(worldX: number, worldY: number): TileType {
    const climate = this.sampleClimate(worldX, worldY);
    const { elevation, moisture, detail, temperature } = climate;

    // Water at low elevation
    if (elevation < WATER_ELEVATION) {
      return TileType.WATER;
    }

    // Sand near water boundaries
    if (elevation < SAND_ELEVATION) {
      return TileType.SAND;
    }

    // Caves are carved out of the rock, so they are checked before it
    const caveTile = this.getCaveTile(worldX, worldY, detail);
    if (caveTile !== null) {
      return caveTile;
    }

    // Stone at high elevation
    if (elevation > STONE_ELEVATION) {
      return TileType.STONE;
    }

    // Everything else is dry land, so the biome decides what it is made of
    const biome = classifyBiome(elevation, moisture, temperature);
    const definition = BIOME_DEFINITIONS[biome];
    return detail > ACCENT_DETAIL ? definition.accentTile : definition.surfaceTile;
  }
}
