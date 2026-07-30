import Phaser from "phaser";
import { TileType, TILE_PROPERTIES } from "@worldnest/game-engine";

/**
 * BootScene handles asset loading and generation of placeholder graphics.
 * Generates colored rectangle textures for tiles and player sprite.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // Display loading text
    const text = this.add.text(
      this.cameras.main.centerX,
      this.cameras.main.centerY,
      "Loading...",
      { fontSize: "24px", color: "#ffffff" },
    );
    text.setOrigin(0.5);
  }

  create(): void {
    // Generate tileset texture programmatically (16x16 per tile, 6 tiles)
    this.generateTileset();

    // Generate player sprite (simple colored rectangles for 4 directions)
    this.generatePlayerSprite();

    // Transition to game scene
    this.scene.start("GameScene");
    this.scene.start("UIScene");
  }

  private generateTileset(): void {
    const tileSize = 16;
    const tileTypes = [
      TileType.GRASS,
      TileType.WATER,
      TileType.SAND,
      TileType.FOREST,
      TileType.STONE,
      TileType.FLOWERS,
    ];

    for (const tileType of tileTypes) {
      const props = TILE_PROPERTIES[tileType];
      const graphics = this.add.graphics();
      graphics.fillStyle(props.color, 1);
      graphics.fillRect(0, 0, tileSize, tileSize);

      // Add some visual detail
      if (tileType === TileType.WATER) {
        graphics.fillStyle(0x1976d2, 0.5);
        graphics.fillRect(2, 6, 12, 2);
        graphics.fillRect(4, 10, 8, 2);
      } else if (tileType === TileType.FOREST) {
        graphics.fillStyle(0x1b5e20, 1);
        graphics.fillTriangle(8, 2, 3, 12, 13, 12);
      } else if (tileType === TileType.FLOWERS) {
        graphics.fillStyle(0xf8bbd0, 1);
        graphics.fillCircle(5, 5, 2);
        graphics.fillCircle(11, 8, 2);
        graphics.fillCircle(7, 12, 2);
      } else if (tileType === TileType.STONE) {
        graphics.fillStyle(0x9e9e9e, 1);
        graphics.fillRect(3, 3, 10, 10);
      }

      graphics.generateTexture(`tile_${tileType}`, tileSize, tileSize);
      graphics.destroy();
    }
  }

  private generatePlayerSprite(): void {
    const size = 16;
    const graphics = this.add.graphics();

    // Body (blue square)
    graphics.fillStyle(0x42a5f5, 1);
    graphics.fillRect(3, 4, 10, 10);

    // Head (lighter)
    graphics.fillStyle(0xffcc80, 1);
    graphics.fillRect(5, 1, 6, 5);

    // Eyes
    graphics.fillStyle(0x000000, 1);
    graphics.fillRect(6, 3, 2, 2);
    graphics.fillRect(9, 3, 2, 2);

    graphics.generateTexture("player", size, size);
    graphics.destroy();
  }
}
