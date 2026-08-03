import type { MinimapSample } from "@worldnest/game-engine";
import { TILE_SIZE } from "@worldnest/shared";

/** Tiles sampled either side of the player: a 49x49 window. */
export const MINIMAP_RADIUS_TILES = 24;

/** Screen pixels drawn per sampled tile. */
export const MINIMAP_PIXELS_PER_TILE = 2;

/** Gap between the minimap and the top-right corner of the viewport. */
export const MINIMAP_MARGIN = 12;

export interface MinimapPoint {
  x: number;
  y: number;
}

/** Side length in screen pixels of a minimap drawn from `radius` tiles. */
export function minimapPixelSize(
  radius: number = MINIMAP_RADIUS_TILES,
  pixelsPerTile: number = MINIMAP_PIXELS_PER_TILE,
): number {
  return (2 * radius + 1) * pixelsPerTile;
}

/**
 * Where to put a scroll-locked game object so it renders at a fixed screen point.
 *
 * `setScrollFactor(0)` stops an object from scrolling but does **not** stop the
 * camera zoom from scaling it about the camera midpoint, which is why
 * `DayNightOverlay` needs an overscan. Inverting that transform here is what lets
 * the minimap sit in a real screen corner under the scene's 2x zoom.
 */
export function fixedScreenPosition(
  cameraWidth: number,
  cameraHeight: number,
  zoom: number,
  screenX: number,
  screenY: number,
): MinimapPoint {
  const midX = cameraWidth / 2;
  const midY = cameraHeight / 2;
  return {
    x: midX + (screenX - midX) / zoom,
    y: midY + (screenY - midY) / zoom,
  };
}

/** Position of the minimap's top-left corner, anchored to the top-right corner. */
export function minimapAnchor(
  cameraWidth: number,
  cameraHeight: number,
  zoom: number,
  size: number = minimapPixelSize(),
  margin: number = MINIMAP_MARGIN,
): MinimapPoint {
  return fixedScreenPosition(
    cameraWidth,
    cameraHeight,
    zoom,
    cameraWidth - margin - size,
    margin,
  );
}

/**
 * Offset inside the minimap for a world pixel position, or `null` when that
 * position falls outside the sampled window.
 *
 * Sub-tile precision is kept so player dots drift smoothly instead of snapping
 * tile by tile.
 */
export function minimapDotOffset(
  sample: MinimapSample,
  worldX: number,
  worldY: number,
  pixelsPerTile: number = MINIMAP_PIXELS_PER_TILE,
): MinimapPoint | null {
  const x = (worldX / TILE_SIZE - sample.originTileX) * pixelsPerTile;
  const y = (worldY / TILE_SIZE - sample.originTileY) * pixelsPerTile;
  const size = sample.size * pixelsPerTile;

  if (x < 0 || y < 0 || x > size || y > size) return null;

  return { x, y };
}

/** Tile the player currently stands on, which is what triggers a redraw. */
export function tileOf(
  worldX: number,
  worldY: number,
): { tileX: number; tileY: number } {
  return {
    tileX: Math.floor(worldX / TILE_SIZE),
    tileY: Math.floor(worldY / TILE_SIZE),
  };
}
