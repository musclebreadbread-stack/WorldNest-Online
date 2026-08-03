import { describe, it, expect } from "vitest";
import { sampleMinimap, WorldManager } from "@worldnest/game-engine";
import { TILE_SIZE, WORLD_SEED } from "@worldnest/shared";
import {
  MINIMAP_MARGIN,
  MINIMAP_PIXELS_PER_TILE,
  MINIMAP_RADIUS_TILES,
  fixedScreenPosition,
  minimapAnchor,
  minimapDotOffset,
  minimapPixelSize,
  tileOf,
} from "../game/minimapLayout";

/** Where Phaser actually renders a scroll-locked object under a camera zoom. */
function renderedAt(objectValue: number, cameraExtent: number, zoom: number): number {
  const mid = cameraExtent / 2;
  return mid + (objectValue - mid) * zoom;
}

const sample = sampleMinimap(
  new WorldManager(WORLD_SEED, 1),
  10,
  20,
  MINIMAP_RADIUS_TILES,
);

describe("minimapPixelSize", () => {
  it("should cover the whole sampled window", () => {
    expect(minimapPixelSize(24, 2)).toBe(49 * 2);
    expect(minimapPixelSize()).toBe(
      (2 * MINIMAP_RADIUS_TILES + 1) * MINIMAP_PIXELS_PER_TILE,
    );
  });
});

describe("fixedScreenPosition", () => {
  it("should be the identity at zoom 1", () => {
    expect(fixedScreenPosition(800, 600, 1, 40, 90)).toEqual({ x: 40, y: 90 });
  });

  it("should invert the camera zoom about the camera midpoint", () => {
    const zoom = 2;
    const placed = fixedScreenPosition(800, 600, zoom, 700, 30);

    expect(renderedAt(placed.x, 800, zoom)).toBeCloseTo(700);
    expect(renderedAt(placed.y, 600, zoom)).toBeCloseTo(30);
  });
});

describe("minimapAnchor", () => {
  it("should render the minimap inside the top-right corner", () => {
    const zoom = 2;
    const size = minimapPixelSize();
    const anchor = minimapAnchor(800, 600, zoom, size);

    const left = renderedAt(anchor.x, 800, zoom);
    const top = renderedAt(anchor.y, 600, zoom);

    // The drawing is scaled by 1 / zoom, so its side length is `size` on screen
    expect(left + size).toBeCloseTo(800 - MINIMAP_MARGIN);
    expect(top).toBeCloseTo(MINIMAP_MARGIN);
    expect(left).toBeGreaterThan(400);
  });
});

describe("tileOf", () => {
  it("should floor world pixels to tiles, including negatives", () => {
    expect(tileOf(TILE_SIZE * 3 + 5, TILE_SIZE * 7 + 31)).toEqual({
      tileX: 3,
      tileY: 7,
    });
    expect(tileOf(-1, -TILE_SIZE - 1)).toEqual({ tileX: -1, tileY: -2 });
  });
});

describe("minimapDotOffset", () => {
  it("should put the centre tile at the centre of the drawing", () => {
    const offset = minimapDotOffset(
      sample,
      10 * TILE_SIZE + TILE_SIZE / 2,
      20 * TILE_SIZE + TILE_SIZE / 2,
    )!;
    const centre = minimapPixelSize() / 2;

    expect(offset.x).toBeCloseTo(centre);
    expect(offset.y).toBeCloseTo(centre);
  });

  it("should keep sub-tile precision so dots drift smoothly", () => {
    const a = minimapDotOffset(sample, 10 * TILE_SIZE, 20 * TILE_SIZE)!;
    const b = minimapDotOffset(sample, 10 * TILE_SIZE + TILE_SIZE / 2, 20 * TILE_SIZE)!;

    expect(b.x - a.x).toBeCloseTo(MINIMAP_PIXELS_PER_TILE / 2);
    expect(b.y).toBeCloseTo(a.y);
  });

  it("should map the window corners to the drawing corners", () => {
    const topLeft = minimapDotOffset(
      sample,
      sample.originTileX * TILE_SIZE,
      sample.originTileY * TILE_SIZE,
    )!;

    expect(topLeft).toEqual({ x: 0, y: 0 });
  });

  it("should reject positions outside the sampled window", () => {
    expect(
      minimapDotOffset(sample, (sample.originTileX - 1) * TILE_SIZE, 20 * TILE_SIZE),
    ).toBeNull();
    expect(
      minimapDotOffset(
        sample,
        10 * TILE_SIZE,
        (sample.originTileY + sample.size + 1) * TILE_SIZE,
      ),
    ).toBeNull();
  });
});
