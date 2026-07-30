import { getChunkKey } from "@worldnest/shared";
import { ChunkGenerator } from "./ChunkGenerator";

export interface ChunkData {
  chunkX: number;
  chunkY: number;
  tiles: number[][];
}

export type ChunkLoadCallback = (chunk: ChunkData) => void;
export type ChunkUnloadCallback = (chunkX: number, chunkY: number) => void;

/**
 * WorldManager handles chunk streaming based on player position.
 * Maintains a 3x3 grid of loaded chunks around the player.
 */
export class WorldManager {
  private generator: ChunkGenerator;
  private loadedChunks: Map<string, ChunkData> = new Map();
  private currentCenterX: number = Number.MAX_SAFE_INTEGER;
  private currentCenterY: number = Number.MAX_SAFE_INTEGER;
  private loadRadius: number;

  private onChunkLoad?: ChunkLoadCallback;
  private onChunkUnload?: ChunkUnloadCallback;

  constructor(seed: number, loadRadius: number = 1) {
    this.generator = new ChunkGenerator(seed);
    this.loadRadius = loadRadius;
  }

  setCallbacks(onLoad: ChunkLoadCallback, onUnload: ChunkUnloadCallback): void {
    this.onChunkLoad = onLoad;
    this.onChunkUnload = onUnload;
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
}
