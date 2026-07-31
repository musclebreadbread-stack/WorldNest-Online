import { describe, it, expect } from "vitest";
import { CHUNK_SIZE, WORLD_SEED } from "@worldnest/shared";
import { ChunkGenerator } from "../world/ChunkGenerator";
import { TILE_PROPERTIES, TileType } from "../world/Tilemap";
import { WorldLayer } from "../world/WorldLayer";

/** Tiles surveyed on each axis. Six chunks square, enough to hit a mountain. */
const SURVEY_TILES = 96;

const CAVE_TILES: TileType[] = [TileType.CAVE_FLOOR, TileType.CAVE_WALL, TileType.ORE];

/** Row-major tile survey of the region `(0, 0)` to `(size - 1, size - 1)`. */
function surveyTiles(
  generator: ChunkGenerator,
  size: number,
  layer: WorldLayer = WorldLayer.SURFACE,
): TileType[][] {
  const grid: TileType[][] = [];
  const chunks = size / CHUNK_SIZE;

  for (let chunkY = 0; chunkY < chunks; chunkY++) {
    const chunkRow = [];
    for (let chunkX = 0; chunkX < chunks; chunkX++) {
      chunkRow.push(generator.generateChunk(chunkX, chunkY, layer));
    }
    for (let localY = 0; localY < CHUNK_SIZE; localY++) {
      const tiles: TileType[] = [];
      for (let chunkX = 0; chunkX < chunks; chunkX++) {
        tiles.push(...(chunkRow[chunkX][localY] as TileType[]));
      }
      grid.push(tiles);
    }
  }

  return grid;
}

function countTiles(grid: TileType[][]): Map<TileType, number> {
  const counts = new Map<TileType, number>();
  for (const row of grid) {
    for (const tile of row) {
      counts.set(tile, (counts.get(tile) ?? 0) + 1);
    }
  }
  return counts;
}

const generator = new ChunkGenerator(WORLD_SEED);
const grid = surveyTiles(generator, SURVEY_TILES);
const counts = countTiles(grid);

describe("cave generation", () => {
  it("should carve floors, walls and ore veins into the world", () => {
    for (const tile of CAVE_TILES) {
      expect(counts.get(tile) ?? 0).toBeGreaterThan(0);
    }
  });

  it("should keep surface terrain the majority of the world", () => {
    const caves = CAVE_TILES.reduce(
      (total, tile) => total + (counts.get(tile) ?? 0),
      0,
    );

    // Caves are a feature of the mountains, not the shape of the world
    expect(caves).toBeLessThan(SURVEY_TILES * SURVEY_TILES * 0.2);
  });

  it("should never place a cave next to water", () => {
    // Caves need rock, which only exists far above the water line, so no cave
    // can ever flood — the reason a second world layer was not needed.
    let caveTiles = 0;

    for (let tileY = 0; tileY < SURVEY_TILES; tileY++) {
      for (let tileX = 0; tileX < SURVEY_TILES; tileX++) {
        if (!CAVE_TILES.includes(grid[tileY][tileX])) continue;
        caveTiles++;

        for (const tile of neighboursOf(tileX, tileY)) {
          expect(tile).not.toBe(TileType.WATER);
        }
      }
    }

    expect(caveTiles).toBeGreaterThan(0);
  });

  it("should surround every ore vein with cave tiles", () => {
    for (let tileY = 0; tileY < SURVEY_TILES; tileY++) {
      for (let tileX = 0; tileX < SURVEY_TILES; tileX++) {
        if (grid[tileY][tileX] !== TileType.ORE) continue;

        const neighbours = neighboursOf(tileX, tileY);
        expect(neighbours.some((tile) => CAVE_TILES.includes(tile))).toBe(true);
      }
    }
  });

  it("should make cave floors and ore walkable but cave walls solid", () => {
    expect(TILE_PROPERTIES[TileType.CAVE_FLOOR].walkable).toBe(true);
    expect(TILE_PROPERTIES[TileType.ORE].walkable).toBe(true);
    expect(TILE_PROPERTIES[TileType.ORE].harvestable).toBe(true);
    expect(TILE_PROPERTIES[TileType.CAVE_WALL].walkable).toBe(false);
  });

  it("should leave at least one cave open to the surface", () => {
    // A sealed cave would be unreachable, so ore would be unobtainable
    let reachable = 0;

    for (let tileY = 0; tileY < SURVEY_TILES; tileY++) {
      for (let tileX = 0; tileX < SURVEY_TILES; tileX++) {
        if (grid[tileY][tileX] !== TileType.CAVE_FLOOR) continue;

        const walkableOutside = neighboursOf(tileX, tileY).some(
          (tile) => !CAVE_TILES.includes(tile) && TILE_PROPERTIES[tile].walkable,
        );
        if (walkableOutside) reachable++;
      }
    }

    expect(reachable).toBeGreaterThan(0);
  });

  it("should produce a byte-identical survey from a second generator", () => {
    const other = new ChunkGenerator(WORLD_SEED);

    expect(surveyTiles(other, SURVEY_TILES)).toEqual(grid);
  });
});

describe("underground generation", () => {
  const underground = surveyTiles(
    new ChunkGenerator(WORLD_SEED),
    SURVEY_TILES,
    WorldLayer.UNDERGROUND,
  );
  const undergroundCounts = countTiles(underground);

  it("should contain only cave floors, walls and ore", () => {
    for (const tile of CAVE_TILES) {
      expect(undergroundCounts.get(tile) ?? 0).toBeGreaterThan(0);
    }

    for (const row of underground) {
      for (const tile of row) {
        expect(CAVE_TILES).toContain(tile);
      }
    }
  });

  it("should be deterministic for the same seed", () => {
    expect(
      surveyTiles(new ChunkGenerator(WORLD_SEED), SURVEY_TILES, WorldLayer.UNDERGROUND),
    ).toEqual(underground);
  });

  it("should keep every surface mouth and its underground landing walkable", () => {
    let entrances = 0;
    for (let tileY = 1; tileY < SURVEY_TILES - 1; tileY++) {
      for (let tileX = 1; tileX < SURVEY_TILES - 1; tileX++) {
        if (grid[tileY][tileX] !== TileType.CAVE_FLOOR) continue;
        const outside = [
          grid[tileY][tileX + 1],
          grid[tileY][tileX - 1],
          grid[tileY + 1][tileX],
          grid[tileY - 1][tileX],
        ].some((tile) => !CAVE_TILES.includes(tile) && TILE_PROPERTIES[tile].walkable);
        if (!outside) continue;

        entrances++;
        expect(TILE_PROPERTIES[underground[tileY][tileX]].walkable).toBe(true);
      }
    }

    expect(entrances).toBeGreaterThan(0);
  });
});

const chunkCache = new Map<string, number[][]>();

/** Single tile, including the ring just outside the survey. */
function tileAt(tileX: number, tileY: number): TileType {
  const chunkX = Math.floor(tileX / CHUNK_SIZE);
  const chunkY = Math.floor(tileY / CHUNK_SIZE);
  const key = `${chunkX},${chunkY}`;

  let tiles = chunkCache.get(key);
  if (!tiles) {
    tiles = generator.generateChunk(chunkX, chunkY);
    chunkCache.set(key, tiles);
  }

  return tiles[tileY - chunkY * CHUNK_SIZE][tileX - chunkX * CHUNK_SIZE] as TileType;
}

/** The four tiles orthogonally adjacent to the given tile. */
function neighboursOf(tileX: number, tileY: number): TileType[] {
  return [
    tileAt(tileX + 1, tileY),
    tileAt(tileX - 1, tileY),
    tileAt(tileX, tileY + 1),
    tileAt(tileX, tileY - 1),
  ];
}
