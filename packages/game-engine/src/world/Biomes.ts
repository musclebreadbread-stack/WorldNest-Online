import { TileType } from "./Tilemap";

/**
 * Climate zones the generator classifies every land tile into.
 *
 * A biome is not stored anywhere: it is a pure function of the elevation,
 * moisture and temperature noise channels, so every client derives the same
 * biome for the same tile with no coordination — the same rule the tile data
 * itself follows.
 */
export enum Biome {
  TUNDRA = 0,
  TAIGA = 1,
  GRASSLAND = 2,
  FOREST = 3,
  SAVANNA = 4,
  DESERT = 5,
}

export interface BiomeDefinition {
  name: string;
  /** Tile the biome's dry land is made of. */
  surfaceTile: TileType;
  /** Tile scattered through it by the detail channel. */
  accentTile: TileType;
  /** Colour used when a biome (rather than a tile) is drawn. */
  minimapColor: number;
}

export const BIOME_DEFINITIONS: Record<Biome, BiomeDefinition> = {
  [Biome.TUNDRA]: {
    name: "tundra",
    surfaceTile: TileType.SNOW,
    accentTile: TileType.STONE,
    minimapColor: 0xe0f7fa,
  },
  [Biome.TAIGA]: {
    name: "taiga",
    surfaceTile: TileType.FOREST,
    accentTile: TileType.SNOW,
    minimapColor: 0x1b5e20,
  },
  [Biome.GRASSLAND]: {
    name: "grassland",
    surfaceTile: TileType.GRASS,
    accentTile: TileType.FLOWERS,
    minimapColor: 0x66bb6a,
  },
  [Biome.FOREST]: {
    name: "forest",
    surfaceTile: TileType.FOREST,
    accentTile: TileType.FLOWERS,
    minimapColor: 0x2e7d32,
  },
  [Biome.SAVANNA]: {
    name: "savanna",
    surfaceTile: TileType.GRASS,
    accentTile: TileType.FOREST,
    minimapColor: 0xc0ca33,
  },
  [Biome.DESERT]: {
    name: "desert",
    surfaceTile: TileType.SAND,
    accentTile: TileType.STONE,
    minimapColor: 0xffd54f,
  },
};

/**
 * How much of the temperature channel a full unit of elevation removes, so
 * highlands read as colder than lowlands at the same latitude. Kept small on
 * purpose: at the stone threshold it shifts the climate by a quarter of a band,
 * which varies the mountains without turning every peak into tundra.
 */
const ELEVATION_CHILL = 0.25;

/** Temperature below which land is frozen, and above which it is arid. */
const COLD_TEMPERATURE = -0.35;
const HOT_TEMPERATURE = 0.3;

/** Moisture cut-offs inside each temperature band. */
const TAIGA_MOISTURE = -0.15;
const TROPICAL_MOISTURE = 0.35;
const SAVANNA_MOISTURE = -0.2;
const TEMPERATE_FOREST_MOISTURE = 0.2;

/**
 * Pick the biome for a point from its three noise channels, all in `[-1, 1]`.
 *
 * Total by construction: every branch returns, so any noise triple maps to a
 * biome. Pure and free of the generator, which is what makes the classification
 * testable without generating a chunk.
 */
export function classifyBiome(
  elevation: number,
  moisture: number,
  temperature: number,
): Biome {
  const effective = temperature - Math.max(0, elevation) * ELEVATION_CHILL;

  if (effective < COLD_TEMPERATURE) {
    return moisture > TAIGA_MOISTURE ? Biome.TAIGA : Biome.TUNDRA;
  }

  if (effective > HOT_TEMPERATURE) {
    if (moisture > TROPICAL_MOISTURE) return Biome.FOREST;
    return moisture > SAVANNA_MOISTURE ? Biome.SAVANNA : Biome.DESERT;
  }

  return moisture > TEMPERATE_FOREST_MOISTURE ? Biome.FOREST : Biome.GRASSLAND;
}
