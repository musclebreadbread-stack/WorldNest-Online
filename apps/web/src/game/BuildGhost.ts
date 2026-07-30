import Phaser from "phaser";
import { getFacedTile, getSelectedItem } from "@worldnest/game-engine";
import type {
  BuildSystem,
  Entity,
  InteractionComponent,
  InventoryComponent,
  PositionComponent,
} from "@worldnest/game-engine";
import { ITEM_DEFINITIONS, TILE_SIZE } from "@worldnest/shared";

const GHOST_DEPTH = 61;
const GHOST_ALPHA = 0.55;
const CAN_PLACE_TINT = 0x69f0ae;
const CANNOT_PLACE_TINT = 0xff5252;
/** Placeholder textures are generated at 16x16; TILE_SIZE is 32. */
const SPRITE_SCALE = 2;

/**
 * BuildGhost previews the structure that would be placed on the faced tile.
 *
 * The green/red tint comes straight from `BuildSystem.canPlaceAt`, so the preview
 * and the placement rules can never drift apart.
 */
export class BuildGhost {
  private sprite: Phaser.GameObjects.Sprite;
  private playerEntity: Entity;
  private buildSystem: BuildSystem;

  constructor(scene: Phaser.Scene, playerEntity: Entity, buildSystem: BuildSystem) {
    this.playerEntity = playerEntity;
    this.buildSystem = buildSystem;

    this.sprite = scene.add.sprite(0, 0, "structure_fence");
    this.sprite.setScale(SPRITE_SCALE);
    this.sprite.setDepth(GHOST_DEPTH);
    this.sprite.setAlpha(GHOST_ALPHA);
    this.sprite.setVisible(false);
  }

  /** Reposition and re-tint the ghost. Call once per frame. */
  update(buildMode: boolean): void {
    const inventory = this.playerEntity.getComponent<InventoryComponent>("inventory")!;
    const selected = getSelectedItem(inventory);
    const textureKey = selected
      ? ITEM_DEFINITIONS[selected.itemId].structureTextureKey
      : undefined;

    if (!buildMode || !textureKey) {
      this.sprite.setVisible(false);
      return;
    }

    const interaction =
      this.playerEntity.getComponent<InteractionComponent>("interaction")!;
    const position = this.playerEntity.getComponent<PositionComponent>("position")!;
    const { tileX, tileY } = getFacedTile(position.x, position.y, interaction.facing);

    if (this.sprite.texture.key !== textureKey) {
      this.sprite.setTexture(textureKey);
    }
    this.sprite.setPosition(
      tileX * TILE_SIZE + TILE_SIZE / 2,
      tileY * TILE_SIZE + TILE_SIZE / 2,
    );
    this.sprite.setTint(
      this.buildSystem.canPlaceAt(inventory, tileX, tileY)
        ? CAN_PLACE_TINT
        : CANNOT_PLACE_TINT,
    );
    this.sprite.setVisible(true);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
