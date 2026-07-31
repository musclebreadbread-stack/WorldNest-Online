import { getTileKey, parseTileKey } from "./TileQuery";

/** The two deterministic terrain layers in one world. */
export enum WorldLayer {
  SURFACE = 0,
  UNDERGROUND = 1,
}

/**
 * Persistence key for one tile. Surface keys deliberately keep the historical
 * `"x,y"` codec; only underground coordinates carry a layer prefix.
 */
export function getLayerTileKey(
  layer: WorldLayer,
  tileX: number,
  tileY: number,
): string {
  const tileKey = getTileKey(tileX, tileY);
  return layer === WorldLayer.SURFACE ? tileKey : `${layer}:${tileKey}`;
}

/** Decode a key produced by `getLayerTileKey`. */
export function parseLayerTileKey(key: string): {
  layer: WorldLayer;
  tileX: number;
  tileY: number;
} {
  const separator = key.indexOf(":");
  if (separator === -1) {
    return { layer: WorldLayer.SURFACE, ...parseTileKey(key) };
  }

  const layer = Number.parseInt(key.slice(0, separator), 10) as WorldLayer;
  return { layer, ...parseTileKey(key.slice(separator + 1)) };
}
