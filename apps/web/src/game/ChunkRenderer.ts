import Phaser from "phaser";
import { TileType } from "@worldnest/game-engine";
import type { ChunkData } from "@worldnest/game-engine";
import { CHUNK_SIZE, TILE_SIZE, getChunkKey } from "@worldnest/shared";

/** Placeholder tile textures are generated at 16x16 in BootScene. */
const SOURCE_TILE_SIZE = 16;

/**
 * ChunkRenderer owns one RenderTexture per loaded chunk.
 * All tiles of a chunk are stamped into a single texture, which keeps the number
 * of Phaser game objects at 1 per chunk instead of 256.
 */
export class ChunkRenderer {
  private scene: Phaser.Scene;
  private chunkTextures: Map<string, Phaser.GameObjects.RenderTexture> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Draw a freshly loaded chunk into its own RenderTexture.
   */
  drawChunk(chunk: ChunkData): void {
    const key = getChunkKey(chunk.chunkX, chunk.chunkY);
    if (this.chunkTextures.has(key)) return;

    const chunkPixelSize = CHUNK_SIZE * TILE_SIZE;
    const renderTexture = this.scene.add.renderTexture(
      chunk.chunkX * chunkPixelSize,
      chunk.chunkY * chunkPixelSize,
      chunkPixelSize,
      chunkPixelSize,
    );
    renderTexture.setOrigin(0, 0);
    renderTexture.setDepth(0);

    const stampSprite = this.createStampSprite();

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tileType = chunk.tiles[y][x] as TileType;
        stampSprite.setTexture(`tile_${tileType}`);
        renderTexture.draw(stampSprite, x * TILE_SIZE, y * TILE_SIZE);
      }
    }

    stampSprite.destroy();
    this.chunkTextures.set(key, renderTexture);
  }

  /**
   * Destroy the RenderTexture for an unloaded chunk.
   */
  removeChunk(chunkX: number, chunkY: number): void {
    const key = getChunkKey(chunkX, chunkY);
    const renderTexture = this.chunkTextures.get(key);
    if (renderTexture) {
      renderTexture.destroy();
      this.chunkTextures.delete(key);
    }
  }

  /**
   * Repaint a single tile in place, without rebuilding the whole chunk texture.
   * Used by the terrain modification overlay.
   */
  redrawTile(tileX: number, tileY: number, tileType: TileType): void {
    const chunkX = Math.floor(tileX / CHUNK_SIZE);
    const chunkY = Math.floor(tileY / CHUNK_SIZE);
    const renderTexture = this.chunkTextures.get(getChunkKey(chunkX, chunkY));
    if (!renderTexture) return;

    const localTileX = tileX - chunkX * CHUNK_SIZE;
    const localTileY = tileY - chunkY * CHUNK_SIZE;

    const stampSprite = this.createStampSprite();
    stampSprite.setTexture(`tile_${tileType}`);
    renderTexture.draw(stampSprite, localTileX * TILE_SIZE, localTileY * TILE_SIZE);
    stampSprite.destroy();
  }

  /**
   * Destroy every chunk texture owned by this renderer.
   */
  destroy(): void {
    for (const renderTexture of this.chunkTextures.values()) {
      renderTexture.destroy();
    }
    this.chunkTextures.clear();
  }

  private createStampSprite(): Phaser.GameObjects.Sprite {
    const stampSprite = this.scene.make.sprite({ key: "tile_0", add: false });
    stampSprite.setOrigin(0, 0);
    stampSprite.setScale(TILE_SIZE / SOURCE_TILE_SIZE);
    return stampSprite;
  }
}
