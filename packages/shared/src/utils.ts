import { CHUNK_SIZE, TILE_SIZE } from "./constants";
import type { Position } from "./index";

/**
 * Convert world pixel coordinates to tile coordinates
 */
export function pixelToTile(x: number, y: number): Position {
  return {
    x: Math.floor(x / TILE_SIZE),
    y: Math.floor(y / TILE_SIZE),
  };
}

/**
 * Convert tile coordinates to world pixel coordinates
 */
export function tileToPixel(tileX: number, tileY: number): Position {
  return {
    x: tileX * TILE_SIZE,
    y: tileY * TILE_SIZE,
  };
}

/**
 * Convert tile coordinates to chunk coordinates
 */
export function tileToChunk(tileX: number, tileY: number): Position {
  return {
    x: Math.floor(tileX / CHUNK_SIZE),
    y: Math.floor(tileY / CHUNK_SIZE),
  };
}

/**
 * Generate a unique string key for a chunk at the given coordinates
 */
export function getChunkKey(chunkX: number, chunkY: number): string {
  return `${chunkX},${chunkY}`;
}

/**
 * Parse a chunk key back into coordinates
 */
export function parseChunkKey(key: string): Position {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}
