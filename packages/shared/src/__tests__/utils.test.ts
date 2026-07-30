import { describe, it, expect } from "vitest";
import { CHUNK_SIZE, TILE_SIZE } from "../constants";
import {
  getChunkKey,
  parseChunkKey,
  pixelToTile,
  tileToChunk,
  tileToPixel,
} from "../utils";

describe("pixelToTile / tileToPixel", () => {
  it("should round-trip tile coordinates through pixel coordinates", () => {
    for (const tile of [
      { x: 0, y: 0 },
      { x: 3, y: 7 },
      { x: 128, y: 64 },
    ]) {
      const pixel = tileToPixel(tile.x, tile.y);
      expect(pixelToTile(pixel.x, pixel.y)).toEqual(tile);
    }
  });

  it("should floor pixel coordinates inside a tile to that tile", () => {
    expect(pixelToTile(TILE_SIZE + 1, TILE_SIZE * 2 + TILE_SIZE - 1)).toEqual({
      x: 1,
      y: 2,
    });
  });

  it("should handle negative pixel coordinates", () => {
    expect(pixelToTile(-1, -TILE_SIZE)).toEqual({ x: -1, y: -1 });
    expect(tileToPixel(-2, -3)).toEqual({ x: -2 * TILE_SIZE, y: -3 * TILE_SIZE });
  });
});

describe("tileToChunk", () => {
  it("should map tiles to their owning chunk", () => {
    expect(tileToChunk(0, 0)).toEqual({ x: 0, y: 0 });
    expect(tileToChunk(CHUNK_SIZE - 1, CHUNK_SIZE - 1)).toEqual({ x: 0, y: 0 });
    expect(tileToChunk(CHUNK_SIZE, CHUNK_SIZE * 2)).toEqual({ x: 1, y: 2 });
  });

  it("should handle negative tile coordinates", () => {
    expect(tileToChunk(-1, -1)).toEqual({ x: -1, y: -1 });
    expect(tileToChunk(-CHUNK_SIZE, -CHUNK_SIZE - 1)).toEqual({ x: -1, y: -2 });
  });
});

describe("getChunkKey / parseChunkKey", () => {
  it("should round-trip chunk coordinates", () => {
    expect(parseChunkKey(getChunkKey(4, 9))).toEqual({ x: 4, y: 9 });
  });

  it("should round-trip negative chunk coordinates", () => {
    expect(getChunkKey(-3, -8)).toBe("-3,-8");
    expect(parseChunkKey("-3,-8")).toEqual({ x: -3, y: -8 });
  });
});
