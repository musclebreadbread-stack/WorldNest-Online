import Phaser from "phaser";
import { CROP_DEFINITIONS, TileType, TILE_PROPERTIES } from "@worldnest/game-engine";
import { ITEM_DEFINITIONS, PLACEABLE_ITEM_IDS } from "@worldnest/shared";

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
    // Generate tileset texture programmatically (16x16 per tile, 7 tiles)
    this.generateTileset();

    // Generate player sprite (simple colored rectangles for 4 directions)
    this.generatePlayerSprite();

    // Generate one placeholder per crop growth stage
    this.generateCropSprites();

    // Generate one placeholder per placeable structure
    this.generateStructureSprites();

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
      TileType.FARMLAND,
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
      } else if (tileType === TileType.FARMLAND) {
        // Ploughed furrows
        graphics.fillStyle(0x6d4c41, 1);
        graphics.fillRect(1, 4, 14, 2);
        graphics.fillRect(1, 10, 14, 2);
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

  /**
   * One texture per crop growth stage, keyed `<textureKey>_<stage>`, which is
   * what `SpriteSync` looks up from the crop's stage. Sprouts grow taller with
   * each stage and turn golden when mature.
   */
  private generateCropSprites(): void {
    const size = 16;

    for (const definition of Object.values(CROP_DEFINITIONS)) {
      if (!definition) continue;

      for (let stage = 0; stage < definition.stageCount; stage++) {
        const mature = stage === definition.stageCount - 1;
        const height = 3 + stage * 4;
        const graphics = this.add.graphics();

        graphics.fillStyle(mature ? 0xfbc02d : 0x66bb6a, 1);
        graphics.fillRect(7, size - height - 1, 2, height);
        if (stage > 0) {
          graphics.fillRect(4, size - height + 1, 3, 2);
          graphics.fillRect(9, size - height + 3, 3, 2);
        }
        if (mature) {
          graphics.fillStyle(0xf9a825, 1);
          graphics.fillCircle(8, size - height - 1, 3);
        }

        graphics.generateTexture(`${definition.textureKey}_${stage}`, size, size);
        graphics.destroy();
      }
    }
  }

  /**
   * One texture per placeable item, keyed by its `structureTextureKey`, which is
   * what `BuildSystem` writes onto the placed entity's sprite.
   */
  private generateStructureSprites(): void {
    const size = 16;

    for (const itemId of PLACEABLE_ITEM_IDS) {
      const textureKey = ITEM_DEFINITIONS[itemId].structureTextureKey;
      if (!textureKey) continue;

      const graphics = this.add.graphics();

      if (itemId === "chest") {
        graphics.fillStyle(0x8d6e63, 1);
        graphics.fillRect(2, 5, 12, 9);
        graphics.fillStyle(0x5d4037, 1);
        graphics.fillRect(2, 8, 12, 2);
        graphics.fillStyle(0xffd54f, 1);
        graphics.fillRect(7, 9, 2, 3);
      } else {
        // Fence: two posts joined by rails
        graphics.fillStyle(0xa1887f, 1);
        graphics.fillRect(2, 4, 3, 11);
        graphics.fillRect(11, 4, 3, 11);
        graphics.fillStyle(0x8d6e63, 1);
        graphics.fillRect(0, 6, 16, 2);
        graphics.fillRect(0, 11, 16, 2);
      }

      graphics.generateTexture(textureKey, size, size);
      graphics.destroy();
    }
  }
}
