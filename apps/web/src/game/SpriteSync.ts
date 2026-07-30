import Phaser from "phaser";
import type {
  CropComponent,
  Entity,
  PlayerComponent,
  RenderData,
  World,
} from "@worldnest/game-engine";

const LOCAL_PLAYER_DEPTH = 100;
const REMOTE_PLAYER_DEPTH = 99;
const STRUCTURE_DEPTH = 60;
const CROP_DEPTH = 50;
const REMOTE_PLAYER_TINT = 0xff8a80;
/** Placeholder textures are generated at 16x16; TILE_SIZE is 32. */
const SPRITE_SCALE = 2;

/**
 * SpriteSync mirrors `RenderSystem.renderData` onto Phaser sprites.
 *
 * It is the only place sprites are created, positioned or destroyed, so the ECS
 * stays the single source of truth. Per-kind presentation (depth, tint, and the
 * per-stage crop texture) is decided here from the entity's components.
 */
export class SpriteSync {
  private scene: Phaser.Scene;
  private world: World;
  /** Phaser sprites keyed by ECS entity id. */
  private sprites: Map<string, Phaser.GameObjects.Sprite> = new Map();

  constructor(scene: Phaser.Scene, world: World) {
    this.scene = scene;
    this.world = world;
  }

  /** Create, update and destroy sprites to match the latest render data. */
  sync(renderData: RenderData[]): void {
    const seen = new Set<string>();

    for (const data of renderData) {
      seen.add(data.entityId);
      const entity = this.world.getEntity(data.entityId);
      const sprite = this.sprites.get(data.entityId) ?? this.createSprite(data, entity);
      const textureKey = resolveTextureKey(data, entity);

      if (sprite.texture.key !== textureKey && this.scene.textures.exists(textureKey)) {
        sprite.setTexture(textureKey);
      }
      sprite.setPosition(data.x, data.y);
      sprite.setVisible(data.visible);
    }

    for (const [entityId, sprite] of this.sprites) {
      if (!seen.has(entityId)) {
        sprite.destroy();
        this.sprites.delete(entityId);
      }
    }
  }

  /** Sprite for an entity, once it has been through a `sync` pass. */
  get(entityId: string): Phaser.GameObjects.Sprite | undefined {
    return this.sprites.get(entityId);
  }

  destroy(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
  }

  private createSprite(
    data: RenderData,
    entity: Entity | undefined,
  ): Phaser.GameObjects.Sprite {
    const sprite = this.scene.add.sprite(
      data.x,
      data.y,
      resolveTextureKey(data, entity),
    );
    sprite.setScale(SPRITE_SCALE);
    sprite.setDepth(resolveDepth(entity));

    const player = entity?.getComponent<PlayerComponent>("player");
    if (player && !player.isLocal) {
      sprite.setTint(REMOTE_PLAYER_TINT);
    }

    this.sprites.set(data.entityId, sprite);
    return sprite;
  }
}

/** Crops swap texture per growth stage; everything else uses its sprite key. */
function resolveTextureKey(data: RenderData, entity: Entity | undefined): string {
  const crop = entity?.getComponent<CropComponent>("crop");
  return crop ? `${data.textureKey}_${crop.stage}` : data.textureKey;
}

function resolveDepth(entity: Entity | undefined): number {
  const player = entity?.getComponent<PlayerComponent>("player");
  if (player) return player.isLocal ? LOCAL_PLAYER_DEPTH : REMOTE_PLAYER_DEPTH;
  if (entity?.hasComponent("structure")) return STRUCTURE_DEPTH;
  // Crops, and anything else world-bound, sit just above the ground textures
  return CROP_DEPTH;
}
