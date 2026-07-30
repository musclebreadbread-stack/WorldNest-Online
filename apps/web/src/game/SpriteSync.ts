import Phaser from "phaser";
import { directionalTextureKey } from "@worldnest/game-engine";
import type {
  AnimationComponent,
  CropComponent,
  Entity,
  PlayerComponent,
  RenderData,
  World,
} from "@worldnest/game-engine";
import { NameTags } from "./NameTags";

const LOCAL_PLAYER_DEPTH = 100;
const REMOTE_PLAYER_DEPTH = 99;
/** Just under the players: an NPC never hides the person talking to it. */
const NPC_DEPTH = 98;
const STRUCTURE_DEPTH = 60;
const CROP_DEPTH = 50;
const REMOTE_PLAYER_TINT = 0xff8a80;
/** Placeholder textures are generated at 16x16; TILE_SIZE is 32. */
const SPRITE_SCALE = 2;

/**
 * SpriteSync mirrors `RenderSystem.renderData` onto Phaser sprites.
 *
 * It is the only place sprites are created, positioned or destroyed, so the ECS
 * stays the single source of truth. Per-kind presentation (depth, tint, the
 * per-stage crop texture and the per-direction animation frame) is decided here
 * from the entity's components, and remote username labels ride along on the same
 * pass through `NameTags`.
 */
export class SpriteSync {
  private scene: Phaser.Scene;
  private world: World;
  /** Phaser sprites keyed by ECS entity id. */
  private sprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  /** Floating username labels, driven by the same render data. */
  private nameTags: NameTags;

  constructor(scene: Phaser.Scene, world: World) {
    this.scene = scene;
    this.world = world;
    this.nameTags = new NameTags(scene, world);
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

    this.nameTags.sync(renderData);
  }

  /** Sprite for an entity, once it has been through a `sync` pass. */
  get(entityId: string): Phaser.GameObjects.Sprite | undefined {
    return this.sprites.get(entityId);
  }

  /** Username label for an entity, once it has been through a `sync` pass. */
  getNameTag(entityId: string): Phaser.GameObjects.Text | undefined {
    return this.nameTags.get(entityId);
  }

  destroy(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy();
    }
    this.sprites.clear();
    this.nameTags.destroy();
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

/**
 * Texture for an entity this frame: crops swap per growth stage, animated
 * entities per direction and walk frame, and everything else uses its sprite key.
 */
function resolveTextureKey(data: RenderData, entity: Entity | undefined): string {
  const crop = entity?.getComponent<CropComponent>("crop");
  if (crop) return `${data.textureKey}_${crop.stage}`;

  const animation = entity?.getComponent<AnimationComponent>("animation");
  if (animation) {
    return directionalTextureKey(
      data.textureKey,
      animation.direction,
      animation.frameIndex,
    );
  }

  return data.textureKey;
}

function resolveDepth(entity: Entity | undefined): number {
  const player = entity?.getComponent<PlayerComponent>("player");
  if (player) return player.isLocal ? LOCAL_PLAYER_DEPTH : REMOTE_PLAYER_DEPTH;
  if (entity?.hasComponent("npc")) return NPC_DEPTH;
  if (entity?.hasComponent("structure")) return STRUCTURE_DEPTH;
  // Crops, and anything else world-bound, sit just above the ground textures
  return CROP_DEPTH;
}
