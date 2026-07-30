import Phaser from "phaser";
import type { Entity, PlayerComponent, RenderData, World } from "@worldnest/game-engine";

/** Labels sit above every sprite, including the local player. */
const NAME_TAG_DEPTH = 110;

/** Pixels above the entity position the label is centred on. */
const NAME_TAG_OFFSET_Y = 24;

const NAME_TAG_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontSize: "10px",
  color: "#ffffff",
  stroke: "#000000",
  strokeThickness: 3,
};

/**
 * NameTags floats a username label above each remote player.
 *
 * It mirrors the same `RenderData` the sprites do, so labels appear, follow and
 * disappear with their entity without any extra bookkeeping. The local player is
 * skipped — the camera already follows them and they know who they are.
 */
export class NameTags {
  private scene: Phaser.Scene;
  private world: World;
  /** Text objects keyed by ECS entity id. */
  private labels: Map<string, Phaser.GameObjects.Text> = new Map();

  constructor(scene: Phaser.Scene, world: World) {
    this.scene = scene;
    this.world = world;
  }

  /** Create, move and destroy labels to match the latest render data. */
  sync(renderData: RenderData[]): void {
    const seen = new Set<string>();

    for (const data of renderData) {
      const entity = this.world.getEntity(data.entityId);
      const username = remoteUsername(entity);
      if (!username) continue;

      seen.add(data.entityId);
      const label = this.labels.get(data.entityId) ?? this.createLabel(data, username);
      label.setPosition(data.x, data.y - NAME_TAG_OFFSET_Y);
      label.setVisible(data.visible);
    }

    for (const [entityId, label] of this.labels) {
      if (!seen.has(entityId)) {
        label.destroy();
        this.labels.delete(entityId);
      }
    }
  }

  /** Label for an entity, once it has been through a `sync` pass. */
  get(entityId: string): Phaser.GameObjects.Text | undefined {
    return this.labels.get(entityId);
  }

  destroy(): void {
    for (const label of this.labels.values()) {
      label.destroy();
    }
    this.labels.clear();
  }

  private createLabel(data: RenderData, username: string): Phaser.GameObjects.Text {
    const label = this.scene.add.text(data.x, data.y - NAME_TAG_OFFSET_Y, username, NAME_TAG_STYLE);
    label.setOrigin(0.5, 1);
    label.setDepth(NAME_TAG_DEPTH);

    this.labels.set(data.entityId, label);
    return label;
  }
}

/** Username to label an entity with, or `null` when it needs no label. */
function remoteUsername(entity: Entity | undefined): string | null {
  const player = entity?.getComponent<PlayerComponent>("player");
  if (!player || player.isLocal) return null;

  return player.username;
}
