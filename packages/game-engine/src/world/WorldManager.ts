import { CHUNK_SIZE, TILE_SIZE, getChunkKey } from "@worldnest/shared";
import { ChunkGenerator } from "./ChunkGenerator";
import { TILE_PROPERTIES, TileType } from "./Tilemap";
import { getTileKey, type TileQuery } from "./TileQuery";

export interface ChunkData {
  chunkX: number;
  chunkY: number;
  tiles: number[][];
}

export type ChunkLoadCallback = (chunk: ChunkData) => void;
export type ChunkUnloadCallback = (chunkX: number, chunkY: number) => void;
export type TileChangeCallback = (
  tileX: number,
  tileY: number,
  tileType: TileType,
) => void;

/**
 * WorldManager handles chunk streaming based on player position and owns the
 * terrain modification overlay.
 *
 * Generated terrain stays deterministic: player edits are stored as overrides
 * keyed by tile coordinate and consulted before the generated tile data, so the
 * generator (and its determinism tests) never has to know about them.
 */
export class WorldManager implements TileQuery {
  private generator: ChunkGenerator;
  private loadedChunks: Map<string, ChunkData> = new Map();
  private tileOverrides: Map<string, TileType> = new Map();
  private currentCenterX: number = Number.MAX_SAFE_INTEGER;
  private currentCenterY: number = Number.MAX_SAFE_INTEGER;
  private loadRadius: number;

  private onChunkLoad?: ChunkLoadCallback;
  private onChunkUnload?: ChunkUnloadCallback;
  private onTileChanged?: TileChangeCallback;

  constructor(seed: number, loadRadius: number = 1) {
    this.generator = new ChunkGenerator(seed);
    this.loadRadius = loadRadius;
  }

  setCallbacks(onLoad: ChunkLoadCallback, onUnload: ChunkUnloadCallback): void {
    this.onChunkLoad = onLoad;
    this.onChunkUnload = onUnload;
  }

  /**
   * Register a listener notified whenever a tile override is applied, so the
   * renderer can repaint a single tile instead of a whole chunk.
   */
  setTileChangeCallback(onTileChanged: TileChangeCallback): void {
    this.onTileChanged = onTileChanged;
  }

  getLoadedChunks(): Map<string, ChunkData> {
    return this.loadedChunks;
  }

  getChunk(chunkX: number, chunkY: number): ChunkData | undefined {
    return this.loadedChunks.get(getChunkKey(chunkX, chunkY));
  }

  /**
   * Update loaded chunks based on the player's current chunk position.
   * Loads new chunks that come into range and unloads chunks that leave range.
   */
  updateLoadedChunks(centerChunkX: number, centerChunkY: number): void {
    if (
      centerChunkX === this.currentCenterX &&
      centerChunkY === this.currentCenterY
    ) {
      return; // No change in player chunk position
    }

    this.currentCenterX = centerChunkX;
    this.currentCenterY = centerChunkY;

    // Determine which chunks should be loaded (3x3 grid)
    const requiredChunks = new Set<string>();
    for (let dy = -this.loadRadius; dy <= this.loadRadius; dy++) {
      for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
        const cx = centerChunkX + dx;
        const cy = centerChunkY + dy;
        requiredChunks.add(getChunkKey(cx, cy));
      }
    }

    // Unload chunks that are no longer needed
    for (const [key, chunk] of this.loadedChunks) {
      if (!requiredChunks.has(key)) {
        this.loadedChunks.delete(key);
        this.onChunkUnload?.(chunk.chunkX, chunk.chunkY);
      }
    }

    // Load chunks that are newly required
    for (const key of requiredChunks) {
      if (!this.loadedChunks.has(key)) {
        const [cxStr, cyStr] = key.split(",");
        const cx = parseInt(cxStr, 10);
        const cy = parseInt(cyStr, 10);
        const tiles = this.generator.generateChunk(cx, cy);
        const chunkData: ChunkData = { chunkX: cx, chunkY: cy, tiles };
        this.loadedChunks.set(key, chunkData);
        this.onChunkLoad?.(chunkData);
      }
    }
  }

  /**
   * Tile type at the given tile coordinates.
   * Overrides win over generated data. Tiles outside the loaded chunks are
   * generated on demand — generation is deterministic, so this needs no cache.
   */
  getTileAt(tileX: number, tileY: number): TileType {
    const override = this.tileOverrides.get(getTileKey(tileX, tileY));
    if (override !== undefined) {
      return override;
    }

    const chunkX = Math.floor(tileX / CHUNK_SIZE);
    const chunkY = Math.floor(tileY / CHUNK_SIZE);
    const localX = tileX - chunkX * CHUNK_SIZE;
    const localY = tileY - chunkY * CHUNK_SIZE;

    const chunk = this.loadedChunks.get(getChunkKey(chunkX, chunkY));
    const tiles = chunk ? chunk.tiles : this.generator.generateChunk(chunkX, chunkY);

    return tiles[localY][localX] as TileType;
  }

  /**
   * Whether the tile under the given world pixel coordinates can be walked on.
   */
  isWalkableAt(pixelX: number, pixelY: number): boolean {
    const tileType = this.getTileAt(
      Math.floor(pixelX / TILE_SIZE),
      Math.floor(pixelY / TILE_SIZE),
    );
    return TILE_PROPERTIES[tileType].walkable;
  }

  /**
   * Record a player-caused terrain change. Notifies the tile change listener.
   */
  setTileOverride(tileX: number, tileY: number, tileType: TileType): void {
    this.tileOverrides.set(getTileKey(tileX, tileY), tileType);
    this.onTileChanged?.(tileX, tileY, tileType);
  }

  /**
   * All recorded terrain changes, keyed by `"tileX,tileY"`.
   * This is the diff persistence needs to store.
   */
  getTileOverrides(): Map<string, TileType> {
    return this.tileOverrides;
  }

  /**
   * Bulk-restore terrain changes, e.g. from the database on session start.
   * Does not fire the tile change listener: callers apply these before the
   * first chunk is drawn.
   */
  applyTileOverrides(entries: Iterable<[string, TileType]>): void {
    for (const [key, tileType] of entries) {
      this.tileOverrides.set(key, tileType);
    }
  }
}
