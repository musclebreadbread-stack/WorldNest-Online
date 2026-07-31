import Phaser from "phaser";
import {
  CROP_DEFINITIONS,
  DEFAULT_FRAME_COUNT,
  TileType,
  TILE_PROPERTIES,
  directionalTextureKey,
} from "@worldnest/game-engine";
import type { Facing } from "@worldnest/game-engine";
import { ITEM_DEFINITIONS, PLACEABLE_ITEM_IDS } from "@worldnest/shared";
import { generateNpcTextures } from "./npcTextures";

/** Directions the placeholder player spritesheet covers. */
const PLAYER_DIRECTIONS: Facing[] = ["down", "up", "left", "right"];

/** Placeholder tiles are drawn at 16x16 and scaled up to `TILE_SIZE`. */
const TILE_TEXTURE_SIZE = 16;

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
    // Generate one tile texture per TileType, programmatically
    this.generateTileset();

    // Generate the directional player spritesheet (4 directions x 2 walk frames)
    this.generatePlayerSprite();

    // Generate one placeholder per crop growth stage
    this.generateCropSprites();

    // Generate one placeholder per placeable structure
    this.generateStructureSprites();

    // Generate one placeholder per NPC in the catalogue
    generateNpcTextures(this);

    // Transition to game scene
    this.scene.start("GameScene");
    this.scene.start("UIScene");
  }

  /**
   * One `tile_<id>` texture per member of the `TileType` enum, derived from the
   * enum rather than a hand-written list so a tile type added to the engine can
   * never ship without a texture.
   */
  private generateTileset(): void {
    const tileTypes = Object.values(TileType).filter(
      (value) => typeof value === "number",
    ) as TileType[];

    for (const tileType of tileTypes) {
      const graphics = this.add.graphics();
      graphics.fillStyle(TILE_PROPERTIES[tileType].color, 1);
      graphics.fillRect(0, 0, TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE);
      this.drawTileDetail(graphics, tileType);

      graphics.generateTexture(
        `tile_${tileType}`,
        TILE_TEXTURE_SIZE,
        TILE_TEXTURE_SIZE,
      );
      graphics.destroy();
    }
  }

  /** The marks that tell one tile of the same family from another. */
  private drawTileDetail(
    graphics: Phaser.GameObjects.Graphics,
    tileType: TileType,
  ): void {
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
    } else if (tileType === TileType.SNOW) {
      // Drifts: a few paler patches on the white
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(5, 6, 3);
      graphics.fillCircle(11, 11, 2);
      graphics.fillStyle(0xb0bec5, 1);
      graphics.fillRect(1, 14, 14, 1);
    } else if (tileType === TileType.CAVE_FLOOR) {
      // Pebbles on a dark floor
      graphics.fillStyle(0x3e2723, 1);
      graphics.fillRect(3, 4, 4, 3);
      graphics.fillRect(9, 9, 4, 3);
    } else if (tileType === TileType.CAVE_WALL) {
      // Blocky rock face with a highlight so walls read as solid
      graphics.fillStyle(0x424242, 1);
      graphics.fillRect(1, 1, 6, 6);
      graphics.fillRect(9, 9, 6, 6);
      graphics.fillStyle(0x616161, 1);
      graphics.fillRect(9, 2, 4, 4);
    } else if (tileType === TileType.ORE) {
      // Crystals embedded in cave rock
      graphics.fillStyle(0x4e342e, 1);
      graphics.fillRect(0, 0, TILE_TEXTURE_SIZE, TILE_TEXTURE_SIZE);
      graphics.fillStyle(TILE_PROPERTIES[TileType.ORE].color, 1);
      graphics.fillTriangle(5, 3, 2, 9, 8, 9);
      graphics.fillTriangle(11, 6, 8, 13, 14, 13);
      graphics.fillStyle(0xd1c4e9, 1);
      graphics.fillRect(4, 5, 1, 2);
      graphics.fillRect(10, 8, 1, 2);
    }
  }

  /**
   * A 4-direction x 2-frame placeholder spritesheet, one texture per frame keyed
   * `player_<direction>_<frame>` by `directionalTextureKey` — the same helper
   * `SpriteSync` resolves with, so the two cannot drift. The bare `player` key is
   * kept as the idle-facing-down fallback for sprites created before the first
   * animation update.
   */
  private generatePlayerSprite(): void {
    for (const direction of PLAYER_DIRECTIONS) {
      for (let frame = 0; frame < DEFAULT_FRAME_COUNT; frame++) {
        this.drawPlayerFrame(directionalTextureKey("player", direction, frame), {
          direction,
          frame,
        });
      }
    }

    this.drawPlayerFrame("player", { direction: "down", frame: 0 });
  }

  /**
   * One player frame: a body, a head whose eyes show which way it faces, and legs
   * that swap on the second frame so walking reads as a stride.
   */
  private drawPlayerFrame(
    textureKey: string,
    { direction, frame }: { direction: Facing; frame: number },
  ): void {
    const size = 16;
    const graphics = this.add.graphics();
    const stride = frame === 1;

    // Legs, offset per frame
    graphics.fillStyle(0x1565c0, 1);
    graphics.fillRect(stride ? 3 : 4, 13, 3, 3);
    graphics.fillRect(stride ? 10 : 9, 13, 3, 3);

    // Body (blue), leaning slightly into the walk on the second frame
    graphics.fillStyle(0x42a5f5, 1);
    graphics.fillRect(3, stride ? 5 : 4, 10, 9);

    // Head
    graphics.fillStyle(0xffcc80, 1);
    graphics.fillRect(5, 1, 6, 5);

    // Eyes: two facing down, one facing sideways, none facing away
    graphics.fillStyle(0x000000, 1);
    if (direction === "down") {
      graphics.fillRect(6, 3, 2, 2);
      graphics.fillRect(9, 3, 2, 2);
    } else if (direction === "left") {
      graphics.fillRect(5, 3, 2, 2);
    } else if (direction === "right") {
      graphics.fillRect(9, 3, 2, 2);
    }

    graphics.generateTexture(textureKey, size, size);
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
